"""
Integration tests for auto-embedding via signal handlers.

Strategy:
- The service silences all exceptions, so AgentEmbedding table absence in
  SQLite is not a problem for signals tests. We mock the two external calls
  instead: LLMClient.embed and AgentEmbedding.objects.update_or_create /
  filter.
- captureOnCommitCallbacks(execute=True) fires on_commit callbacks
  synchronously inside the test transaction so we can assert on mock calls.
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from accounts.models import Account


class EmbeddingServiceDirectTest(TestCase):
    """Unit tests for agents.services.embedding_service functions."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="svc_test", email="svc@test.com", password="pass"
        )

    @patch("agents.models.AgentEmbedding.objects.update_or_create")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_generate_creates_embedding(self, mock_embed, mock_upsert):
        from agents.services.embedding_service import (
            generate_embedding_for_instance,
        )

        mock_embed.return_value = [0.1] * 768
        mock_upsert.return_value = (MagicMock(), True)

        # Build a minimal fake instance
        instance = MagicMock()
        instance.is_deleted = False
        instance.uuid = "00000000-0000-0000-0000-000000000001"
        instance.created_by = self.user

        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="expense",
            content_fn=lambda i: "Despesa de R$ 50.00 em food and drink",
            source_title="food and drink — 2026-04-30",
        )

        mock_embed.assert_called_once_with(
            "Despesa de R$ 50.00 em food and drink"
        )
        mock_upsert.assert_called_once()
        _, kwargs = mock_upsert.call_args
        self.assertEqual(kwargs["defaults"]["domain"], "finance")
        self.assertEqual(kwargs["defaults"]["is_deleted"], False)

    @patch("agents.models.AgentEmbedding.objects.filter")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_soft_delete_calls_delete_embedding(self, mock_embed, mock_filter):
        from agents.services.embedding_service import (
            generate_embedding_for_instance,
        )

        mock_qs = MagicMock()
        mock_filter.return_value = mock_qs

        instance = MagicMock()
        instance.is_deleted = True
        instance.uuid = "00000000-0000-0000-0000-000000000002"
        instance.created_by = self.user

        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="expense",
            content_fn=lambda i: "irrelevant",
        )

        mock_embed.assert_not_called()
        mock_filter.assert_called_once_with(source_id=instance.uuid)
        mock_qs.update.assert_called_once_with(is_deleted=True)

    @patch("agents.core.llm_client.LLMClient.embed")
    def test_no_user_skips_silently(self, mock_embed):
        from agents.services.embedding_service import (
            generate_embedding_for_instance,
        )

        instance = MagicMock()
        instance.is_deleted = False
        instance.created_by = None

        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="expense",
            content_fn=lambda i: "test",
        )

        mock_embed.assert_not_called()

    @patch("agents.models.AgentEmbedding.objects.update_or_create")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_empty_embed_result_skips_upsert(self, mock_embed, mock_upsert):
        from agents.services.embedding_service import (
            generate_embedding_for_instance,
        )

        mock_embed.return_value = []

        instance = MagicMock()
        instance.is_deleted = False
        instance.uuid = "00000000-0000-0000-0000-000000000003"
        instance.created_by = self.user

        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="expense",
            content_fn=lambda i: "some content",
        )

        mock_upsert.assert_not_called()

    @patch("agents.models.AgentEmbedding.objects.update_or_create")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_exception_in_embed_is_silenced(self, mock_embed, mock_upsert):
        from agents.services.embedding_service import (
            generate_embedding_for_instance,
        )

        mock_embed.side_effect = RuntimeError("Ollama down")

        instance = MagicMock()
        instance.is_deleted = False
        instance.uuid = "00000000-0000-0000-0000-000000000004"
        instance.created_by = self.user

        # Should not raise
        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="expense",
            content_fn=lambda i: "test content",
        )

        mock_upsert.assert_not_called()


class ExpenseEmbeddingSignalTest(TestCase):
    """Integration test: Expense post_save → embedding signal fires."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="sig_test", email="sig@test.com", password="pass"
        )
        self.account = Account.objects.create(
            account_name="Signal Test Account",
            institution_name="Test Bank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("1000.00"),
        )

    @patch("agents.models.AgentEmbedding.objects.update_or_create")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_expense_save_triggers_embedding(self, mock_embed, mock_upsert):
        from expenses.models import Expense

        mock_embed.return_value = [0.1] * 768
        mock_upsert.return_value = (MagicMock(), True)

        with self.captureOnCommitCallbacks(execute=True):
            Expense.objects.create(
                description="Almoço",
                value=Decimal("35.00"),
                date=timezone.now().date(),
                category="food and drink",
                account=self.account,
                payed=False,
                created_by=self.user,
            )

        mock_embed.assert_called_once()
        mock_upsert.assert_called_once()
        _, kwargs = mock_upsert.call_args
        self.assertEqual(kwargs["defaults"]["domain"], "finance")
        self.assertEqual(kwargs["source_type"], "expense")

    @patch("agents.models.AgentEmbedding.objects.filter")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_soft_deleted_expense_marks_embedding_deleted(
        self, mock_embed, mock_filter
    ):
        from expenses.models import Expense

        mock_qs = MagicMock()
        mock_filter.return_value = mock_qs

        with self.captureOnCommitCallbacks(execute=True):
            Expense.objects.create(
                description="Deletada",
                value=Decimal("10.00"),
                date=timezone.now().date(),
                category="food and drink",
                account=self.account,
                payed=False,
                created_by=self.user,
                is_deleted=True,
            )

        mock_embed.assert_not_called()
        mock_qs.update.assert_called_with(is_deleted=True)
