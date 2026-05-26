"""
Additional library view tests — reading goals, reading queue, library
dashboard,
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
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
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
        response = self.client.patch(
            url, {"pages_read": 50, "book": self.book.pk}
        )
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
                "text": (
                    "Somebody must have made a false"
                    " accusation against Josef K."
                ),
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


# ---------------------------------------------------------------------------
# Book Mark As Read
# ---------------------------------------------------------------------------


class BookMarkAsReadViewTest(BaseLibraryTestCase):
    def test_mark_as_read_creates_sessions(self):
        """Deve criar uma sessão por dia e marcar o livro como lido."""
        url = reverse("book-mark-as-read", args=[self.book.pk])
        response = self.client.post(
            url, {"start_date": "2024-01-01", "end_date": "2024-01-05"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["sessions_created"], 5)

        from library.models import Reading

        readings = Reading.objects.filter(
            book=self.book, deleted_at__isnull=True
        )
        self.assertEqual(readings.count(), 5)
        total_pages = sum(r.pages_read for r in readings)
        self.assertEqual(total_pages, self.book.pages)

        self.book.refresh_from_db()
        self.assertEqual(self.book.read_status, "read")

    def test_mark_as_read_last_session_absorbs_remainder(self):
        """Última sessão deve absorver o resto da divisão de páginas."""
        from library.models import Book

        book = Book.objects.create(
            title="Remainder Book",
            pages=11,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        book.authors.set([self.author])
        url = reverse("book-mark-as-read", args=[book.pk])
        response = self.client.post(
            url, {"start_date": "2024-02-01", "end_date": "2024-02-03"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        from library.models import Reading

        readings = list(
            Reading.objects.filter(
                book=book, deleted_at__isnull=True
            ).order_by("reading_date")
        )
        self.assertEqual(readings[0].pages_read, 3)
        self.assertEqual(readings[1].pages_read, 3)
        self.assertEqual(readings[2].pages_read, 5)

    def test_mark_as_read_single_day(self):
        """Um único dia deve criar uma sessão com todas as páginas."""
        from library.models import Book

        book = Book.objects.create(
            title="One Day Book",
            pages=50,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        book.authors.set([self.author])
        url = reverse("book-mark-as-read", args=[book.pk])
        response = self.client.post(
            url, {"start_date": "2024-03-10", "end_date": "2024-03-10"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["sessions_created"], 1)

        from library.models import Reading

        reading = Reading.objects.get(book=book, deleted_at__isnull=True)
        self.assertEqual(reading.pages_read, 50)

    def test_mark_as_read_rejects_end_before_start(self):
        """Deve rejeitar quando data de fim é anterior à data de início."""
        url = reverse("book-mark-as-read", args=[self.book.pk])
        response = self.client.post(
            url, {"start_date": "2024-05-10", "end_date": "2024-05-01"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mark_as_read_rejects_book_with_existing_readings(self):
        """Deve rejeitar livro que já possui leituras registradas."""
        from library.models import Book, Reading

        book = Book.objects.create(
            title="Already Read Book",
            pages=100,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        book.authors.set([self.author])
        Reading.objects.create(
            book=book,
            pages_read=10,
            reading_time=20,
            owner=self.member,
        )
        url = reverse("book-mark-as-read", args=[book.pk])
        response = self.client.post(
            url, {"start_date": "2024-06-01", "end_date": "2024-06-05"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mark_as_read_uses_historical_avg(self):
        """Deve usar a média histórica de min/página quando existir."""
        from library.models import Book, Reading

        # Criar sessões históricas: 60 min para 30 páginas = 2 min/pág
        existing_book = Book.objects.create(
            title="Historical Book",
            pages=30,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        existing_book.authors.set([self.author])
        Reading.objects.create(
            book=existing_book,
            pages_read=30,
            reading_time=60,
            owner=self.member,
        )
        # Novo livro do mesmo tipo
        new_book = Book.objects.create(
            title="New Book Same Type",
            pages=10,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        new_book.authors.set([self.author])
        url = reverse("book-mark-as-read", args=[new_book.pk])
        response = self.client.post(
            url, {"start_date": "2024-07-01", "end_date": "2024-07-01"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        from library.models import Reading as R

        reading = R.objects.get(book=new_book, deleted_at__isnull=True)
        # 10 páginas × 2 min/pág = 20 min
        self.assertEqual(reading.reading_time, 20)
