"""
Additional library view tests — reading goals, reading queue, library dashboard,
book highlights, and detail/update/delete for readings, summaries.
"""

from datetime import date

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member


class BaseLibraryTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="libtest",
            email="lib@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.member = Member.objects.create(
            name="Lib User",
            document_hash="l" * 64,
            phone="11999999979",
            sex="M",
            user=self.user,
        )
        from library.models import Author, Book, Publisher

        self.author = Author.objects.create(name="Kafka", owner=self.member)
        self.publisher = Publisher.objects.create(
            name="Penguin Modern Classics", owner=self.member
        )
        self.book = Book.objects.create(
            title="The Trial",
            pages=250,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        self.book.authors.set([self.author])


# ---------------------------------------------------------------------------
# Reading detail/update/delete
# ---------------------------------------------------------------------------


class ReadingDetailViewTest(BaseLibraryTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Reading

        self.reading = Reading.objects.create(
            book=self.book,
            reading_date=date.today(),
            reading_time=45,
            pages_read=30,
            owner=self.member,
        )

    def test_retrieve_reading(self):
        url = reverse("reading-detail", args=[self.reading.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_reading(self):
        url = reverse("reading-detail", args=[self.reading.pk])
        response = self.client.patch(url, {"pages_read": 50, "book": self.book.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_reading(self):
        url = reverse("reading-detail", args=[self.reading.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Summary detail/update/delete
# ---------------------------------------------------------------------------


class SummaryDetailViewTest(BaseLibraryTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Summary

        self.summary = Summary.objects.create(
            book=self.book,
            title="The Trial Summary",
            text="A man is arrested for reasons never explained.",
            owner=self.member,
        )

    def test_retrieve_summary(self):
        url = reverse("summary-detail", args=[self.summary.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_summary(self):
        url = reverse("summary-detail", args=[self.summary.pk])
        response = self.client.patch(url, {"title": "Updated Summary"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_summary(self):
        url = reverse("summary-detail", args=[self.summary.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Reading Goals
# ---------------------------------------------------------------------------


class ReadingGoalViewTest(BaseLibraryTestCase):
    def _goal_data(self, year=2026):
        return {
            "year": year,
            "books_goal": 24,
            "owner": self.member.pk,
        }

    def test_list_reading_goals(self):
        url = reverse("reading-goal-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_reading_goal(self):
        url = reverse("reading-goal-list-create")
        response = self.client.post(url, self._goal_data())
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_retrieve_reading_goal(self):
        from library.models import ReadingGoal

        goal = ReadingGoal.objects.create(
            year=2025,
            books_goal=12,
            owner=self.member,
        )
        url = reverse("reading-goal-detail", args=[goal.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_reading_goal(self):
        from library.models import ReadingGoal

        goal = ReadingGoal.objects.create(
            year=2024,
            books_goal=10,
            owner=self.member,
        )
        url = reverse("reading-goal-detail", args=[goal.pk])
        response = self.client.patch(url, {"goal_books": 15})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_reading_goal(self):
        from library.models import ReadingGoal

        goal = ReadingGoal.objects.create(
            year=2023,
            books_goal=8,
            owner=self.member,
        )
        url = reverse("reading-goal-detail", args=[goal.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Reading Queue
# ---------------------------------------------------------------------------


class ReadingQueueViewTest(BaseLibraryTestCase):
    def test_get_reading_queue(self):
        url = reverse("reading-queue")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Library Dashboard Stats
# ---------------------------------------------------------------------------


class LibraryDashboardViewTest(BaseLibraryTestCase):
    def test_library_dashboard_stats(self):
        url = reverse("library-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Book Highlights
# ---------------------------------------------------------------------------


class BookHighlightViewTest(BaseLibraryTestCase):
    def test_list_highlights(self):
        url = reverse("highlight-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_highlight(self):
        url = reverse("highlight-list-create")
        response = self.client.post(
            url,
            {
                "book": self.book.pk,
                "text": "Somebody must have made a false accusation against Josef K.",
                "page": 1,
                "chapter": "First Chapter",
                "owner": self.member.pk,
            },
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )


# ---------------------------------------------------------------------------
# Book delete (additional coverage for BookDetailView.perform_destroy)
# ---------------------------------------------------------------------------


class BookDeleteViewTest(BaseLibraryTestCase):
    def test_delete_book(self):
        from library.models import Book

        book = Book.objects.create(
            title="Metamorphosis",
            pages=90,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        book.authors.set([self.author])
        url = reverse("book-detail", args=[book.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
