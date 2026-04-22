"""
Tests for personal_planning improvements:
- avoid_habit goal type calculation
- Goal deadline field
- RoutineTask priority and allowed_skips_per_month
- Analytics endpoint
- Corrected signal behavior
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
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.member = Member.objects.create(
            name="Imp User",
            document_hash="i" * 64,
            phone="11999999991",
            sex="M",
            user=self.user,
        )


class GoalDeadlineTest(BasePlanningImprovementsTestCase):
    def setUp(self):
        super().setUp()
        self.goal = Goal.objects.create(
            title="Deadline Goal",
            goal_type="total_days",
            target_value=30,
            start_date=now().date(),
            owner=self.member,
        )

    def test_goal_can_be_created_with_deadline(self):
        deadline = now().date() + timedelta(days=30)
        url = "/api/v1/personal-planning/goals/"
        data = {
            "title": "Goal with Deadline",
            "goal_type": "total_days",
            "target_value": 30,
            "start_date": now().date().isoformat(),
            "deadline": deadline.isoformat(),
            "status": "active",
            "owner": self.member.id,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_goal_list_includes_deadline_and_days_until_deadline(self):
        deadline = now().date() + timedelta(days=10)
        self.goal.deadline = deadline
        self.goal.save()

        response = self.client.get("/api/v1/personal-planning/goals/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        goal_data = response.data["results"][0]
        self.assertEqual(goal_data["deadline"], deadline.isoformat())
        self.assertEqual(goal_data["days_until_deadline"], 10)

    def test_days_until_deadline_none_when_no_deadline(self):
        response = self.client.get("/api/v1/personal-planning/goals/")
        goal_data = response.data["results"][0]
        self.assertIsNone(goal_data["days_until_deadline"])

    def test_days_until_deadline_negative_when_overdue(self):
        self.goal.deadline = now().date() - timedelta(days=5)
        self.goal.save()

        response = self.client.get("/api/v1/personal-planning/goals/")
        goal_data = response.data["results"][0]
        self.assertEqual(goal_data["days_until_deadline"], -5)


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
        # No completions at all → all scheduled days count as clean
        value = self.goal.calculated_current_value
        # Since 5 days have passed (all daily, no completions), value should be 5
        self.assertGreaterEqual(value, 5)

    def test_avoid_habit_resets_when_task_completed(self):
        # Complete the task today — streak should break
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
        # Today the habit was done — streak = 0
        self.assertEqual(value, 0)

    def test_avoid_habit_not_completed_by_signal(self):
        # Completing the related task should NOT mark avoid_habit goal as completed
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
        response = self.client.post("/api/v1/personal-planning/routine-tasks/", data)
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
        from personal_planning.services.instance_generator import InstanceGenerator

        instances = InstanceGenerator.generate_for_date(self.member, now().date())
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
        # No instances → insights should be an empty list
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
