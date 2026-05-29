"""
Tests for the Intelecto module — courses, modules, lessons, sessions and
skills.
"""

from datetime import date

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member


class BaseIntellectTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="intellecttest",
            email="intellect@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Intellect User",
            document_hash="i" * 64,
            phone="11999999911",
            sex="M",
            user=self.user,
        )

    def _make_course(self, **kwargs):
        from library.models import Course

        defaults = {
            "title": "Python Avançado",
            "platform": "udemy",
            "category": "technology",
            "status": "in_progress",
            "owner": self.member,
        }
        defaults.update(kwargs)
        return Course.objects.create(**defaults)

    def _make_module(self, course, **kwargs):
        from library.models import CourseModule

        defaults = {
            "course": course,
            "title": "Módulo 1",
            "order": 1,
            "owner": self.member,
        }
        defaults.update(kwargs)
        return CourseModule.objects.create(**defaults)

    def _make_lesson(self, module, **kwargs):
        from library.models import CourseLesson

        defaults = {
            "module": module,
            "title": "Aula 1",
            "order": 1,
            "owner": self.member,
        }
        defaults.update(kwargs)
        return CourseLesson.objects.create(**defaults)

    def _make_session(self, course, **kwargs):
        from library.models import CourseSession

        defaults = {
            "course": course,
            "session_date": date.today(),
            "duration_minutes": 90,
            "owner": self.member,
        }
        defaults.update(kwargs)
        return CourseSession.objects.create(**defaults)

    def _make_skill(self, **kwargs):
        from library.models import Skill

        defaults = {
            "name": "Python",
            "category": "technology",
            "proficiency": "intermediate",
            "status": "learning",
            "owner": self.member,
        }
        defaults.update(kwargs)
        return Skill.objects.create(**defaults)


# ---------------------------------------------------------------------------
# Course CRUD
# ---------------------------------------------------------------------------


class CourseListCreateTest(BaseIntellectTestCase):
    def test_list_courses_empty(self):
        url = reverse("course-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_create_course(self):
        url = reverse("course-list-create")
        payload = {
            "title": "AWS Solutions Architect",
            "platform": "coursera",
            "category": "technology",
            "status": "not_started",
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "AWS Solutions Architect")

    def test_list_courses_returns_own(self):
        self._make_course()
        url = reverse("course-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_status(self):
        self._make_course(status="in_progress")
        self._make_course(title="Outro", status="completed")
        url = reverse("course-list-create")
        response = self.client.get(url, {"status": "in_progress"})
        self.assertEqual(response.data["count"], 1)


class CourseDetailTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()

    def test_retrieve_course(self):
        url = reverse("course-detail", args=[self.course.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.course.title)

    def test_update_course(self):
        url = reverse("course-detail", args=[self.course.pk])
        response = self.client.patch(
            url, {"status": "completed", "owner": self.member.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_course(self):
        url = reverse("course-detail", args=[self.course.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_course_computed_fields(self):
        module = self._make_module(self.course)
        self._make_lesson(module, is_completed=True)
        self._make_lesson(module, title="Aula 2", order=2)
        url = reverse("course-detail", args=[self.course.pk])
        response = self.client.get(url)
        self.assertEqual(response.data["total_lessons"], 2)
        self.assertEqual(response.data["completed_lessons"], 1)
        self.assertEqual(response.data["progress_percentage"], 50.0)


# ---------------------------------------------------------------------------
# Course Module CRUD
# ---------------------------------------------------------------------------


class CourseModuleListCreateTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()

    def test_create_module(self):
        url = reverse("course-module-list-create")
        payload = {
            "course": self.course.pk,
            "title": "Fundamentos",
            "order": 1,
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Fundamentos")

    def test_list_modules_filtered_by_course(self):
        self._make_module(self.course)
        url = reverse("course-module-list-create")
        response = self.client.get(url, {"course": self.course.pk})
        self.assertEqual(response.data["count"], 1)


class CourseModuleDetailTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()
        self.module = self._make_module(self.course)

    def test_retrieve_module(self):
        url = reverse("course-module-detail", args=[self.module.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_module(self):
        url = reverse("course-module-detail", args=[self.module.pk])
        response = self.client.patch(
            url, {"title": "Fundamentos Atualizados", "owner": self.member.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_module(self):
        url = reverse("course-module-detail", args=[self.module.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Course Lesson CRUD + Toggle
# ---------------------------------------------------------------------------


class CourseLessonListCreateTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()
        self.module = self._make_module(self.course)

    def test_create_lesson(self):
        url = reverse("course-lesson-list-create")
        payload = {
            "module": self.module.pk,
            "title": "Introdução",
            "order": 1,
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_lessons_filtered_by_module(self):
        self._make_lesson(self.module)
        url = reverse("course-lesson-list-create")
        response = self.client.get(url, {"module": self.module.pk})
        self.assertEqual(response.data["count"], 1)

    def test_list_lessons_filtered_by_course(self):
        self._make_lesson(self.module)
        url = reverse("course-lesson-list-create")
        response = self.client.get(url, {"course": self.course.pk})
        self.assertEqual(response.data["count"], 1)


class CourseLessonToggleTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()
        self.module = self._make_module(self.course)
        self.lesson = self._make_lesson(self.module)

    def test_toggle_lesson_completes_it(self):
        url = reverse("course-lesson-toggle", args=[self.lesson.pk])
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_completed"])
        self.assertIsNotNone(response.data["completed_at"])

    def test_toggle_lesson_twice_uncompletes(self):
        url = reverse("course-lesson-toggle", args=[self.lesson.pk])
        self.client.patch(url)
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_completed"])

    def test_toggle_not_found(self):
        url = reverse("course-lesson-toggle", args=[99999])
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class CourseLessonDetailTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()
        self.module = self._make_module(self.course)
        self.lesson = self._make_lesson(self.module)

    def test_retrieve_lesson(self):
        url = reverse("course-lesson-detail", args=[self.lesson.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_lesson(self):
        url = reverse("course-lesson-detail", args=[self.lesson.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Course Session CRUD
# ---------------------------------------------------------------------------


class CourseSessionListCreateTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()

    def test_create_session(self):
        url = reverse("course-session-list-create")
        payload = {
            "course": self.course.pk,
            "session_date": str(date.today()),
            "duration_minutes": 120,
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["duration_minutes"], 120)

    def test_session_duration_hours(self):
        url = reverse("course-session-list-create")
        payload = {
            "course": self.course.pk,
            "session_date": str(date.today()),
            "duration_minutes": 90,
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        list_url = reverse("course-session-list-create")
        list_response = self.client.get(list_url, {"course": self.course.pk})
        session = list_response.data["results"][0]
        self.assertEqual(session["duration_hours"], 1.5)

    def test_list_sessions_filtered_by_course(self):
        self._make_session(self.course)
        url = reverse("course-session-list-create")
        response = self.client.get(url, {"course": self.course.pk})
        self.assertEqual(response.data["count"], 1)


class CourseSessionDetailTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.course = self._make_course()
        self.session = self._make_session(self.course)

    def test_retrieve_session(self):
        url = reverse("course-session-detail", args=[self.session.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_session(self):
        url = reverse("course-session-detail", args=[self.session.pk])
        response = self.client.patch(
            url, {"duration_minutes": 60, "owner": self.member.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_session(self):
        url = reverse("course-session-detail", args=[self.session.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Course invested_hours property
# ---------------------------------------------------------------------------


class CourseInvestedHoursTest(BaseIntellectTestCase):
    def test_invested_hours_sums_sessions(self):
        course = self._make_course()
        self._make_session(course, duration_minutes=60)
        self._make_session(course, duration_minutes=90)
        url = reverse("course-detail", args=[course.pk])
        response = self.client.get(url)
        self.assertEqual(response.data["invested_hours"], 2.5)


# ---------------------------------------------------------------------------
# Skill CRUD
# ---------------------------------------------------------------------------


class SkillListCreateTest(BaseIntellectTestCase):
    def test_list_skills_empty(self):
        url = reverse("skill-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_create_skill(self):
        url = reverse("skill-list-create")
        payload = {
            "name": "Python",
            "category": "technology",
            "proficiency": "intermediate",
            "status": "learning",
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Python")
        # proficiency_level is only in the read serializer — verify via GET
        skill_id = response.data["id"]
        detail = self.client.get(reverse("skill-detail", args=[skill_id]))
        self.assertEqual(detail.data["proficiency_level"], 3)

    def test_filter_by_category(self):
        self._make_skill(category="technology")
        self._make_skill(name="Inglês", category="languages")
        url = reverse("skill-list-create")
        response = self.client.get(url, {"category": "technology"})
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_status(self):
        self._make_skill(status="mastered")
        self._make_skill(name="SQL", status="learning")
        url = reverse("skill-list-create")
        response = self.client.get(url, {"status": "mastered"})
        self.assertEqual(response.data["count"], 1)

    def test_search_by_name(self):
        self._make_skill(name="Python")
        self._make_skill(name="JavaScript")
        url = reverse("skill-list-create")
        response = self.client.get(url, {"search": "python"})
        self.assertEqual(response.data["count"], 1)

    def test_unique_name_per_owner(self):
        self._make_skill(name="Python")
        url = reverse("skill-list-create")
        payload = {
            "name": "Python",
            "category": "technology",
            "proficiency": "beginner",
            "status": "learning",
            "owner": self.member.pk,
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SkillDetailTest(BaseIntellectTestCase):
    def setUp(self):
        super().setUp()
        self.skill = self._make_skill()

    def test_retrieve_skill(self):
        url = reverse("skill-detail", args=[self.skill.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Python")

    def test_update_skill_proficiency(self):
        url = reverse("skill-detail", args=[self.skill.pk])
        response = self.client.patch(
            url, {"proficiency": "advanced", "owner": self.member.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_skill(self):
        url = reverse("skill-detail", args=[self.skill.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Skill proficiency_level computed field
# ---------------------------------------------------------------------------


class SkillProficiencyLevelTest(BaseIntellectTestCase):
    def test_all_proficiency_levels(self):
        levels = [
            ("beginner", 1),
            ("basic", 2),
            ("intermediate", 3),
            ("advanced", 4),
            ("expert", 5),
        ]
        for idx, (proficiency, expected_level) in enumerate(levels):
            skill = self._make_skill(
                name=f"Skill{idx}", proficiency=proficiency
            )
            url = reverse("skill-detail", args=[skill.pk])
            response = self.client.get(url)
            self.assertEqual(
                response.data["proficiency_level"], expected_level
            )


# ---------------------------------------------------------------------------
# CourseLesson.toggle_completed model method
# ---------------------------------------------------------------------------


class CourseLessonToggleModelTest(BaseIntellectTestCase):
    def test_toggle_completed_sets_completed_at(self):
        course = self._make_course()
        module = self._make_module(course)
        lesson = self._make_lesson(module)

        self.assertFalse(lesson.is_completed)
        self.assertIsNone(lesson.completed_at)

        lesson.toggle_completed()
        lesson.refresh_from_db()

        self.assertTrue(lesson.is_completed)
        self.assertIsNotNone(lesson.completed_at)

    def test_toggle_completed_clears_completed_at(self):
        course = self._make_course()
        module = self._make_module(course)
        lesson = self._make_lesson(module, is_completed=True)
        from django.utils import timezone

        lesson.completed_at = timezone.now()
        lesson.save()

        lesson.toggle_completed()
        lesson.refresh_from_db()

        self.assertFalse(lesson.is_completed)
        self.assertIsNone(lesson.completed_at)
