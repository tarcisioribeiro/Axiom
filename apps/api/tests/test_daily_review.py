"""Revisão diária: pendências do(s) dia(s) anterior(es) ao login."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from admin_panel.models import UserScreenAccess
from daily_review.models import ReviewProgress, ReviewResolution
from daily_review.steps import Context, _planned_workout_days
from daily_review.views import Review
from library.models import Course
from members.models import Member
from personal_planning.models import (
    BodyMetric,
    DailyReflection,
    Goal,
    TaskInstance,
    WorkoutDay,
    WorkoutPlan,
)

URL = "/api/v1/daily-review/"


class DailyReviewTestCase(APITestCase):
    superuser = True

    def setUp(self):
        factory = (
            User.objects.create_superuser
            if self.superuser
            else User.objects.create_user
        )
        self.user = factory(
            username="dr_user", email="dr@test.com", password="testpass123"
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.member = Member.objects.create(
            name="DR User",
            document_hash="d" * 64,
            phone="11999999933",
            sex="M",
            user=self.user,
        )
        Member.objects.filter(pk=self.member.pk).update(
            created_at=timezone.now() - timedelta(days=60)
        )
        self.member.refresh_from_db()
        self.today = timezone.localdate()
        self.yesterday = self.today - timedelta(days=1)

    def review(self):
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 200)
        return resp.json()

    def steps(self, day=None):
        day = str(day or self.yesterday)
        data = self.review()
        for d in data["days"]:
            if d["date"] == day:
                return {s["key"]: s for s in d["steps"]}
        return {}

    def resolve(self, step, justification, item_key="", day=None):
        return self.client.post(
            f"{URL}resolve/",
            {
                "step": step,
                "date": str(day or self.yesterday),
                "item_key": item_key,
                "justification": justification,
            },
            format="json",
        )

    def set_last_reviewed(self, day):
        self.review()  # cria o progresso
        ReviewProgress.objects.filter(owner=self.member).update(
            last_reviewed_date=day
        )


class DailyReviewFlowTests(DailyReviewTestCase):
    def test_first_access_reviews_only_yesterday(self):
        data = self.review()
        self.assertIsNone(data["backlog"])
        self.assertEqual(
            [d["date"] for d in data["days"]], [str(self.yesterday)]
        )
        steps = self.steps()
        for key in ("reflection", "checkin", "self_esteem", "wellness"):
            self.assertIn(key, steps)
        # sem rotina, treino, refeições ou cursos não há o que cobrar
        for key in ("tasks", "workout", "meals", "hydration", "study"):
            self.assertNotIn(key, steps)
        self.assertTrue(steps["reflection"]["can_register"])

    def test_registered_item_leaves_review(self):
        DailyReflection.objects.create(
            owner=self.member,
            date=self.yesterday,
            reflection="ok",
            mood="good",
        )
        self.assertNotIn("reflection", self.steps())

    def test_complete_requires_everything_resolved(self):
        resp = self.client.post(
            f"{URL}complete/", {"date": str(self.yesterday)}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertGreater(resp.json()["pending"], 0)

        for key, step in self.steps().items():
            for item in step["items"]:
                r = self.resolve(key, step["justifications"][0], item["key"])
                self.assertEqual(r.status_code, 201, key)

        resp = self.client.post(
            f"{URL}complete/", {"date": str(self.yesterday)}, format="json"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(
            ReviewProgress.objects.get(owner=self.member).last_reviewed_date,
            self.yesterday,
        )
        self.assertEqual(self.review()["days"], [])

    def test_complete_applies_resolutions_atomically(self):
        resolutions = [
            {
                "step": key,
                "item_key": item["key"],
                "justification": step["justifications"][0],
            }
            for key, step in self.steps().items()
            for item in step["items"]
        ]
        url = f"{URL}complete/"
        day = str(self.yesterday)
        # Uma justificativa faltando: nada é gravado
        resp = self.client.post(
            url, {"date": day, "resolutions": resolutions[1:]}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(ReviewResolution.objects.exists())

        resp = self.client.post(
            url, {"date": day, "resolutions": resolutions}, format="json"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(self.review()["days"], [])

    def test_deleted_goal_leaves_review(self):
        goal = Goal.objects.create(
            title="Evitar",
            goal_type="avoid_habit",
            target_value=30,
            start_date=self.yesterday - timedelta(days=5),
            owner=self.member,
        )
        self.assertIn("goals", self.steps())
        resp = self.client.delete(
            f"/api/v1/personal-planning/goals/{goal.id}/"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertNotIn("goals", self.steps())

    def test_rejects_unknown_justification_and_resolved_item(self):
        self.assertEqual(self.resolve("reflection", "bogus").status_code, 400)
        self.assertEqual(self.resolve("reflection", "forgot").status_code, 201)
        self.assertEqual(self.resolve("reflection", "forgot").status_code, 400)

    def test_window_step_justification_lasts_the_window(self):
        self.assertIn("weigh_in", self.steps())
        self.assertEqual(self.resolve("weigh_in", "no_scale").status_code, 201)
        self.assertNotIn("weigh_in", self.steps())
        res = ReviewResolution.objects.get(step="weigh_in")
        ReviewResolution.objects.filter(pk=res.pk).update(
            reference_date=self.today - timedelta(days=7)
        )
        self.assertIn("weigh_in", self.steps())

    def test_recent_weigh_in_clears_step(self):
        BodyMetric.objects.create(
            owner=self.member,
            measured_at=self.today - timedelta(days=3),
            weight_kg=80,
        )
        self.assertNotIn("weigh_in", self.steps())

    def test_skipping_task_marks_instance_skipped(self):
        task = TaskInstance.objects.create(
            owner=self.member,
            task_name="Ler",
            scheduled_date=self.yesterday,
            status="pending",
        )
        step = self.steps()["tasks"]
        self.assertEqual(step["items"][0]["key"], str(task.uuid))
        self.assertEqual(
            self.resolve("tasks", "no_time", str(task.uuid)).status_code, 201
        )
        task.refresh_from_db()
        self.assertEqual(task.status, "skipped")

    def test_postponed_task_stays_pending(self):
        task = TaskInstance.objects.create(
            owner=self.member,
            task_name="Ler",
            scheduled_date=self.yesterday,
            status="pending",
        )
        self.resolve("tasks", "postponed", str(task.uuid))
        task.refresh_from_db()
        self.assertEqual(task.status, "pending")
        self.assertNotIn("tasks", self.steps())

    def test_scheduled_course_without_session_is_pending(self):
        course = Course.objects.create(
            title="Django",
            owner=self.member,
            status="in_progress",
            study_weekdays=[self.yesterday.weekday()],
        )
        items = self.steps()["study"]["items"]
        self.assertEqual(items[0]["key"], str(course.uuid))


class DailyReviewBacklogTests(DailyReviewTestCase):
    def test_old_days_are_justified_in_bulk(self):
        self.set_last_reviewed(self.today - timedelta(days=20))
        data = self.review()
        backlog = data["backlog"]
        self.assertEqual(backlog["end"], str(self.today - timedelta(days=8)))
        self.assertEqual(len(data["days"]), 7)

        partial = {"justifications": {"reflection": "forgot"}}
        resp = self.client.post(f"{URL}backlog/", partial, format="json")
        self.assertEqual(resp.status_code, 400)

        full = {
            "justifications": {
                s["key"]: s["justifications"][0] for s in backlog["steps"]
            }
        }
        resp = self.client.post(f"{URL}backlog/", full, format="json")
        self.assertEqual(resp.status_code, 204)
        data = self.review()
        self.assertIsNone(data["backlog"])
        self.assertEqual(len(data["days"]), 7)

    def test_weekends_can_be_skipped(self):
        self.set_last_reviewed(self.today - timedelta(days=8))
        self.client.patch(
            "/api/v1/me/preferences/",
            {"daily_review_on_weekends": False},
            format="json",
        )
        dates = Review(self.user).pending_dates()
        self.assertEqual(len(dates), 5)
        self.assertTrue(all(d.weekday() < 5 for d in dates))


class DailyReviewScreenAccessTests(DailyReviewTestCase):
    superuser = False

    def test_only_granted_screens_and_register_needs_add(self):
        UserScreenAccess.objects.filter(user=self.user).delete()
        UserScreenAccess.objects.create(
            user=self.user, screen="planning.reflections", actions=["view"]
        )
        steps = self.steps()
        self.assertEqual(list(steps), ["reflection"])
        self.assertFalse(steps["reflection"]["can_register"])
        self.assertEqual(self.resolve("checkin", "forgot").status_code, 400)
        self.assertEqual(self.resolve("reflection", "forgot").status_code, 201)


class PreferencesAndCourseTests(DailyReviewTestCase):
    def test_preferences_defaults_and_update(self):
        resp = self.client.get("/api/v1/me/preferences/")
        self.assertEqual(
            resp.json(),
            {
                "daily_review_on_weekends": True,
                "self_esteem_frequency_days": 1,
                "tours_disabled": False,
            },
        )
        resp = self.client.patch(
            "/api/v1/me/preferences/",
            {"self_esteem_frequency_days": 7, "tours_disabled": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["self_esteem_frequency_days"], 7)
        bad = self.client.patch(
            "/api/v1/me/preferences/",
            {"self_esteem_frequency_days": 3},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

    def test_weekly_self_esteem_becomes_window_step(self):
        self.client.patch(
            "/api/v1/me/preferences/",
            {"self_esteem_frequency_days": 7},
            format="json",
        )
        steps = self.steps()
        self.assertNotIn("self_esteem", steps)
        self.assertIn("self_esteem_periodic", steps)

    def test_course_study_weekdays_validation(self):
        base = {
            "title": "Curso",
            "platform": "udemy",
            "category": "technology",
            "status": "in_progress",
            "owner": self.member.id,
        }
        bad = self.client.post(
            "/api/v1/library/courses/",
            {**base, "study_weekdays": [7]},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(
            "/api/v1/library/courses/",
            {**base, "study_weekdays": [4, 0, 0]},
            format="json",
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(
            Course.objects.get(title="Curso").study_weekdays, [0, 4]
        )


class PlannedWorkoutDaysOrderTests(DailyReviewTestCase):
    """Mesma ordem usada em 'Plano de hoje' e no dropdown de registro de
    sessão: mobilidade, depois resistência, depois cardio."""

    def test_sorted_by_category_not_by_plan_order(self):
        weekday = self.yesterday.weekday()

        def plan_with_day(name, category, order):
            plan = WorkoutPlan.objects.create(
                name=name, category=category, owner=self.member
            )
            return WorkoutDay.objects.create(
                plan=plan,
                name=name,
                days_of_week=[weekday],
                order=order,
                owner=self.member,
            )

        # Criados fora de ordem de categoria, mas com `order`/plano
        # crescente — a ordenação antiga (plan, order, name) os listaria
        # nesta mesma ordem de criação, que é a errada.
        cardio = plan_with_day("Esteira", "cardio", order=0)
        mobility = plan_with_day("Mobilidade", "mobility", order=1)
        resistance = plan_with_day("Costas", "resistance", order=2)

        ctx = Context(member=self.member, today=self.today)
        result = _planned_workout_days(ctx, self.yesterday)

        self.assertEqual(
            [d.id for d in result],
            [mobility.id, resistance.id, cardio.id],
        )
