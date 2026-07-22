"""
Testes adicionais de cobertura para library/views.py.

Cobre: AI summary de livro, filtros de leituras, dashboard de estatísticas
(bloco completo de agregações), streak unificado, export/kindle-import de
destaques, grafo de conhecimento, badges, histórico de habilidade,
flashcards (SM-2), sugestão de links via embeddings, importação Goodreads,
plano de mentoria e relatório mensal de aprendizado.

Nenhuma chamada real a LLM/Redis/rede é permitida — integrações externas
são mockadas.
"""

from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member


class BaseLibraryCoverageTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="libcov",
            email="libcov@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Lib Coverage User",
            document_hash="c" * 64,
            phone="11999999900",
            sex="M",
            user=self.user,
        )
        from library.models import Author, Book, Publisher

        self.author = Author.objects.create(name="Kafka", owner=self.member)
        self.publisher = Publisher.objects.create(
            name="Penguin", owner=self.member
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

    def _make_second_user(self):
        """Cria um segundo usuário SEM Member vinculado."""
        user = User.objects.create_user(
            username="nomember",
            email="nomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        return user, client


# ---------------------------------------------------------------------------
# BookAISummaryView
# ---------------------------------------------------------------------------


class BookAISummaryViewTest(BaseLibraryCoverageTestCase):
    def test_no_member_returns_404(self):
        _, client = self._make_second_user()
        url = reverse("book-ai-summary", args=[self.book.pk])
        response = client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_book_not_found_returns_404(self):
        url = reverse("book-ai-summary", args=[999999])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_success_with_highlights(self):
        from library.models import BookHighlight

        BookHighlight.objects.create(
            book=self.book,
            owner=self.member,
            text="Somebody must have slandered Josef K.",
            page_number=1,
            highlight_type="quote",
            color="yellow",
        )
        url = reverse("book-ai-summary", args=[self.book.pk])
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.chat.return_value = "Um resumo perspicaz do livro."
            response = self.client.post(
                url, {"language": "pt-BR"}, format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["summary"], "Um resumo perspicaz do livro."
        )
        self.assertEqual(response.data["highlight_count"], 1)

    def test_success_without_highlights(self):
        url = reverse("book-ai-summary", args=[self.book.pk])
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.chat.return_value = "Resumo genérico."
            response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["highlight_count"], 0)

    def test_llm_exception_returns_503(self):
        url = reverse("book-ai-summary", args=[self.book.pk])
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.chat.side_effect = RuntimeError("boom")
            response = self.client.post(url, {}, format="json")
        self.assertEqual(
            response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
        )


# ---------------------------------------------------------------------------
# ReadingListCreateView — query param filters
# ---------------------------------------------------------------------------


class ReadingListFilterTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Reading

        self.reading = Reading.objects.create(
            book=self.book,
            reading_date=date.today(),
            reading_time=30,
            pages_read=20,
            notes="interesting passage",
            time_of_day="morning",
            owner=self.member,
        )

    def test_filter_by_book(self):
        url = reverse("reading-list-create")
        response = self.client.get(url, {"book": self.book.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_date_range(self):
        url = reverse("reading-list-create")
        response = self.client.get(
            url,
            {
                "date_from": (date.today() - timedelta(days=1)).isoformat(),
                "date_to": (date.today() + timedelta(days=1)).isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_search(self):
        url = reverse("reading-list-create")
        response = self.client.get(url, {"search": "interesting"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_genre(self):
        url = reverse("reading-list-create")
        response = self.client.get(url, {"genre": "Fiction"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_author(self):
        url = reverse("reading-list-create")
        response = self.client.get(url, {"author": self.author.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_time_of_day(self):
        url = reverse("reading-list-create")
        response = self.client.get(url, {"time_of_day": "morning"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        response = self.client.get(url, {"time_of_day": "evening"})
        self.assertEqual(response.data["count"], 0)


# ---------------------------------------------------------------------------
# LibraryDashboardStatsView — full aggregation block
# ---------------------------------------------------------------------------


class LibraryDashboardStatsFullTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Author, Book, Publisher, Reading

        self.book.genre = "Fiction"
        self.book.language = "Por"
        self.book.media_type = "Dig"
        self.book.rating = 5
        self.book.read_status = "read"
        self.book.pages = 200
        self.book.save()

        self.author2 = Author.objects.create(name="Orwell", owner=self.member)
        self.publisher2 = Publisher.objects.create(
            name="HarperCollins", owner=self.member
        )
        self.book_reading = Book.objects.create(
            title="1984",
            pages=300,
            publisher=self.publisher2,
            language="Ing",
            genre="Philosophy",
            literarytype="book",
            media_type="Fis",
            rating=3,
            read_status="reading",
            owner=self.member,
        )
        self.book_reading.authors.set([self.author2])

        Book.objects.create(
            title="To Read Later",
            pages=100,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            read_status="to_read",
            owner=self.member,
        )

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        now = timezone.now()
        curr_month_date = now.replace(day=1).date()
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_year = now.year if now.month > 1 else now.year - 1
        prev_month_date = date(prev_year, prev_month, 5)

        Reading.objects.create(
            book=self.book,
            reading_date=today,
            reading_time=30,
            pages_read=20,
            time_of_day="morning",
            owner=self.member,
        )
        Reading.objects.create(
            book=self.book,
            reading_date=yesterday,
            reading_time=30,
            pages_read=20,
            owner=self.member,
        )
        Reading.objects.create(
            book=self.book,
            reading_date=curr_month_date,
            reading_time=15,
            pages_read=10,
            owner=self.member,
        )
        Reading.objects.create(
            book=self.book,
            reading_date=prev_month_date,
            reading_time=20,
            pages_read=15,
            owner=self.member,
        )
        Reading.objects.create(
            book=self.book_reading,
            reading_date=today,
            reading_time=60,
            pages_read=50,
            owner=self.member,
        )

    def test_dashboard_full_stats_and_cache_hit(self):
        url = reverse("library-dashboard-stats")

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data["total_books"], 3)
        self.assertEqual(data["books_reading"], 1)
        self.assertEqual(data["books_to_read"], 1)
        self.assertEqual(data["books_read"], 1)
        self.assertTrue(len(data["current_reading_books"]) >= 1)
        self.assertIsNotNone(data["current_reading_book"])
        self.assertIsNotNone(data["most_read_author"])
        self.assertEqual(data["most_read_author"]["name"], "Kafka")
        self.assertIsNotNone(data["most_read_publisher"])
        self.assertEqual(data["most_read_publisher"]["name"], "Penguin")
        self.assertTrue(len(data["recent_readings"]) >= 1)
        self.assertTrue(len(data["books_by_media_type"]) >= 1)
        self.assertTrue(len(data["rating_distribution"]) >= 1)
        self.assertTrue(len(data["reading_timeline"]) >= 1)
        self.assertIsNotNone(data["most_productive_day"])
        self.assertGreaterEqual(data["reading_streak"]["current_streak"], 2)
        self.assertGreaterEqual(data["reading_streak"]["longest_streak"], 2)
        self.assertTrue(len(data["reading_by_time_of_day"]) >= 1)
        self.assertTrue(len(data["top_genres_by_time"]) >= 1)
        self.assertIsNotNone(
            data["monthly_comparison"]["changes"]["pages_read"]
        )

        # Segunda chamada deve vir do cache (mesmo conteúdo).
        cached_response = self.client.get(url)
        self.assertEqual(cached_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cached_response.data["total_books"], 3)


# ---------------------------------------------------------------------------
# UnifiedStreakView
# ---------------------------------------------------------------------------


class UnifiedStreakViewTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Course, CourseSession, Reading

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        Reading.objects.create(
            book=self.book,
            reading_date=today,
            reading_time=30,
            pages_read=10,
            owner=self.member,
        )
        course = Course.objects.create(
            title="Django Avançado", owner=self.member
        )
        CourseSession.objects.create(
            course=course,
            session_date=yesterday,
            duration_minutes=45,
            owner=self.member,
        )

    def test_streak_and_cache_hit(self):
        url = reverse("library-streak")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["today_completed"])
        self.assertGreaterEqual(response.data["current"], 1)
        self.assertGreaterEqual(response.data["longest"], 2)

        cached_response = self.client.get(url)
        self.assertEqual(cached_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cached_response.data, response.data)


# ---------------------------------------------------------------------------
# BookHighlight — filters + detail + export
# ---------------------------------------------------------------------------


class BookHighlightFilterAndDetailTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import BookHighlight

        self.highlight = BookHighlight.objects.create(
            book=self.book,
            owner=self.member,
            text="A memorable quote",
            page_number=10,
            chapter="Chapter One",
            highlight_type="quote",
            color="yellow",
        )

    def test_filter_by_book(self):
        url = reverse("highlight-list-create")
        response = self.client.get(url, {"book": self.book.pk})
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_search(self):
        url = reverse("highlight-list-create")
        response = self.client.get(url, {"search": "memorable"})
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_highlight_type(self):
        url = reverse("highlight-list-create")
        response = self.client.get(url, {"highlight_type": "quote"})
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_color(self):
        url = reverse("highlight-list-create")
        response = self.client.get(url, {"color": "yellow"})
        self.assertEqual(response.data["count"], 1)

    def test_retrieve_update_delete(self):
        url = reverse("highlight-detail", args=[self.highlight.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(url, {"text": "Updated quote"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class BookHighlightExportViewTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import BookHighlight

        self.h1 = BookHighlight.objects.create(
            book=self.book,
            owner=self.member,
            text="First highlight",
            page_number=5,
            chapter="Intro",
            highlight_type="quote",
            color="yellow",
        )
        self.h2 = BookHighlight.objects.create(
            book=self.book,
            owner=self.member,
            text="Second highlight",
            highlight_type="note",
            color="green",
        )

    def test_export_markdown_default(self):
        url = reverse("highlight-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode()
        self.assertIn("The Trial", content)
        self.assertIn("First highlight", content)

    def test_export_json_with_book_filter(self):
        url = reverse("highlight-export")
        response = self.client.get(
            url, {"format": "json", "book": self.book.pk}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/json", response["Content-Type"])
        self.assertIn(b"First highlight", response.content)

    def test_export_csv(self):
        url = reverse("highlight-export")
        response = self.client.get(url, {"format": "csv"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn(b"Second highlight", response.content)

    def test_export_with_nonexistent_book_id(self):
        url = reverse("highlight-export")
        response = self.client.get(url, {"book": 999999})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# KindleImportView
# ---------------------------------------------------------------------------


class KindleImportViewTest(BaseLibraryCoverageTestCase):
    def _upload(self, content: bytes):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "My Clippings.txt", content, content_type="text/plain"
        )

    def test_no_file_returns_400(self):
        url = reverse("highlight-kindle-import")
        response = self.client.post(url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_member_returns_404(self):
        _, client = self._make_second_user()
        url = reverse("highlight-kindle-import")
        content = "irrelevant".encode("utf-8")
        response = client.post(
            url, {"file": self._upload(content)}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_import_mixed_entries(self):
        clipping = (
            "The Trial (Franz Kafka)\n"
            "- Seu destaque na página 12 | Posição 100-120 | "
            "Adicionado em domingo, 1 de janeiro de 2026\n"
            "\n"
            "Somebody must have slandered Josef K.\n"
            "==========\n"
            "The Trial (Franz Kafka)\n"
            "- Seu marcador na página 20 | Adicionado em domingo\n"
            "\n"
            "==========\n"
            "Unknown Book Title Xyz (Nobody)\n"
            "- Seu destaque na página 3 | Posição 1-2\n"
            "\n"
            "This book does not exist in library.\n"
            "==========\n"
            "OnlyOneLine\n"
            "==========\n"
        )
        url = reverse("highlight-kindle-import")
        response = self.client.post(
            url,
            {"file": self._upload(clipping.encode("utf-8"))},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_imported"], 1)
        self.assertEqual(response.data["total_skipped"], 3)

        # Re-importar o mesmo conteúdo deve deduplicar o highlight já criado.
        response2 = self.client.post(
            url,
            {"file": self._upload(clipping.encode("utf-8"))},
            format="multipart",
        )
        self.assertEqual(response2.data["total_imported"], 0)
        self.assertEqual(response2.data["total_skipped"], 4)


# ---------------------------------------------------------------------------
# KnowledgeGraphView
# ---------------------------------------------------------------------------


class KnowledgeGraphViewTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import (
            BookHighlight,
            Course,
            KnowledgeLink,
            Skill,
            Summary,
        )

        self.summary = Summary.objects.create(
            book=self.book,
            title="Trial Summary",
            text="A man is arrested.",
            owner=self.member,
        )
        self.highlight = BookHighlight.objects.create(
            book=self.book,
            owner=self.member,
            summary=self.summary,
            text="A notable quote",
            highlight_type="quote",
            color="yellow",
        )
        self.course = Course.objects.create(
            title="Literature 101", owner=self.member
        )
        self.skill = Skill.objects.create(name="Reading", owner=self.member)
        KnowledgeLink.objects.create(
            source_type="book",
            source_id=self.book.uuid,
            target_type="skill",
            target_id=self.skill.uuid,
            relation_label="relates",
            owner=self.member,
        )

    def test_graph_without_highlights(self):
        url = reverse("knowledge-graph")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        node_types = {n["type"] for n in response.data["nodes"]}
        self.assertIn("author", node_types)
        self.assertIn("book", node_types)
        self.assertIn("summary", node_types)
        self.assertIn("course", node_types)
        self.assertIn("skill", node_types)
        self.assertNotIn("highlight", node_types)
        link_types = {ln["type"] for ln in response.data["links"]}
        self.assertIn("implicit", link_types)
        self.assertIn("explicit", link_types)

    def test_graph_with_highlights(self):
        url = reverse("knowledge-graph")
        response = self.client.get(url, {"include_highlights": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        node_types = {n["type"] for n in response.data["nodes"]}
        self.assertIn("highlight", node_types)
        relations = {ln["relation"] for ln in response.data["links"]}
        self.assertIn("linked_to", relations)

    def test_graph_no_member_returns_empty(self):
        _, client = self._make_second_user()
        url = reverse("knowledge-graph")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"nodes": [], "links": []})


# ---------------------------------------------------------------------------
# IntellectBadgeListView / SkillHistoryView
# ---------------------------------------------------------------------------


class IntellectBadgeListViewTest(BaseLibraryCoverageTestCase):
    def test_list_badges(self):
        from library.models import IntellectBadge

        IntellectBadge.objects.create(
            owner=self.member, code="first_book", level="bronze"
        )
        url = reverse("intellect-badge-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)


class SkillHistoryViewTest(BaseLibraryCoverageTestCase):
    def test_list_skill_history(self):
        from library.models import Skill, SkillHistory

        skill = Skill.objects.create(name="Python", owner=self.member)
        SkillHistory.objects.create(
            skill=skill,
            proficiency="beginner",
            status="learning",
            owner=self.member,
        )
        url = reverse("skill-history", args=[skill.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)


# ---------------------------------------------------------------------------
# FlashCard views
# ---------------------------------------------------------------------------


class FlashCardViewTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import FlashCard

        self.due_card = FlashCard.objects.create(
            book=self.book,
            front="Q1",
            back="A1",
            next_review=timezone.localdate() - timedelta(days=1),
            owner=self.member,
        )
        self.future_card = FlashCard.objects.create(
            book=self.book,
            front="Q2",
            back="A2",
            next_review=timezone.localdate() + timedelta(days=5),
            owner=self.member,
        )

    def test_list_due_only(self):
        url = reverse("flashcard-list-create")
        response = self.client.get(url, {"due": "true"})
        self.assertEqual(response.data["count"], 1)

    def test_list_all(self):
        url = reverse("flashcard-list-create")
        response = self.client.get(url)
        self.assertEqual(response.data["count"], 2)

    def test_retrieve_update_delete(self):
        url = reverse("flashcard-detail", args=[self.due_card.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(url, {"front": "Updated Q1"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        from library.models import FlashCard

        card = FlashCard.all_objects.get(pk=self.due_card.pk)
        self.assertTrue(card.is_deleted)

    def test_review_success(self):
        url = reverse("flashcard-review", args=[self.due_card.pk])
        response = self.client.post(url, {"rating": 4}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["repetitions"], 1)

    def test_review_not_found(self):
        url = reverse("flashcard-review", args=[999999])
        response = self.client.post(url, {"rating": 4}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_from_highlight_creates_cards(self):
        from library.models import BookHighlight

        BookHighlight.objects.create(
            book=self.book,
            owner=self.member,
            text="Highlight to convert",
            highlight_type="quote",
            color="yellow",
        )
        url = reverse("book-flashcards-generate", args=[self.book.pk])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created"], 1)

        # Segunda chamada não deve duplicar (flashcard já existe).
        response2 = self.client.post(url, {}, format="json")
        self.assertEqual(response2.data["created"], 0)

    def test_from_highlight_book_not_found(self):
        url = reverse("book-flashcards-generate", args=[999999])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# KnowledgeGraphSuggestLinksView
# ---------------------------------------------------------------------------


class KnowledgeGraphSuggestLinksViewTest(BaseLibraryCoverageTestCase):
    def test_less_than_two_embeddings_returns_empty(self):
        with patch("agents.models.AgentEmbedding.objects") as mock_mgr:
            mock_mgr.filter.return_value.values.return_value = []
            url = reverse("knowledge-graph-suggest-links")
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["suggestions"], [])

    def test_finds_similar_pair(self):
        import uuid

        docs = [
            {
                "id": uuid.uuid4(),
                "source_type": "book",
                "source_id": uuid.uuid4(),
                "source_title": "Book A",
                "embedding": [1.0, 0.0, 0.0],
            },
            {
                "id": uuid.uuid4(),
                "source_type": "book",
                "source_id": uuid.uuid4(),
                "source_title": "Book B",
                "embedding": [0.99, 0.01, 0.0],
            },
        ]
        with patch("agents.models.AgentEmbedding.objects") as mock_mgr:
            mock_mgr.filter.return_value.values.return_value = docs
            url = reverse("knowledge-graph-suggest-links")
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["suggestions"]), 1)
        self.assertEqual(
            response.data["suggestions"][0]["source_title"], "Book A"
        )

    def test_exception_is_handled_gracefully(self):
        _, client = self._make_second_user()
        with patch("agents.models.AgentEmbedding.objects") as mock_mgr:
            mock_mgr.filter.return_value.values.return_value = [
                {
                    "id": 1,
                    "source_type": "book",
                    "source_id": 1,
                    "source_title": "X",
                    "embedding": [1.0],
                },
                {
                    "id": 2,
                    "source_type": "book",
                    "source_id": 2,
                    "source_title": "Y",
                    "embedding": [1.0],
                },
            ]
            url = reverse("knowledge-graph-suggest-links")
            response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["suggestions"], [])


# ---------------------------------------------------------------------------
# GoodreadsImportView
# ---------------------------------------------------------------------------


class GoodreadsImportViewTest(BaseLibraryCoverageTestCase):
    def _upload_csv(self, content: str):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "goodreads_library_export.csv",
            content.encode("utf-8"),
            content_type="text/csv",
        )

    def test_no_file_returns_400(self):
        url = reverse("goodreads-import")
        response = self.client.post(url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_import_creates_and_skips_duplicates(self):
        csv_content = (
            "Title,Author,ISBN,My Rating,Number of Pages,Exclusive Shelf\n"
            'The Trial,Franz Kafka,"1234567890",5,250,read\n'
            'Animal Farm,George Orwell,"0987654321",4,100,currently-reading\n'
            "Brave New World,Aldous Huxley,,0,300,to-read\n"
        )
        url = reverse("goodreads-import")
        response = self.client.post(
            url,
            {"file": self._upload_csv(csv_content)},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # "The Trial" já existe (fuzzy match) e deve ser marcado como skip.
        self.assertEqual(response.data["skipped"], 1)
        self.assertEqual(response.data["imported"], 2)

        from library.models import Book

        animal_farm = Book.objects.get(title="Animal Farm", owner=self.member)
        self.assertEqual(animal_farm.read_status, "reading")
        brave_new_world = Book.objects.get(
            title="Brave New World", owner=self.member
        )
        self.assertEqual(brave_new_world.read_status, "to_read")
        self.assertIsNone(brave_new_world.rating)


# ---------------------------------------------------------------------------
# MentorPlanView
# ---------------------------------------------------------------------------


class MentorPlanViewTest(BaseLibraryCoverageTestCase):
    def test_missing_objective_returns_400(self):
        url = reverse("mentor-plan")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_successful_plan_generation(self):
        from library.models import Skill

        Skill.objects.create(
            name="Python", proficiency="advanced", owner=self.member
        )
        url = reverse("mentor-plan")
        plan_json = (
            '{"summary": "Plano gerado", "weekly_plan": [], '
            '"key_milestones": [], "success_metrics": []}'
        )
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.get_instance.return_value.chat.return_value = plan_json
            response = self.client.post(
                url,
                {
                    "objective": "Aprender arquitetura de software",
                    "focus_skills": ["Python"],
                    "weeks": 4,
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["plan"]["summary"], "Plano gerado")
        self.assertEqual(response.data["weeks"], 4)

    def test_plan_with_non_json_response_falls_back_to_summary(self):
        url = reverse("mentor-plan")
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.get_instance.return_value.chat.return_value = (
                "Texto livre sem chaves JSON."
            )
            response = self.client.post(
                url, {"objective": "Ler mais"}, format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["plan"]["summary"], "Texto livre sem chaves JSON."
        )

    def test_llm_error_returns_503(self):
        url = reverse("mentor-plan")
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.get_instance.side_effect = RuntimeError("unavailable")
            response = self.client.post(
                url, {"objective": "Ler mais"}, format="json"
            )
        self.assertEqual(
            response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
        )


# ---------------------------------------------------------------------------
# MonthlyLearningReportView
# ---------------------------------------------------------------------------


class MonthlyLearningReportViewTest(BaseLibraryCoverageTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Course, CourseSession, Reading, Skill

        self.today = timezone.now().date()
        Reading.objects.create(
            book=self.book,
            reading_date=self.today,
            reading_time=40,
            pages_read=15,
            owner=self.member,
        )
        course = Course.objects.create(title="Curso X", owner=self.member)
        CourseSession.objects.create(
            course=course,
            session_date=self.today,
            duration_minutes=50,
            owner=self.member,
        )
        Skill.objects.create(name="Design", owner=self.member)

    def test_invalid_params_returns_400(self):
        url = reverse("monthly-learning-report")
        response = self.client.get(url, {"month": "abc", "year": "2026"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_report_without_llm_returns_null_summary(self):
        url = reverse("monthly-learning-report")
        response = self.client.get(
            url,
            {"month": self.today.month, "year": self.today.year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["reading"]["sessions"], 1)
        self.assertEqual(response.data["courses"]["sessions"], 1)
        self.assertIsNone(response.data["summary"])

    def test_report_with_llm_summary(self):
        url = reverse("monthly-learning-report")
        with patch("agents.core.llm_client.LLMClient") as mock_llm:
            mock_llm.get_instance.return_value.chat.return_value = (
                "Ótimo desempenho este mês!"
            )
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["summary"], "Ótimo desempenho este mês!"
        )

    def test_report_defaults_to_current_month(self):
        url = reverse("monthly-learning-report")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"]["month"], self.today.month)
