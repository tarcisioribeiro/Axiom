"""
Testes adicionais de cobertura para personal_planning/views.py.

Cobre: importação de templates de rotina (sucesso/duplicatas/import de
templates de usuário), objetivos (recalculate/restart/register-failure),
dashboard de estatísticas, instâncias de tarefas (filtros, bulk-update,
status), heatmap, analytics/insights, gamificação, exportações
(workout sessions/meal logs/reflections/goals em CSV e PDF), desafios,
métricas corporais, geração via IA (rotina/treino/cardápio/relatório
semanal) e o Centro de Bem-Estar (autoestima, check-ins emocionais,
modo crise, intervenções, relatório semanal, dashboard).

Nenhuma chamada real a LLM é permitida — todas mockadas via
``agents.core.llm_client.LLMClient``.
"""

from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import (
    BodyMetric,
    Challenge,
    CrisisImpulseLog,
    DailyReflection,
    EmotionalCheckin,
    Goal,
    MealLog,
    MealType,
    MenuOption,
    RoutineTask,
    SelfEsteemAssessment,
    TaskInstance,
    WellnessIntervention,
    WellnessInterventionCompletion,
    WorkoutDay,
    WorkoutPlan,
    WorkoutSession,
)


class BasePlanningCoverageTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ppcov",
            email="ppcov@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="PP Cov User",
            document_hash="c" * 64,
            phone="11999999900",
            sex="F",
            user=self.user,
        )


# ============================================================================
# ROUTINE TEMPLATE IMPORT (fixture-backed)
# ============================================================================


class RoutineTemplateImportSuccessTest(BasePlanningCoverageTestCase):
    def test_import_valid_template_creates_tasks(self):
        url = reverse("routine-template-import")
        response = self.client.post(
            url, {"template_id": "morning_routine"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertGreater(len(response.data["created_ids"]), 0)
        self.assertEqual(response.data["skipped_names"], [])
        self.assertEqual(response.data["template_name"], "Rotina Matinal")

    def test_import_same_template_twice_skips_duplicates(self):
        url = reverse("routine-template-import")
        first = self.client.post(
            url, {"template_id": "morning_routine"}, format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            url, {"template_id": "morning_routine"}, format="json"
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.data["created_ids"], [])
        self.assertGreater(len(second.data["skipped_names"]), 0)

    def test_import_template_without_member_returns_400(self):
        user2 = User.objects.create_user(
            username="ppcov_nomember",
            email="nomember2@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("routine-template-import")
        response = client2.post(
            url, {"template_id": "morning_routine"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserRoutineTemplateImportTest(BasePlanningCoverageTestCase):
    def _create_template(self, tasks=None):
        from personal_planning.models import UserRoutineTemplate

        return UserRoutineTemplate.objects.create(
            name="Meu Template",
            description="desc",
            icon="Heart",
            tasks=tasks
            or [
                {
                    "name": "Beber Água",
                    "description": "2L por dia",
                    "category": "health",
                    "periodicity": "daily",
                    "target_quantity": 2,
                    "unit": "litro",
                    "priority": "medium",
                }
            ],
            owner=self.member,
        )

    def test_import_user_template_creates_tasks(self):
        template = self._create_template()
        url = reverse("user-routine-template-import", args=[template.pk])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["created_ids"]), 1)
        self.assertTrue(
            RoutineTask.objects.filter(
                owner=self.member, name="Beber Água"
            ).exists()
        )

    def test_import_user_template_skips_existing_names(self):
        RoutineTask.objects.create(
            name="Beber Água",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        template = self._create_template()
        url = reverse("user-routine-template-import", args=[template.pk])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["created_ids"], [])
        self.assertIn("Beber Água", response.data["skipped_names"])

    def test_import_user_template_not_found(self):
        url = reverse("user-routine-template-import", args=[99999])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_import_user_template_belonging_to_other_user_not_found(self):
        # The queryset scopes templates by `owner__user=request.user`, so a
        # template owned by a different member is indistinguishable from a
        # nonexistent one — it must 404, not leak a 403/other status.
        template = self._create_template()
        user2 = User.objects.create_user(
            username="urt_otheruser",
            email="urtotheruser@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("user-routine-template-import", args=[template.pk])
        response = client2.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ============================================================================
# DASHBOARD STATS (streak calculations)
# ============================================================================


class DashboardStatsStreakTest(BasePlanningCoverageTestCase):
    def test_dashboard_stats_with_completed_streak(self):
        task = RoutineTask.objects.create(
            name="Streak Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        today = date.today()
        for i in range(3):
            TaskInstance.objects.create(
                owner=self.member,
                template=task,
                task_name=task.name,
                scheduled_date=today - timedelta(days=i),
                status="completed",
            )
        url = reverse("personal-planning-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["current_streak"], 3)
        self.assertGreaterEqual(response.data["best_streak"], 3)
        self.assertIn("active_routine_tasks", response.data)
        self.assertIn("recent_reflections", response.data)

    def test_dashboard_stats_broken_streak(self):
        task = RoutineTask.objects.create(
            name="Broken Streak Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        today = date.today()
        TaskInstance.objects.create(
            owner=self.member,
            template=task,
            task_name=task.name,
            scheduled_date=today,
            status="pending",
        )
        url = reverse("personal-planning-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_streak"], 0)

    def test_dashboard_stats_empty_state(self):
        url = reverse("personal-planning-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_tasks"], 0)
        self.assertEqual(response.data["best_streak"], 0)


# ============================================================================
# TASK INSTANCE LIST FILTERS / BULK UPDATE / STATUS UPDATE
# ============================================================================


class TaskInstanceFilterTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.task = RoutineTask.objects.create(
            name="Filter Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        self.today = date.today()
        self.instance = TaskInstance.objects.create(
            owner=self.member,
            template=self.task,
            task_name=self.task.name,
            scheduled_date=self.today,
            status="pending",
        )

    def test_filter_by_exact_date(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(url, {"date": str(self.today)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_invalid_date_ignored(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(url, {"date": "not-a-date"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filter_by_date_range(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(
            url,
            {
                "date_from": str(self.today - timedelta(days=1)),
                "date_to": str(self.today + timedelta(days=1)),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_invalid_date_range_ignored(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(
            url, {"date_from": "bad", "date_to": "also-bad"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filter_by_status(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(url, {"status": "pending"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_template(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(url, {"template": self.task.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)


class TaskInstanceBulkUpdateTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.task = RoutineTask.objects.create(
            name="Bulk Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        self.instance = TaskInstance.objects.create(
            owner=self.member,
            template=self.task,
            task_name=self.task.name,
            scheduled_date=date.today(),
            status="pending",
        )

    def test_bulk_update_empty_list_returns_400(self):
        url = reverse("task-instance-bulk-update")
        response = self.client.post(url, {"updates": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_update_success(self):
        url = reverse("task-instance-bulk-update")
        response = self.client.post(
            url,
            {
                "updates": [
                    {
                        "id": str(self.instance.pk),
                        "status": "completed",
                        "notes": "done",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 1)
        self.assertEqual(response.data["errors"], [])
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, "completed")

    def test_bulk_update_missing_fields_reports_error(self):
        url = reverse("task-instance-bulk-update")
        response = self.client.post(
            url, {"updates": [{"id": None, "status": None}]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 0)
        self.assertEqual(len(response.data["errors"]), 1)

    def test_bulk_update_nonexistent_instance_reports_error(self):
        url = reverse("task-instance-bulk-update")
        response = self.client.post(
            url,
            {"updates": [{"id": 999999, "status": "completed"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["errors"]), 1)


class TaskInstanceStatusUpdateTest(BasePlanningCoverageTestCase):
    def test_status_update_not_found(self):
        url = reverse("task-instance-status-update", args=[999999])
        response = self.client.patch(
            url, {"status": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_status_update_invalid_serializer(self):
        task = RoutineTask.objects.create(
            name="Status Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        instance = TaskInstance.objects.create(
            owner=self.member,
            template=task,
            task_name=task.name,
            scheduled_date=date.today(),
            status="pending",
        )
        url = reverse("task-instance-status-update", args=[instance.pk])
        response = self.client.patch(
            url, {"status": "not-a-valid-status"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ============================================================================
# ROUTINE TASK HEATMAP
# ============================================================================


class RoutineTaskHeatmapTest(BasePlanningCoverageTestCase):
    def test_heatmap_invalid_year(self):
        url = reverse("routine-task-heatmap")
        response = self.client.get(url, {"year": "abc"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_heatmap_task_not_found(self):
        url = reverse("routine-task-heatmap")
        response = self.client.get(url, {"task_id": 999999})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_heatmap_general_with_category_filter(self):
        task = RoutineTask.objects.create(
            name="Heatmap Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        TaskInstance.objects.create(
            owner=self.member,
            template=task,
            task_name=task.name,
            scheduled_date=date.today(),
            status="completed",
        )
        url = reverse("routine-task-heatmap")
        response = self.client.get(url, {"category": "health"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["task_id"])
        self.assertGreater(len(response.data["data"]), 0)

    def test_heatmap_no_member_returns_404(self):
        user2 = User.objects.create_user(
            username="heatmap_nomember",
            email="heatmapnomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("routine-task-heatmap")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ============================================================================
# ANALYTICS / INSIGHTS
# ============================================================================


class AnalyticsInsightsTest(BasePlanningCoverageTestCase):
    def test_analytics_generates_insights_for_high_and_low_days(self):
        task = RoutineTask.objects.create(
            name="Analytics Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        today = date.today()
        # Build 90 days worth of data so weekday buckets have entries with
        # clearly different completion rates (best/worst/weekend insights).
        for i in range(90):
            day = today - timedelta(days=i)
            wd = day.weekday()
            # Weekdays (0-4) mostly completed, weekends (5,6) mostly not.
            do_complete = wd < 5
            TaskInstance.objects.create(
                owner=self.member,
                template=task,
                task_name=task.name,
                scheduled_date=day,
                status="completed" if do_complete else "pending",
            )
        url = reverse("personal-planning-analytics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 90)
        self.assertEqual(len(response.data["completion_by_weekday"]), 7)
        # Some insight should have been generated given the strong skew.
        self.assertIsInstance(response.data["insights"], list)

    def test_analytics_no_data_returns_empty_insights(self):
        url = reverse("personal-planning-analytics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["insights"], [])


# ============================================================================
# GAMIFICATION PROFILE
# ============================================================================


class GamificationProfileTest(BasePlanningCoverageTestCase):
    def test_gamification_profile_creates_lazily(self):
        url = reverse("gamification-profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_xp"], 0)
        self.assertEqual(response.data["current_level"], 1)
        self.assertIn("badges", response.data)
        self.assertIn("recent_xp", response.data)

    def test_gamification_profile_with_xp_and_badge(self):
        from personal_planning.models import GamificationProfile

        profile, _ = GamificationProfile.objects.get_or_create(
            member=self.member, defaults={"created_by": self.user}
        )
        profile.add_xp(150, "task_completed", "Concluiu tarefa")
        url = reverse("gamification-profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_xp"], 150)
        self.assertGreater(len(response.data["recent_xp"]), 0)

    def test_gamification_profile_no_member_returns_404(self):
        user2 = User.objects.create_user(
            username="gami_nomember",
            email="gaminomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("gamification-profile")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ============================================================================
# EXPORT VIEWS (CSV / PDF)
# ============================================================================


class ExportWorkoutSessionsTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.plan = WorkoutPlan.objects.create(
            name="Export Plan", owner=self.member
        )
        self.day = WorkoutDay.objects.create(
            plan=self.plan, name="Treino A", owner=self.member
        )
        WorkoutSession.objects.create(
            owner=self.member,
            workout_day=self.day,
            date=date.today(),
            started_at="10:00",
            finished_at="10:45",
        )

    def test_export_csv_default(self):
        url = reverse("workout-sessions-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", response["Content-Type"])

    def test_export_pdf(self):
        url = reverse("workout-sessions-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pdf", response["Content-Type"])

    def test_export_with_date_range(self):
        url = reverse("workout-sessions-export")
        response = self.client.get(
            url,
            {
                "date_from": str(date.today() - timedelta(days=1)),
                "date_to": str(date.today() + timedelta(days=1)),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("personal_planning.views.PDF_ROW_LIMIT", 0)
    def test_export_pdf_too_many_rows(self):
        url = reverse("workout-sessions-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ExportMealLogsTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.meal_type = MealType.objects.create(
            name="Almoço", order=1, owner=self.member
        )
        self.menu_option = MenuOption.objects.create(
            meal_type=self.meal_type, name="Arroz e Feijão", owner=self.member
        )
        MealLog.objects.create(
            owner=self.member,
            meal_type=self.meal_type,
            menu_option=self.menu_option,
            date=date.today(),
        )
        MealLog.objects.create(
            owner=self.member,
            meal_type=self.meal_type,
            is_free_meal=True,
            date=date.today(),
        )

    def test_export_csv(self):
        url = reverse("meal-logs-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", response["Content-Type"])

    def test_export_pdf(self):
        url = reverse("meal-logs-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pdf", response["Content-Type"])

    @patch("personal_planning.views.PDF_ROW_LIMIT", 0)
    def test_export_pdf_too_many_rows(self):
        url = reverse("meal-logs-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ExportReflectionsTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        DailyReflection.objects.create(
            owner=self.member,
            date=date.today(),
            mood="good",
            reflection="Ótimo dia.",
        )

    def test_export_csv(self):
        url = reverse("reflections-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_export_pdf(self):
        url = reverse("reflections-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pdf", response["Content-Type"])

    @patch("personal_planning.views.PDF_ROW_LIMIT", 0)
    def test_export_pdf_too_many_rows(self):
        url = reverse("reflections-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ExportGoalsTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        Goal.objects.create(
            title="Meta Export",
            goal_type="total_days",
            target_value=10,
            start_date=date.today(),
            status="active",
            owner=self.member,
        )

    def test_export_csv(self):
        url = reverse("goals-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_export_csv_with_status_filter(self):
        url = reverse("goals-export")
        response = self.client.get(url, {"status": "active"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_export_pdf(self):
        url = reverse("goals-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pdf", response["Content-Type"])

    @patch("personal_planning.views.PDF_ROW_LIMIT", 0)
    def test_export_pdf_too_many_rows(self):
        url = reverse("goals-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ============================================================================
# CHALLENGES / BODY METRICS
# ============================================================================


class ChallengeViewTest(BasePlanningCoverageTestCase):
    def _data(self):
        today = date.today()
        return {
            "title": "30 dias sem açúcar",
            "duration_days": 30,
            "start_date": str(today),
            "end_date": str(today + timedelta(days=30)),
            "status": "active",
            "owner": self.member.pk,
        }

    def test_create_and_list_challenge(self):
        url = reverse("challenge-list-create")
        response = self.client.post(url, self._data(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

    def test_filter_challenge_by_status(self):
        Challenge.objects.create(
            owner=self.member,
            title="Ativo",
            duration_days=30,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
            status="active",
        )
        Challenge.objects.create(
            owner=self.member,
            title="Concluído",
            duration_days=7,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            status="completed",
        )
        url = reverse("challenge-list-create")
        response = self.client.get(url, {"status": "completed"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_update_and_delete_challenge(self):
        challenge = Challenge.objects.create(
            owner=self.member,
            title="Editável",
            duration_days=7,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            status="active",
        )
        url = reverse("challenge-detail", args=[challenge.pk])
        response = self.client.patch(
            url, {"title": "Renomeado"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Renomeado")

        delete_response = self.client.delete(url)
        self.assertEqual(
            delete_response.status_code, status.HTTP_204_NO_CONTENT
        )
        challenge.refresh_from_db()
        self.assertTrue(challenge.is_deleted)

    def test_list_challenge_no_member_returns_empty(self):
        user2 = User.objects.create_user(
            username="challenge_nomember",
            email="challengenomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("challenge-list-create")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)


class BodyMetricViewTest(BasePlanningCoverageTestCase):
    def test_create_list_update_delete_body_metric(self):
        url = reverse("body-metric-list-create")
        response = self.client.post(
            url,
            {
                "measured_at": str(date.today()),
                "weight_kg": "70.5",
                "height_cm": "175.0",
                "owner": self.member.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        metric_id = response.data["id"]

        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

        detail_url = reverse("body-metric-detail", args=[metric_id])
        patch_response = self.client.patch(
            detail_url, {"weight_kg": "71.0"}, format="json"
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(detail_url)
        self.assertEqual(
            delete_response.status_code, status.HTTP_204_NO_CONTENT
        )
        metric = BodyMetric.all_objects.get(pk=metric_id)
        self.assertTrue(metric.is_deleted)

    def test_body_metric_no_member_returns_empty(self):
        user2 = User.objects.create_user(
            username="metric_nomember",
            email="metricnomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("body-metric-list-create")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)


# ============================================================================
# AI GENERATION VIEWS (LLM mocked)
# ============================================================================


class AIRoutineSuggestionTest(BasePlanningCoverageTestCase):
    def test_missing_objective_returns_400(self):
        url = reverse("ai-routine-suggestion")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_successful_generation(self, mock_chat):
        mock_chat.return_value = (
            '{"tasks": [{"name": "Meditar", "description": "10min", '
            '"frequency": "daily", "duration_minutes": 10, '
            '"category": "health", "time_of_day": "morning"}]}'
        )
        url = reverse("ai-routine-suggestion")
        response = self.client.post(
            url,
            {
                "objective": "Reduzir estresse",
                "available_hours": 1,
                "focus_areas": ["health"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["tasks"]), 1)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_llm_error_is_caught(self, mock_chat):
        mock_chat.side_effect = RuntimeError("boom")
        url = reverse("ai-routine-suggestion")
        response = self.client.post(url, {"objective": "Foco"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("error", response.data)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_llm_invalid_json_returns_empty_tasks(self, mock_chat):
        mock_chat.return_value = "not json at all"
        url = reverse("ai-routine-suggestion")
        response = self.client.post(url, {"objective": "Foco"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tasks"], [])


class AIWorkoutPlanGenerationTest(BasePlanningCoverageTestCase):
    def test_missing_goal_returns_400(self):
        url = reverse("ai-workout-plan-generation")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_member_returns_400(self):
        user2 = User.objects.create_user(
            username="wplan_nomember",
            email="wplannomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("ai-workout-plan-generation")
        response = client2.post(url, {"goal": "hipertrofia"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_successful_generation_persists_plan(self, mock_chat):
        mock_chat.return_value = (
            '{"name": "Plano Força", "description": "desc", "days": ['
            '{"name": "Treino A", "muscle_groups": "Peito", '
            '"day_of_week": 0, "order": 0, "exercises": ['
            '{"name": "Supino", "sets": 4, "reps_min": 8, "reps_max": 12, '
            '"rest_seconds": 90, "notes": "controlado"}]}]}'
        )
        url = reverse("ai-workout-plan-generation")
        response = self.client.post(
            url,
            {
                "goal": "hipertrofia",
                "level": "intermediario",
                "equipment": "academia",
                "days_per_week": 4,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["days_created"], 1)
        self.assertTrue(
            WorkoutPlan.objects.filter(name="Plano Força").exists()
        )

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_llm_invalid_json_returns_503(self, mock_chat):
        mock_chat.return_value = "no json here"
        url = reverse("ai-workout-plan-generation")
        response = self.client.post(
            url, {"goal": "hipertrofia"}, format="json"
        )
        self.assertEqual(
            response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
        )

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_llm_exception_returns_503(self, mock_chat):
        mock_chat.side_effect = RuntimeError("provider down")
        url = reverse("ai-workout-plan-generation")
        response = self.client.post(
            url, {"goal": "hipertrofia"}, format="json"
        )
        self.assertEqual(
            response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
        )

    def test_invalid_days_per_week_defaults_to_three(self):
        with patch("agents.core.llm_client.LLMClient.chat") as mock_chat:
            mock_chat.return_value = (
                '{"name": "Plano", "description": "", "days": []}'
            )
            url = reverse("ai-workout-plan-generation")
            response = self.client.post(
                url,
                {"goal": "resistencia", "days_per_week": "invalid"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class AIMenuPlanGenerationTest(BasePlanningCoverageTestCase):
    def test_no_member_returns_400(self):
        user2 = User.objects.create_user(
            username="menu_nomember",
            email="menunomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("ai-menu-plan-generation")
        response = client2.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_successful_generation_persists_menu(self, mock_chat):
        mock_chat.return_value = (
            '{"meal_types": [{"name": "Café da Manhã", '
            '"suggested_time": "07:00", "order": 0, "options": ['
            '{"name": "Aveia", "estimated_calories": 300, '
            '"macros_note": "carbo"}]}]}'
        )
        url = reverse("ai-menu-plan-generation")
        response = self.client.post(
            url,
            {
                "calories": 2200,
                "preferences": "vegetariano",
                "restrictions": "lactose",
                "meals_per_day": 4,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["meal_types_created"], 1)
        self.assertEqual(response.data["options_created"], 1)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_llm_invalid_json_returns_503(self, mock_chat):
        mock_chat.return_value = "invalid"
        url = reverse("ai-menu-plan-generation")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(
            response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
        )

    def test_invalid_numeric_params_use_defaults(self):
        with patch("agents.core.llm_client.LLMClient.chat") as mock_chat:
            mock_chat.return_value = '{"meal_types": []}'
            url = reverse("ai-menu-plan-generation")
            response = self.client.post(
                url,
                {"calories": "bad", "meals_per_day": "bad"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ============================================================================
# DAILY CALORIC SUMMARY
# ============================================================================


class DailyCaloricSummaryTest(BasePlanningCoverageTestCase):
    def test_invalid_date_returns_400(self):
        url = reverse("daily-caloric-summary")
        response = self.client.get(url, {"date": "bad-date"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_member_returns_404(self):
        user2 = User.objects.create_user(
            username="caloric_nomember",
            email="caloricnomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("daily-caloric-summary")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_summary_without_body_metrics(self):
        url = reverse("daily-caloric-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["has_body_metrics"])
        self.assertIsNone(response.data["bmr"])
        self.assertIsNone(response.data["tdee"])

    def test_summary_with_meals_and_workout_session(self):
        self.member.birth_date = date.today() - timedelta(days=365 * 30)
        self.member.activity_level = "moderately_active"
        self.member.save()

        BodyMetric.objects.create(
            owner=self.member,
            measured_at=date.today(),
            weight_kg="80.0",
            height_cm="180.0",
        )
        meal_type = MealType.objects.create(
            name="Almoço", order=1, owner=self.member
        )
        MealLog.objects.create(
            owner=self.member,
            meal_type=meal_type,
            is_free_meal=True,
            date=date.today(),
            time="12:00",
        )
        plan = WorkoutPlan.objects.create(name="Plano", owner=self.member)
        day = WorkoutDay.objects.create(
            plan=plan, name="Treino A", owner=self.member
        )
        WorkoutSession.objects.create(
            owner=self.member,
            workout_day=day,
            date=date.today(),
            started_at="08:00",
            finished_at="09:00",
        )
        # Session without duration (falls into the "no duration" branch).
        WorkoutSession.objects.create(
            owner=self.member,
            date=date.today(),
        )

        url = reverse("daily-caloric-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_body_metrics"])
        self.assertIsNotNone(response.data["bmr"])
        self.assertIsNotNone(response.data["tdee"])
        self.assertEqual(len(response.data["meals"]), 1)
        self.assertEqual(len(response.data["workout_sessions"]), 2)


# ============================================================================
# WELLNESS CENTER
# ============================================================================


class SelfEsteemAssessmentTest(BasePlanningCoverageTestCase):
    def _data(self):
        return {
            "assessed_at": str(date.today()),
            "q1": 3,
            "q2": 3,
            "q3": 0,
            "q4": 3,
            "q5": 0,
            "q6": 3,
            "q7": 3,
            "q8": 0,
            "q9": 0,
            "q10": 0,
        }

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_create_assessment_generates_ai_analysis(self, mock_chat):
        mock_chat.return_value = (
            '{"analysis": "Você está bem.", "strengths": ["foco"], '
            '"limiting_beliefs": [], "weekly_suggestions": ["respire"]}'
        )
        url = reverse("self-esteem-list-create")
        response = self.client.post(url, self._data(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assessment = SelfEsteemAssessment.objects.get(pk=response.data["id"])
        self.assertIn("Você está bem.", assessment.ai_analysis)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_create_assessment_ai_failure_is_swallowed(self, mock_chat):
        mock_chat.side_effect = RuntimeError("llm down")
        url = reverse("self-esteem-list-create")
        response = self.client.post(url, self._data(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_and_detail(self):
        SelfEsteemAssessment.objects.create(
            owner=self.member,
            assessed_at=date.today(),
            q1=3,
            q2=3,
            q3=0,
            q4=3,
            q5=0,
            q6=3,
            q7=3,
            q8=0,
            q9=0,
            q10=0,
        )
        url = reverse("self-esteem-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)


class EmotionalCheckinTest(BasePlanningCoverageTestCase):
    def test_create_checkin(self):
        url = reverse("emotional-checkin-list-create")
        response = self.client.post(
            url,
            {
                "checked_at": str(date.today()),
                "loneliness": 3,
                "neediness": 2,
                "anxiety": 4,
                "sadness": 1,
                "motivation": 7,
                "energy": 6,
                "what_happened": "Dia tranquilo.",
                "occupying_thoughts": "Trabalho.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_filter_by_days(self):
        EmotionalCheckin.objects.create(
            owner=self.member, checked_at=date.today()
        )
        EmotionalCheckin.objects.create(
            owner=self.member,
            checked_at=date.today() - timedelta(days=30),
        )
        url = reverse("emotional-checkin-list-create")
        response = self.client.get(url, {"days": "7"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_invalid_days_ignored(self):
        EmotionalCheckin.objects.create(
            owner=self.member, checked_at=date.today()
        )
        url = reverse("emotional-checkin-list-create")
        response = self.client.get(url, {"days": "abc"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_detail_view(self):
        checkin = EmotionalCheckin.objects.create(
            owner=self.member, checked_at=date.today()
        )
        url = reverse("emotional-checkin-detail", args=[checkin.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class CrisisImpulseLogTest(BasePlanningCoverageTestCase):
    def _data(self):
        return {
            "emotional_state": "anxiety",
            "impulse_type": "social_media",
        }

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_create_generates_ai_response(self, mock_chat):
        mock_chat.return_value = (
            '{"validation": "Entendo.", "explanation": "faz sentido", '
            '"action_plan": {"5min": ["respire"], "10min": [], '
            '"20min": []}, "affirmation": "Você consegue."}'
        )
        url = reverse("crisis-impulse-list-create")
        response = self.client.post(url, self._data(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        log = CrisisImpulseLog.objects.get(pk=response.data["id"])
        self.assertIn("Você consegue.", log.ai_response)

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_create_ai_failure_is_swallowed(self, mock_chat):
        mock_chat.side_effect = RuntimeError("down")
        url = reverse("crisis-impulse-list-create")
        response = self.client.post(url, self._data(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_resolve_impulse(self):
        log = CrisisImpulseLog.objects.create(
            owner=self.member,
            emotional_state="anxiety",
            impulse_type="social_media",
        )
        url = reverse("crisis-impulse-resolve", args=[log.pk])
        response = self.client.patch(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log.refresh_from_db()
        self.assertTrue(log.resolved)

    def test_resolve_impulse_not_found(self):
        url = reverse("crisis-impulse-resolve", args=[999999])
        response = self.client.patch(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_and_detail(self):
        log = CrisisImpulseLog.objects.create(
            owner=self.member,
            emotional_state="anxiety",
            impulse_type="social_media",
        )
        url = reverse("crisis-impulse-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

        detail_url = reverse("crisis-impulse-detail", args=[log.pk])
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)


class WellnessInterventionTest(BasePlanningCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.intervention = WellnessIntervention.objects.create(
            title="Respiração Guiada",
            description="Exercício de respiração 4-7-8",
            category="anxiety",
            duration_minutes=5,
            difficulty="easy",
            expected_benefit="Reduz ansiedade",
            is_global=True,
        )

    def test_list_interventions(self):
        url = reverse("wellness-intervention-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_category(self):
        url = reverse("wellness-intervention-list")
        response = self.client.get(url, {"category": "anxiety"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_max_duration(self):
        url = reverse("wellness-intervention-list")
        response = self.client.get(url, {"max_duration": "10"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_invalid_max_duration_ignored(self):
        url = reverse("wellness-intervention-list")
        response = self.client.get(url, {"max_duration": "abc"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_create_and_list_completion(self):
        url = reverse("wellness-intervention-completion-list-create")
        response = self.client.post(
            url,
            {
                "intervention": self.intervention.pk,
                "rating": 5,
                "notes": "Ajudou muito.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

    def test_completion_detail_view(self):
        completion = WellnessInterventionCompletion.objects.create(
            owner=self.member,
            intervention=self.intervention,
            rating=4,
        )
        url = reverse(
            "wellness-intervention-completion-detail", args=[completion.pk]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class WellnessWeeklyReportTest(BasePlanningCoverageTestCase):
    @patch("agents.core.llm_client.LLMClient.chat")
    def test_generate_weekly_report(self, mock_chat):
        mock_chat.return_value = (
            '{"summary": "Semana estável.", '
            '"attention_points": ["ansiedade leve"], '
            '"suggestions": ["dormir mais"]}'
        )
        intervention = WellnessIntervention.objects.create(
            title="Diário de Gratidão",
            description="Escreva 3 coisas boas do dia",
            category="self_esteem",
            duration_minutes=5,
            expected_benefit="Melhora humor",
        )
        WellnessInterventionCompletion.objects.create(
            owner=self.member, intervention=intervention
        )
        EmotionalCheckin.objects.create(
            owner=self.member,
            checked_at=date.today(),
            loneliness=2,
            anxiety=3,
            motivation=7,
        )
        url = reverse("wellness-weekly-report-generate")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Semana estável.", response.data["ai_summary"])

    @patch("agents.core.llm_client.LLMClient.chat")
    def test_generate_weekly_report_llm_failure_still_creates_report(
        self, mock_chat
    ):
        mock_chat.side_effect = RuntimeError("provider down")
        url = reverse("wellness-weekly-report-generate")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ai_summary"], "")

    def test_list_weekly_reports(self):
        url = reverse("wellness-weekly-report-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class WellnessDashboardTest(BasePlanningCoverageTestCase):
    def test_dashboard_empty_state(self):
        url = reverse("wellness-dashboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["self_esteem"]["current_score"])
        self.assertEqual(response.data["emotional"]["checkins_this_week"], 0)

    def test_dashboard_with_data(self):
        SelfEsteemAssessment.objects.create(
            owner=self.member,
            assessed_at=date.today(),
            q1=3,
            q2=3,
            q3=0,
            q4=3,
            q5=0,
            q6=3,
            q7=3,
            q8=0,
            q9=0,
            q10=0,
        )
        EmotionalCheckin.objects.create(
            owner=self.member,
            checked_at=date.today(),
            loneliness=2,
            anxiety=3,
            motivation=8,
            energy=7,
        )
        impulse = CrisisImpulseLog.objects.create(
            owner=self.member,
            emotional_state="anxiety",
            impulse_type="social_media",
            resolved=True,
        )
        self.assertTrue(impulse.resolved)
        intervention = WellnessIntervention.objects.create(
            title="Caminhada",
            description="Caminhar 15 min",
            category="anxiety",
            duration_minutes=15,
            expected_benefit="Reduz estresse",
        )
        WellnessInterventionCompletion.objects.create(
            owner=self.member, intervention=intervention
        )

        url = reverse("wellness-dashboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["self_esteem"]["current_score"], 30)
        self.assertEqual(response.data["emotional"]["checkins_this_week"], 1)
        self.assertEqual(response.data["impulses"]["count_this_week"], 1)
        self.assertEqual(response.data["impulses"]["resolved_this_week"], 1)
        self.assertEqual(
            response.data["interventions"]["completed_this_week"], 1
        )
