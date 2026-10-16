from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from library.models import Book, Publisher
from members.models import Member


class SuggestContinuationOwnerTest(APITestCase):
    """O título do livro só entra no prompt se o livro for do usuário."""

    def setUp(self):
        self.user = User.objects.create_user("dono", "d@test.com", "pw")
        other = User.objects.create_user("outro", "o@test.com", "pw")
        other_member = Member.objects.create(
            name="Outro",
            document_hash="o" * 64,
            phone="11999999999",
            sex="M",
            user=other,
        )
        publisher = Publisher.objects.create(
            name="Editora", owner=other_member
        )
        self.foreign_book = Book.objects.create(
            title="Diario Secreto",
            pages=100,
            publisher=publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=other_member,
        )
        self.client.force_authenticate(self.user)

    @patch("agents.core.llm_client.LLMClient.chat", return_value="continua")
    def test_foreign_book_title_is_not_leaked(self, chat):
        self.client.post(
            reverse("agent-suggest-continuation"),
            {
                "text": "Hoje li mais um capitulo",
                "book_id": self.foreign_book.pk,
            },
            format="json",
        )
        prompt = chat.call_args[0][0][1]["content"]
        self.assertNotIn("Diario Secreto", prompt)
