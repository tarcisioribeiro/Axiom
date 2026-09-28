"""Hidratação + sincronização tarefa ↔ diário alimentar."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import (
    BodyMetric,
    Food,
    HydrationGoal,
    MealLog,
    MealType,
    MenuOption,
    MenuOptionIngredient,
    RoutineTask,
    TaskInstance,
    WaterLog,
    WorkoutDay,
    WorkoutPlan,
)


class BaseHydrationTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="hy_test", email="hy@test.com", password="testpass123"
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="HY User",
            document_hash="h" * 64,
            phone="11999999922",
            sex="M",
            user=self.user,
        )
        self.today = timezone.localdate()

    def _instances(self, task):
        return TaskInstance.objects.filter(
            template=task, scheduled_date=self.today
        ).order_by("occurrence_index")

    def _set_status(self, instance, new_status):
        url = reverse(
            "task-instance-status-update", kwargs={"pk": instance.pk}
        )
        response = self.client.patch(url, {"status": new_status})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class HydrationGoalTest(BaseHydrationTestCase):
    def test_get_without_goal_returns_null(self):
        response = self.client.get(reverse("hydration-goal"))
        self.assertIsNone(response.data["daily_target_ml"])

    def test_put_creates_then_replaces(self):
        url = reverse("hydration-goal")
        self.client.put(url, {"daily_target_ml": 3000})
        self.client.put(url, {"daily_target_ml": 3200})
        self.assertEqual(HydrationGoal.objects.count(), 1)
        self.assertEqual(self.client.get(url).data["daily_target_ml"], 3200)

    def test_suggestion_uses_weight_and_workout_days(self):
        BodyMetric.objects.create(
            owner=self.member, measured_at=self.today, weight_kg=80
        )
        plan = WorkoutPlan.objects.create(name="P", owner=self.member)
        for weekday in range(3):
            WorkoutDay.objects.create(
                plan=plan,
                name=f"D{weekday}",
                days_of_week=[weekday],
                default_duration_minutes=70,
                owner=self.member,
            )
        data = self.client.get(reverse("hydration-goal-suggestion")).data
        # 80 × 35 = 2800; 210 min/sem ÷ 7 = 30 min/dia → 250 ml
        self.assertEqual(data["base_ml"], 2800)
        self.assertEqual(data["exercise_ml"], 250)
        self.assertEqual(data["suggested_ml"], 3050)

    def test_suggestion_without_weight(self):
        data = self.client.get(reverse("hydration-goal-suggestion")).data
        self.assertIsNone(data["suggested_ml"])


class TaskLinkValidationTest(BaseHydrationTestCase):
    def test_link_requires_nutrition_category(self):
        meal = MealType.objects.create(name="Almoço", owner=self.member)
        payload = {
            "name": "Almoçar",
            "category": "health",
            "periodicity": "daily",
            "owner": self.member.pk,
            "linked_meal_type": meal.pk,
        }
        url = reverse("routine-task-list-create")
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("linked_meal_type", response.data)

        payload["category"] = "nutrition"
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class MealSyncTest(BaseHydrationTestCase):
    def setUp(self):
        super().setUp()
        self.meal = MealType.objects.create(name="Almoço", owner=self.member)
        self.task = RoutineTask.objects.create(
            name="Almoçar",
            category="nutrition",
            periodicity="daily",
            linked_meal_type=self.meal,
            owner=self.member,
        )

    def test_meal_log_completes_task_and_delete_reopens(self):
        response = self.client.post(
            reverse("meal-log-list-create"),
            {
                "meal_type": self.meal.pk,
                "date": self.today.isoformat(),
                "owner": self.member.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._instances(self.task)[0].status, "completed")

        self.client.delete(
            reverse("meal-log-detail", kwargs={"pk": response.data["id"]})
        )
        self.assertEqual(self._instances(self.task)[0].status, "pending")

    def test_completing_task_logs_meal_and_undo_removes_it(self):
        self.client.get(
            reverse("instances-for-date"), {"date": self.today.isoformat()}
        )
        instance = self._instances(self.task)[0]
        self._set_status(instance, "completed")
        logs = MealLog.objects.filter(meal_type=self.meal, is_deleted=False)
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs[0].task_instance, instance)

        self._set_status(instance, "pending")
        self.assertFalse(logs.exists())


class WaterSyncTest(BaseHydrationTestCase):
    def setUp(self):
        super().setUp()
        self.goal = HydrationGoal.objects.create(
            owner=self.member, daily_target_ml=3000
        )
        self.task = RoutineTask.objects.create(
            name="Água",
            category="nutrition",
            periodicity="daily",
            daily_occurrences=6,
            target_quantity=6,
            interval_hours=2,
            linked_hydration_goal=self.goal,
            owner=self.member,
        )

    def _log_water(self, ml):
        return self.client.post(
            reverse("water-log-list-create"),
            {"date": self.today.isoformat(), "amount_ml": ml},
        )

    def test_water_log_completes_covered_occurrences(self):
        self._log_water(1200)  # 1200 ÷ 500 → 2 ocorrências
        statuses = [i.status for i in self._instances(self.task)]
        self.assertEqual(len(statuses), 6)
        self.assertEqual(statuses.count("completed"), 2)

        self._log_water(400)  # total 1600 → 3
        statuses = [i.status for i in self._instances(self.task)]
        self.assertEqual(statuses.count("completed"), 3)

    def test_completing_occurrence_logs_share_without_cascade(self):
        self.client.get(
            reverse("instances-for-date"), {"date": self.today.isoformat()}
        )
        instance = self._instances(self.task)[0]
        self._set_status(instance, "completed")
        logs = WaterLog.objects.filter(is_deleted=False)
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs[0].amount_ml, 500)
        statuses = [i.status for i in self._instances(self.task)]
        self.assertEqual(statuses.count("completed"), 1)

        self._set_status(instance, "pending")
        self.assertFalse(logs.exists())

    def test_deleting_task_water_log_reopens_task(self):
        self.client.get(
            reverse("instances-for-date"), {"date": self.today.isoformat()}
        )
        instance = self._instances(self.task)[0]
        self._set_status(instance, "completed")
        log = WaterLog.objects.get(task_instance=instance)
        self.client.delete(reverse("water-log-detail", kwargs={"pk": log.pk}))
        instance.refresh_from_db()
        self.assertEqual(instance.status, "pending")

    def test_water_logs_filtered_by_date(self):
        self._log_water(300)
        WaterLog.objects.create(
            owner=self.member,
            date=self.today - timedelta(days=1),
            amount_ml=200,
        )
        response = self.client.get(
            reverse("water-log-list-create"),
            {"date": self.today.isoformat()},
        )
        self.assertEqual(response.data["count"], 1)


class MealDefaultOptionTest(BaseHydrationTestCase):
    def setUp(self):
        super().setUp()
        self.meal = MealType.objects.create(name="Almoço", owner=self.member)
        rice = Food.objects.create(
            name="Arroz",
            calories_per_serving=130,
            serving_size=100,
            serving_unit="g",
            owner=self.member,
        )
        self.light = self._option("Leve", rice, 100)  # 130 kcal
        self.heavy = self._option("Pesada", rice, 300)  # 390 kcal
        self.task = RoutineTask.objects.create(
            name="Almoçar",
            category="nutrition",
            periodicity="daily",
            linked_meal_type=self.meal,
            owner=self.member,
        )

    def _option(self, name, food, grams):
        option = MenuOption.objects.create(
            meal_type=self.meal, name=name, owner=self.member
        )
        MenuOptionIngredient.objects.create(
            menu_option=option,
            food=food,
            quantity=grams,
            unit="g",
            owner=self.member,
        )
        return option

    def _complete_task(self):
        self.client.get(
            reverse("instances-for-date"), {"date": self.today.isoformat()}
        )
        self._set_status(self._instances(self.task)[0], "completed")
        return MealLog.objects.get(meal_type=self.meal, is_deleted=False)

    def test_without_default_uses_highest_calorie_option(self):
        self.assertEqual(self._complete_task().menu_option, self.heavy)

    def test_uses_default_option(self):
        url = reverse("meal-type-detail", kwargs={"pk": self.meal.pk})
        response = self.client.patch(
            url, {"default_menu_option": self.light.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._complete_task().menu_option, self.light)

    def test_default_option_must_belong_to_meal_type(self):
        other = MealType.objects.create(name="Jantar", owner=self.member)
        url = reverse("meal-type-detail", kwargs={"pk": other.pk})
        response = self.client.patch(
            url, {"default_menu_option": self.light.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_meal_type_links_to_single_task(self):
        payload = {
            "name": "Outra",
            "category": "nutrition",
            "periodicity": "daily",
            "owner": self.member.pk,
            "linked_meal_type": self.meal.pk,
        }
        url = reverse("routine-task-list-create")
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("linked_meal_type", response.data)

        # excluir a tarefa libera a refeição
        self.task.deleted_at = timezone.now()
        self.task.save()
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
