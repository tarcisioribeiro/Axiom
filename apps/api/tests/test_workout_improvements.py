"""Treino: categorias, dias múltiplos, séries, unicidade e sync com tarefas."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import (
    Exercise,
    RoutineTask,
    TaskInstance,
    WorkoutDay,
    WorkoutPlan,
    WorkoutSession,
)


class WorkoutImprovementsTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="wk_test", email="wk@test.com", password="testpass123"
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="WK User",
            document_hash="w" * 64,
            phone="11999999933",
            sex="M",
            user=self.user,
        )
        self.today = timezone.localdate()
        self.weekday = self.today.weekday()

    def _plan(self, category, weekdays):
        plan = WorkoutPlan.objects.create(
            name=f"P {category}", category=category, owner=self.member
        )
        day = WorkoutDay.objects.create(
            plan=plan, name="A", days_of_week=weekdays, owner=self.member
        )
        return plan, day

    def _session(self, day, date=None):
        return self.client.post(
            reverse("workout-session-list-create"),
            {
                "workout_day": day.pk,
                "date": str(date or self.today),
                "owner": self.member.pk,
            },
        )

    # --- Exercícios -------------------------------------------------------

    def test_exercise_duplicate_name_and_muscle_rejected(self):
        url = reverse("exercise-list-create")
        payload = {
            "name": "Supino",
            "muscle_groups": "Peitoral",
            "category": "resistance",
            "owner": self.member.pk,
        }
        self.assertEqual(
            self.client.post(url, payload).status_code, status.HTTP_201_CREATED
        )
        dup = {**payload, "name": " supino ", "muscle_groups": "peitoral"}
        response = self.client.post(url, dup)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        other_muscle = {**payload, "muscle_groups": "Tríceps"}
        self.assertEqual(
            self.client.post(url, other_muscle).status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(Exercise.objects.count(), 2)

    # --- Divisões / séries ------------------------------------------------

    def test_day_accepts_multiple_weekdays_and_legacy_field(self):
        plan, _ = self._plan("mobility", [])
        url = reverse("workout-day-list-create")
        base = {"plan": plan.pk, "name": "B", "owner": self.member.pk}
        response = self.client.post(
            url, {**base, "days_of_week": [4, 0, 2, 0]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["days_of_week"], [0, 2, 4])
        self.assertEqual(response.data["day_of_week"], 0)

        legacy = self.client.post(url, {**base, "day_of_week": 3})
        self.assertEqual(legacy.data["days_of_week"], [3])

    def test_exercise_set_targets(self):
        _, day = self._plan("resistance", [])
        url = reverse("workout-exercise-list-create")
        payload = {
            "workout_day": day.pk,
            "name": "Agachamento",
            "sets": 2,
            "set_targets": [{"reps": 12, "load": "40"}, {"reps": 8}],
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["set_targets"],
            [{"reps": 12, "load": "40"}, {"reps": 8, "load": None}],
        )
        bad = {**payload, "set_targets": [{"reps": "doze"}]}
        response = self.client.post(url, bad, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Sessões: uma por divisão por dia --------------------------------

    def test_one_session_per_division_per_day(self):
        plan_a, strength_a = self._plan("resistance", [])
        _, strength_b = self._plan("resistance", [])
        strength_a2 = WorkoutDay.objects.create(
            plan=plan_a, name="B", owner=self.member
        )
        created = status.HTTP_201_CREATED
        self.assertEqual(self._session(strength_a).status_code, created)
        # Outro plano da mesma categoria e outra divisão do mesmo plano
        self.assertEqual(self._session(strength_b).status_code, created)
        self.assertEqual(self._session(strength_a2).status_code, created)
        # Mesma divisão no mesmo dia é recusada
        dup = self._session(strength_a)
        self.assertEqual(dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("'A'", str(dup.data["detail"]))
        yesterday = self.today - timedelta(days=1)
        self.assertEqual(
            self._session(strength_a, yesterday).status_code, created
        )

    # --- Tarefa vinculada ao treino ---------------------------------------

    def _linked_task(self):
        return RoutineTask.objects.create(
            name="Treinar",
            category="exercise",
            periodicity="daily",
            linked_workout=True,
            owner=self.member,
        )

    def _instances_today(self):
        response = self.client.get(
            reverse("instances-for-date"), {"date": str(self.today)}
        )
        return response.data["instances"]

    def test_linked_task_only_on_scheduled_days(self):
        self._linked_task()
        self.assertEqual(self._instances_today(), [])
        self._plan("resistance", [self.weekday])
        self.assertEqual(len(self._instances_today()), 1)

    def test_linked_task_completes_only_when_all_divisions_logged(self):
        task = self._linked_task()
        strength_plan, strength = self._plan("resistance", [self.weekday])
        _, mobility = self._plan("mobility", [self.weekday])
        strength_b = WorkoutDay.objects.create(
            plan=strength_plan,
            name="B",
            days_of_week=[self.weekday],
            owner=self.member,
        )
        instance_id = self._instances_today()[0]["id"]

        # Conclusão manual bloqueada (status/ e bulk-update)
        response = self.client.patch(
            reverse("task-instance-status-update", kwargs={"pk": instance_id}),
            {"status": "completed"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            reverse("task-instance-bulk-update"),
            {"updates": [{"id": instance_id, "status": "completed"}]},
            format="json",
        )
        self.assertEqual(response.data["updated_count"], 0)
        self.assertEqual(len(response.data["errors"]), 1)

        def status_now():
            return TaskInstance.objects.get(
                template=task, scheduled_date=self.today
            ).status

        self._session(strength)
        self._session(mobility)
        # Divisão B do plano de força ainda sem sessão
        self.assertEqual(status_now(), "pending")
        self._session(strength_b)
        self.assertEqual(status_now(), "completed")

        # Remover uma sessão reabre a tarefa
        session = WorkoutSession.objects.get(workout_day=mobility)
        self.client.delete(
            reverse("workout-session-detail", kwargs={"pk": session.pk})
        )
        self.assertEqual(status_now(), "pending")

    def test_linked_workout_requires_exercise_category(self):
        response = self.client.post(
            reverse("routine-task-list-create"),
            {
                "name": "Ler",
                "category": "intellect",
                "periodicity": "daily",
                "linked_workout": True,
                "owner": self.member.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Categoria do exercício = categoria do plano ----------------------

    def test_exercise_category_must_match_plan(self):
        plan, day = self._plan("mobility", [])
        stretch = Exercise.objects.create(
            name="Alongamento", category="mobility", owner=self.member
        )
        squat = Exercise.objects.create(
            name="Agachamento", category="resistance", owner=self.member
        )
        url = reverse("workout-exercise-list-create")
        base = {"workout_day": day.pk, "owner": self.member.pk}
        ok = self.client.post(
            url, {**base, "exercise": stretch.pk, "name": "Alongamento"}
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        bad = self.client.post(
            url, {**base, "exercise": squat.pk, "name": "Agachamento"}
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Mobilidade", str(bad.data["detail"]))

        # Plano com exercício de Mobilidade não muda de categoria
        response = self.client.patch(
            reverse("workout-plan-detail", kwargs={"pk": plan.pk}),
            {"category": "cardio"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Exercício usado em plano de Mobilidade não muda de categoria
        response = self.client.patch(
            reverse("exercise-detail", kwargs={"pk": stretch.pk}),
            {"category": "cardio"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Campos específicos de mobilidade/cardio --------------------------

    def test_workout_day_exposes_plan_category(self):
        _, day = self._plan("cardio", [])
        response = self.client.get(
            reverse("workout-day-detail", kwargs={"pk": day.pk})
        )
        self.assertEqual(response.data["category"], "cardio")

    def test_mobility_exercise_fields_round_trip(self):
        plan, day = self._plan("mobility", [])
        stretch = Exercise.objects.create(
            name="Alongamento", category="mobility", owner=self.member
        )
        response = self.client.post(
            reverse("workout-exercise-list-create"),
            {
                "workout_day": day.pk,
                "exercise": stretch.pk,
                "name": "Alongamento",
                "owner": self.member.pk,
                "execution_count": 5,
                "duration_seconds": 30,
                "is_lateral": True,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["execution_count"], 5)
        self.assertEqual(response.data["duration_seconds"], 30)
        self.assertTrue(response.data["is_lateral"])

    def test_cardio_exercise_fields_round_trip(self):
        plan, day = self._plan("cardio", [])
        run = Exercise.objects.create(
            name="Corrida", category="cardio", owner=self.member
        )
        response = self.client.post(
            reverse("workout-exercise-list-create"),
            {
                "workout_day": day.pk,
                "exercise": run.pk,
                "name": "Corrida",
                "owner": self.member.pk,
                "avg_speed": "9.5",
                "incline_percent": "1.5",
                "duration_seconds": 1800,
                "has_speed_intervals": True,
                "interval_seconds": 60,
                "interval_count": 8,
                "interval_speed_high": "14.0",
                "interval_speed_low": "6.0",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["avg_speed"], "9.5")
        self.assertEqual(response.data["incline_percent"], "1.5")
        self.assertEqual(response.data["duration_seconds"], 1800)
        self.assertTrue(response.data["has_speed_intervals"])
        self.assertEqual(response.data["interval_seconds"], 60)
        self.assertEqual(response.data["interval_count"], 8)
        self.assertEqual(response.data["interval_speed_high"], "14.0")
        self.assertEqual(response.data["interval_speed_low"], "6.0")


class WorkoutPlanUniqueNameTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="wk_unique", email="wku@test.com", password="testpass123"
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="WKU User",
            document_hash="u" * 64,
            phone="11999999934",
            sex="M",
            user=self.user,
        )
        self.plan = WorkoutPlan.objects.create(
            name="Hipertrofia", category="resistance", owner=self.member
        )

    def _create(self, name, category="resistance"):
        return self.client.post(
            reverse("workout-plan-list-create"),
            {"name": name, "category": category, "owner": self.member.pk},
        )

    def test_rejects_same_name_and_category_ignoring_case_and_spaces(self):
        response = self._create("  hipertrofia ")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_allows_same_name_in_other_category(self):
        response = self._create("Hipertrofia", category="cardio")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_allows_name_of_deleted_plan(self):
        self.plan.is_deleted = True
        self.plan.deleted_at = timezone.now()
        self.plan.save()
        response = self._create("Hipertrofia")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rejects_rename_to_existing_plan(self):
        other = WorkoutPlan.objects.create(
            name="Força", category="resistance", owner=self.member
        )
        url = reverse("workout-plan-detail", args=[other.pk])
        response = self.client.patch(url, {"name": "HIPERTROFIA"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_allows_saving_plan_with_its_own_name(self):
        url = reverse("workout-plan-detail", args=[self.plan.pk])
        response = self.client.patch(
            url, {"name": "Hipertrofia", "is_active": False}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
