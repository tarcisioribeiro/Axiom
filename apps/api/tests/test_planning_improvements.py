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
from personal_planning.models import Goal, RoutineTask, TaskInstance


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

    def test_restart_clears_end_date(self):
        self.goal.end_date = now().date()
        self.goal.save()
        self.client.post(
            f"/api/v1/personal-planning/goals/{self.goal.id}/restart/"
        )
        self.goal.refresh_from_db()
        self.assertIsNone(self.goal.end_date)

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

    def test_register_failure_sets_start_date(self):
        failure_date = now().date() - timedelta(days=5)
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date.isoformat()},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.start_date, failure_date)

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
        failure_date = (now().date() - timedelta(days=2)).isoformat()
        self.client.post(
            self.failure_url,
            {"failure_date": failure_date},
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.status, "active")
        self.assertIsNone(self.goal.end_date)

    def test_register_failure_requires_authentication(self):
        self.client.credentials()
        response = self.client.post(
            self.failure_url,
            {"failure_date": now().date().isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
