"""
Tests for personal_planning improvements:
- avoid_habit goal type calculation
- RoutineTask priority and allowed_skips_per_month
- Analytics endpoint
- Corrected signal behavior
- GoalRestartView and GoalRegisterFailureView
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.utils.timezone import now
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import (
    Goal,
    GoalFailure,
    RoutineTask,
    TaskInstance,
)


class BasePlanningImprovementsTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="impuser", email="imp@test.com", password="pass"
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Imp User",
            document_hash="i" * 64,
            phone="11999999991",
            sex="M",
            user=self.user,
        )


class GoalAvoidHabitTest(BasePlanningImprovementsTestCase):
    def setUp(self):
        super().setUp()
        self.task = RoutineTask.objects.create(
            name="Alcohol",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        self.goal = Goal.objects.create(
            title="Avoid Alcohol",
            goal_type="avoid_habit",
            related_task=self.task,
            target_value=30,
            start_date=now().date() - timedelta(days=5),
            owner=self.member,
        )

    def test_avoid_habit_counts_days_without_completion(self):
        value = self.goal.calculated_current_value
        self.assertGreaterEqual(value, 5)

    def test_avoid_habit_resets_when_task_completed(self):
        TaskInstance.objects.create(
            template=self.task,
            task_name=self.task.name,
            category=self.task.category,
            scheduled_date=now().date(),
            occurrence_index=0,
            status="completed",
            owner=self.member,
        )
        value = self.goal.calculated_current_value
        self.assertEqual(value, 0)

    def test_avoid_habit_not_completed_by_signal(self):
        instance = TaskInstance.objects.create(
            template=self.task,
            task_name=self.task.name,
            category=self.task.category,
            scheduled_date=now().date(),
            occurrence_index=0,
            status="pending",
            owner=self.member,
        )
        instance.status = "completed"
        instance.save()

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.status, "active")


class GoalNoDeadlineFieldTest(BasePlanningImprovementsTestCase):
    def test_goal_created_without_deadline_field(self):
        url = "/api/v1/personal-planning/goals/"
        data = {
            "title": "Goal Without Deadline",
            "goal_type": "total_days",
            "target_value": 30,
            "start_date": now().date().isoformat(),
            "status": "active",
            "owner": self.member.id,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("deadline", response.data)
        self.assertNotIn("days_until_deadline", response.data)

    def test_goal_list_does_not_include_deadline_fields(self):
        Goal.objects.create(
            title="Test Goal",
            goal_type="total_days",
            target_value=10,
            start_date=now().date(),
            owner=self.member,
        )
        response = self.client.get("/api/v1/personal-planning/goals/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        goal_data = response.data["results"][0]
        self.assertNotIn("deadline", goal_data)
        self.assertNotIn("days_until_deadline", goal_data)


class RoutineTaskPriorityTest(BasePlanningImprovementsTestCase):
    def test_routine_task_created_with_priority(self):
        data = {
            "name": "High Priority Task",
            "category": "health",
            "periodicity": "daily",
            "is_active": True,
            "target_quantity": 1,
            "unit": "vez",
            "daily_occurrences": 1,
            "priority": "high",
            "allowed_skips_per_month": 2,
            "owner": self.member.id,
        }
        response = self.client.post(
            "/api/v1/personal-planning/routine-tasks/", data
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_routine_task_default_priority_is_medium(self):
        task = RoutineTask.objects.create(
            name="Default Priority Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        self.assertEqual(task.priority, "medium")
        self.assertEqual(task.allowed_skips_per_month, 0)

    def test_routine_task_list_includes_priority_fields(self):
        RoutineTask.objects.create(
            name="Priority Task",
            category="health",
            periodicity="daily",
            priority="critical",
            allowed_skips_per_month=3,
            owner=self.member,
        )
        response = self.client.get("/api/v1/personal-planning/routine-tasks/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_data = response.data["results"][0]
        self.assertEqual(task_data["priority"], "critical")
        self.assertEqual(task_data["allowed_skips_per_month"], 3)
        self.assertIn("priority_display", task_data)


class TaskInstancePrioritySnapshotTest(BasePlanningImprovementsTestCase):
    def test_instance_snapshots_priority_from_template(self):
        task = RoutineTask.objects.create(
            name="High Priority Habit",
            category="health",
            periodicity="daily",
            priority="high",
            owner=self.member,
        )
        from personal_planning.services.instance_generator import (
            InstanceGenerator,
        )

        instances = InstanceGenerator.generate_for_date(
            self.member, now().date()
        )
        task_instances = [i for i in instances if i.template_id == task.id]
        self.assertTrue(len(task_instances) > 0)
        self.assertEqual(task_instances[0].priority, "high")


class AnalyticsEndpointTest(BasePlanningImprovementsTestCase):
    def test_analytics_returns_200(self):
        response = self.client.get("/api/v1/personal-planning/analytics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_analytics_returns_expected_keys(self):
        response = self.client.get("/api/v1/personal-planning/analytics/")
        data = response.data
        self.assertIn("period_days", data)
        self.assertIn("completion_by_weekday", data)
        self.assertIn("insights", data)
        self.assertEqual(data["period_days"], 90)

    def test_analytics_completion_by_weekday_has_7_entries(self):
        response = self.client.get("/api/v1/personal-planning/analytics/")
        weekday_data = response.data["completion_by_weekday"]
        self.assertEqual(len(weekday_data), 7)
        for item in weekday_data:
            self.assertIn("weekday", item)
            self.assertIn("weekday_display", item)
            self.assertIn("total", item)
            self.assertIn("completed", item)
            self.assertIn("rate", item)

    def test_analytics_requires_authentication(self):
        self.client.credentials()
        response = self.client.get("/api/v1/personal-planning/analytics/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_analytics_insights_list_when_no_data(self):
        response = self.client.get("/api/v1/personal-planning/analytics/")
        self.assertIsInstance(response.data["insights"], list)


class GoalRecalculateImprovedTest(BasePlanningImprovementsTestCase):
    def setUp(self):
        super().setUp()
        self.task = RoutineTask.objects.create(
            name="Recalc Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )

    def test_recalculate_available_for_total_days_goal(self):
        goal = Goal.objects.create(
            title="Total Days Goal",
            goal_type="total_days",
            related_task=self.task,
            target_value=10,
            start_date=now().date(),
            owner=self.member,
        )
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{goal.id}/recalculate/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_recalculate_available_for_avoid_habit_goal(self):
        goal = Goal.objects.create(
            title="Avoid Goal",
            goal_type="avoid_habit",
            related_task=self.task,
            target_value=10,
            start_date=now().date(),
            owner=self.member,
        )
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{goal.id}/recalculate/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_recalculate_not_available_for_custom_goal(self):
        goal = Goal.objects.create(
            title="Custom Goal",
            goal_type="custom",
            target_value=10,
            start_date=now().date(),
            owner=self.member,
        )
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{goal.id}/recalculate/"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class GoalRestartViewTest(BasePlanningImprovementsTestCase):
    def setUp(self):
        super().setUp()
        self.goal = Goal.objects.create(
            title="Restart Test Goal",
            goal_type="consecutive_days",
            target_value=30,
            start_date=now().date() - timedelta(days=10),
            owner=self.member,
        )

    def test_restart_returns_200(self):
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_restart_sets_progress_to_zero(self):
        self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_value, 0)
        self.assertEqual(self.goal.days_active, 0)

    def test_restart_sets_status_active(self):
        self.goal.status = "failed"
        self.goal.save()
        self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.status, "active")

    def test_restart_recomputes_end_date_from_tomorrow(self):
        # end_date nao e mais um campo manual para os tipos automaticos:
        # e sempre start_date + target_value dias enquanto o objetivo
        # estiver ativo. Apos o restart, start_date vira amanha.
        self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.goal.refresh_from_db()
        tomorrow = now().date() + timedelta(days=1)
        self.assertEqual(self.goal.start_date, tomorrow)
        self.assertEqual(
            self.goal.end_date,
            tomorrow + timedelta(days=self.goal.target_value),
        )

    def test_restart_calculated_current_value_is_zero(self):
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.assertEqual(response.data["calculated_current_value"], 0)
        self.assertEqual(response.data["progress_percentage"], 0.0)

    def test_restart_requires_authentication(self):
        self.client.credentials()
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_restart_returns_404_for_other_user_goal(self):
        other_user = User.objects.create_superuser(
            username="other2", email="other2@test.com", password="pass"
        )
        other_member = Member.objects.create(
            name="Other",
            document_hash="z" * 64,
            phone="11888888882",
            sex="M",
            user=other_user,
        )
        other_goal = Goal.objects.create(
            title="Other Goal",
            goal_type="consecutive_days",
            target_value=10,
            start_date=now().date(),
            owner=other_member,
        )
        response = self.client.post(
            f"/api/v1/personal-planning/goals/{other_goal.id}/restart/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class GoalRegisterFailureViewTest(BasePlanningImprovementsTestCase):
    def setUp(self):
        super().setUp()
        self.goal = Goal.objects.create(
            title="Failure Test Goal",
            goal_type="consecutive_days",
            target_value=30,
            start_date=now().date() - timedelta(days=15),
            owner=self.member,
        )
        self.failure_url = (
            f"/api/v1/personal-planning/goals/"
            f"{self.goal.id}/register-failure/"
        )

    def test_register_failure_returns_200(self):
        failure_date = (now().date() - timedelta(days=5)).isoformat()
        response = self.client.post(
            self.failure_url,
            {"failure_date": failure_date},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_register_failure_resets_start_date_to_today(self):
        # Para os tipos automaticos, end_date agora e sempre derivado
        # (start_date + target_value) — o objetivo sempre tem um prazo.
        # Registrar uma falha reinicia a contagem a partir de hoje, nao
        # da data da falha, recalculando a meta para os dias restantes.
        failure_date = now().date() - timedelta(days=5)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.start_date, now().date())

    def test_register_failure_resets_current_value(self):
        self.goal.current_value = 100
        self.goal.save()
        failure_date = (now().date() - timedelta(days=3)).isoformat()
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_value, 0)

    def test_register_failure_rejects_future_date(self):
        future_date = (now().date() + timedelta(days=1)).isoformat()
        response = self.client.post(
            self.failure_url,
            {"failure_date": future_date},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_failure_requires_failure_date(self):
        response = self.client.post(
            self.failure_url,
            {},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_failure_rejects_invalid_date_format(self):
        response = self.client.post(
            self.failure_url,
            {"failure_date": "31/12/2025"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_failure_reactivates_completed_goal(self):
        self.goal.status = "completed"
        self.goal.end_date = now().date()
        self.goal.save()
        failure_date = now().date() - timedelta(days=2)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.status, "active")
        # end_date nao e mais um campo manual para os tipos automaticos:
        # ao reativar, e recalculado como failure_date + target_value dias
        # em vez de ficar nulo.
        self.assertEqual(
            self.goal.end_date,
            failure_date + timedelta(days=self.goal.target_value),
        )

    def test_register_failure_requires_authentication(self):
        self.client.credentials()
        response = self.client.post(
            self.failure_url,
            {"failure_date": now().date().isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_failure_creates_failure_record(self):
        failure_date = now().date() - timedelta(days=4)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        failure = GoalFailure.objects.get(goal=self.goal)
        self.assertEqual(failure.failure_date, failure_date)

    def test_register_failure_updates_best_streak(self):
        # start_date is 15 days ago, sem tarefa relacionada -> streak =
        # min(days_active, target_value) = 15
        failure_date = now().date() - timedelta(days=2)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.best_streak, 15)

    def test_register_failure_best_streak_keeps_higher_previous_record(self):
        self.goal.best_streak = 50
        self.goal.save(update_fields=["best_streak"])
        failure_date = now().date() - timedelta(days=2)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.best_streak, 50)


class GoalRegisterFailureDeadlineTest(BasePlanningImprovementsTestCase):
    """
    Quando o objetivo tem end_date (prazo fixo) definido, registrar uma
    falha deve reiniciar a contagem a partir de hoje e recalcular a meta
    como os dias restantes ate o prazo original, preservando end_date.
    """

    def setUp(self):
        super().setUp()
        self.today = now().date()
        self.deadline = self.today + timedelta(days=29)
        self.goal = Goal.objects.create(
            title="Deadline Goal",
            goal_type="consecutive_days",
            target_value=45,
            start_date=self.today - timedelta(days=16),
            end_date=self.deadline,
            owner=self.member,
        )
        self.failure_url = (
            f"/api/v1/personal-planning/goals/"
            f"{self.goal.id}/register-failure/"
        )

    def test_register_failure_resets_start_date_to_today(self):
        failure_date = self.today - timedelta(days=6)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.start_date, self.today)

    def test_register_failure_recalculates_target_from_deadline(self):
        failure_date = self.today - timedelta(days=6)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.target_value, 29)

    def test_register_failure_preserves_end_date(self):
        failure_date = self.today - timedelta(days=6)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.end_date, self.deadline)

    def test_register_failure_deadline_already_passed_floors_target_at_one(
        self,
    ):
        # end_date nao e mais editavel diretamente: para simular um prazo
        # ja vencido, empurra-se start_date para tras o suficiente para
        # que start_date + target_value fique no passado.
        self.goal.start_date = self.today - timedelta(days=50)
        self.goal.save(update_fields=["start_date"])
        self.assertLess(self.goal.end_date, self.today)
        failure_date = self.today - timedelta(days=1)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.target_value, 1)
        self.assertEqual(self.goal.start_date, self.today)


class GoalRegisterFailureCustomTypeTest(BasePlanningImprovementsTestCase):
    """
    Objetivos do tipo "custom" nao tem end_date auto-computado, entao
    register-failure continua reiniciando a contagem a partir da propria
    data da falha (comportamento anterior, ainda valido para esse tipo).
    """

    def setUp(self):
        super().setUp()
        self.goal = Goal.objects.create(
            title="Custom Failure Goal",
            goal_type="custom",
            target_value=100,
            current_value=40,
            start_date=now().date() - timedelta(days=15),
            owner=self.member,
        )
        self.failure_url = (
            f"/api/v1/personal-planning/goals/"
            f"{self.goal.id}/register-failure/"
        )

    def test_register_failure_uses_failure_date_as_start_date(self):
        failure_date = now().date() - timedelta(days=5)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.start_date, failure_date)
        self.assertIsNone(self.goal.end_date)


class GoalEvaluateCompletionTest(BasePlanningImprovementsTestCase):
    def test_calculated_current_value_is_capped_at_target(self):
        goal = Goal.objects.create(
            title="No Related Task Goal",
            goal_type="consecutive_days",
            target_value=5,
            start_date=now().date() - timedelta(days=30),
            owner=self.member,
        )
        # days_active (30) ultrapassa target_value (5) de longe.
        self.assertEqual(goal.calculated_current_value, 5)

    def test_evaluate_completion_marks_goal_completed(self):
        goal = Goal.objects.create(
            title="Auto Complete Goal",
            goal_type="consecutive_days",
            target_value=5,
            start_date=now().date() - timedelta(days=10),
            owner=self.member,
        )
        completed = goal.evaluate_completion()
        goal.refresh_from_db()
        self.assertTrue(completed)
        self.assertEqual(goal.status, "completed")
        self.assertEqual(goal.end_date, now().date())
        self.assertEqual(goal.best_streak, 5)

    def test_evaluate_completion_updates_best_streak_without_completing(self):
        goal = Goal.objects.create(
            title="In Progress Goal",
            goal_type="consecutive_days",
            target_value=20,
            start_date=now().date() - timedelta(days=7),
            owner=self.member,
        )
        completed = goal.evaluate_completion()
        goal.refresh_from_db()
        self.assertFalse(completed)
        self.assertEqual(goal.status, "active")
        self.assertEqual(goal.best_streak, 7)

    def test_evaluate_completion_skips_custom_goal_type(self):
        goal = Goal.objects.create(
            title="Custom Goal",
            goal_type="custom",
            target_value=5,
            current_value=5,
            start_date=now().date() - timedelta(days=10),
            owner=self.member,
        )
        completed = goal.evaluate_completion()
        goal.refresh_from_db()
        self.assertFalse(completed)
        self.assertEqual(goal.status, "active")


class GoalAutoEndDateTest(BasePlanningImprovementsTestCase):
    """
    end_date nao e mais um campo que o usuario preenche para os tipos de
    contagem automatica (dias consecutivos, total de dias, evitar
    habito): e sempre derivado de start_date + target_value dias enquanto
    o objetivo estiver ativo.
    """

    def test_end_date_computed_on_create(self):
        start = now().date()
        goal = Goal.objects.create(
            title="Auto End Date",
            goal_type="consecutive_days",
            target_value=21,
            start_date=start,
            owner=self.member,
        )
        self.assertEqual(goal.end_date, start + timedelta(days=21))

    def test_end_date_recomputes_when_target_value_changes(self):
        goal = Goal.objects.create(
            title="Auto End Date Target Change",
            goal_type="total_days",
            target_value=10,
            start_date=now().date(),
            owner=self.member,
        )
        goal.target_value = 40
        goal.save()
        self.assertEqual(goal.end_date, goal.start_date + timedelta(days=40))

    def test_end_date_recomputes_when_start_date_changes(self):
        goal = Goal.objects.create(
            title="Auto End Date Start Change",
            goal_type="avoid_habit",
            target_value=15,
            start_date=now().date(),
            owner=self.member,
        )
        new_start = now().date() + timedelta(days=3)
        goal.start_date = new_start
        goal.save()
        self.assertEqual(goal.end_date, new_start + timedelta(days=15))

    def test_end_date_ignores_manually_supplied_value(self):
        start = now().date()
        goal = Goal.objects.create(
            title="Auto End Date Manual Override Attempt",
            goal_type="consecutive_days",
            target_value=10,
            start_date=start,
            end_date=start + timedelta(days=999),
            owner=self.member,
        )
        self.assertEqual(goal.end_date, start + timedelta(days=10))

    def test_end_date_not_auto_computed_for_custom_goal_type(self):
        goal = Goal.objects.create(
            title="Custom Type No Auto End Date",
            goal_type="custom",
            target_value=100,
            start_date=now().date(),
            owner=self.member,
        )
        self.assertIsNone(goal.end_date)

    def test_end_date_frozen_after_completion(self):
        goal = Goal.objects.create(
            title="Freeze End Date On Complete",
            goal_type="consecutive_days",
            target_value=3,
            start_date=now().date() - timedelta(days=5),
            owner=self.member,
        )
        goal.evaluate_completion()
        goal.refresh_from_db()
        self.assertEqual(goal.status, "completed")
        self.assertEqual(goal.end_date, now().date())


class GoalStartDateProgressTest(BasePlanningImprovementsTestCase):
    """
    Cobre o comportamento esperado ao definir start_date no futuro ou no
    passado para objetivos sem tarefa relacionada (progresso calculado a
    partir do tempo decorrido).
    """

    def test_future_start_date_yields_zero_progress(self):
        goal = Goal.objects.create(
            title="Future Start",
            goal_type="total_days",
            target_value=10,
            start_date=now().date() + timedelta(days=5),
            owner=self.member,
        )
        self.assertEqual(goal.calculated_current_value, 0)

    def test_retroactive_start_date_adds_elapsed_days_immediately(self):
        goal = Goal.objects.create(
            title="Retroactive Start",
            goal_type="total_days",
            target_value=30,
            start_date=now().date() - timedelta(days=12),
            owner=self.member,
        )
        self.assertEqual(goal.calculated_current_value, 12)

    def test_progress_does_not_jump_to_full_target_on_creation(self):
        # Regressao: como end_date agora e sempre auto-computado como
        # start_date + target_value, calculated_current_value NAO pode
        # usar (end_date - start_date) para medir progresso de um
        # objetivo ativo — isso faria o progresso aparecer 100% completo
        # imediatamente na criacao, independente do tempo decorrido.
        goal = Goal.objects.create(
            title="No Instant Full Progress",
            goal_type="total_days",
            target_value=10,
            start_date=now().date(),
            owner=self.member,
        )
        self.assertEqual(goal.calculated_current_value, 0)


class CheckGoalCompletionsTaskTest(BasePlanningImprovementsTestCase):
    def test_task_completes_eligible_goal_without_related_task(self):
        from personal_planning.tasks import check_goal_completions

        goal = Goal.objects.create(
            title="Periodic Task Goal",
            goal_type="consecutive_days",
            target_value=5,
            start_date=now().date() - timedelta(days=10),
            owner=self.member,
        )
        result = check_goal_completions.run()
        goal.refresh_from_db()
        self.assertEqual(goal.status, "completed")
        self.assertEqual(result["completed"], 1)

    def test_task_ignores_goals_not_yet_at_target(self):
        from personal_planning.tasks import check_goal_completions

        goal = Goal.objects.create(
            title="Not Ready Goal",
            goal_type="consecutive_days",
            target_value=30,
            start_date=now().date() - timedelta(days=5),
            owner=self.member,
        )
        check_goal_completions.run()
        goal.refresh_from_db()
        self.assertEqual(goal.status, "active")
