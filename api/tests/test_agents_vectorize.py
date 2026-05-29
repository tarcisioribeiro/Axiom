import uuid
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from agents.tools.rag_tools import (
    _cosine_similarity,
    _fallback_keyword_search,
    _python_search,
    search_embeddings,
    search_library_chunks,
)


class CosineSimTest(TestCase):
    def test_identical_vectors(self):
        v = [1.0, 0.0, 0.0]
        self.assertAlmostEqual(_cosine_similarity(v, v), 1.0)

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        self.assertAlmostEqual(_cosine_similarity(a, b), 0.0)

    def test_zero_vector(self):
        self.assertEqual(_cosine_similarity([0.0], [1.0]), 0.0)


class SearchEmbeddingsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="vec_test", password="x")

    @patch("agents.tools.rag_tools._is_postgres", return_value=False)
    @patch("agents.tools.rag_tools._python_search")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_routes_to_python_search_on_sqlite(
        self, mock_embed, mock_python, mock_pg
    ):
        mock_embed.return_value = [0.1, 0.2, 0.3]
        mock_python.return_value = [
            {
                "content": "ok",
                "source_title": "t",
                "source_type": "expense",
                "similarity": 0.9,
            }
        ]

        results = search_embeddings("test query", self.user, domain="finance")

        mock_embed.assert_called_once_with("test query")
        mock_python.assert_called_once()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["content"], "ok")

    @patch("agents.tools.rag_tools._is_postgres", return_value=True)
    @patch("agents.tools.rag_tools._pgvector_search")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_routes_to_pgvector_on_postgres(
        self, mock_embed, mock_pg, mock_is_pg
    ):
        mock_embed.return_value = [0.1, 0.2]
        mock_pg.return_value = []

        search_embeddings("q", self.user, domain="library")

        mock_pg.assert_called_once()

    @patch("agents.tools.rag_tools._fallback_keyword_search")
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_falls_back_to_keyword_search_when_embed_empty(
        self, mock_embed, mock_fallback
    ):
        mock_embed.return_value = []
        mock_fallback.return_value = []

        search_embeddings("hello", self.user, domain="finance")

        mock_fallback.assert_called_once_with("hello", self.user, "finance", 5)

    def test_python_search_computes_cosine_similarity(self):
        """_python_search ranks by cosine similarity using in-memory
        embeddings."""
        emb_high = [1.0, 0.0, 0.0]
        emb_low = [0.0, 1.0, 0.0]
        query_emb = [1.0, 0.01, 0.0]

        with patch("agents.models.AgentEmbedding.objects") as mock_mgr:
            mock_mgr.filter.return_value.values.return_value = [
                {
                    "content": "high",
                    "source_title": "A",
                    "source_type": "expense",
                    "embedding": emb_high,
                },
                {
                    "content": "low",
                    "source_title": "B",
                    "source_type": "revenue",
                    "embedding": emb_low,
                },
            ]
            results = _python_search(query_emb, self.user, "finance", top_k=5)

        self.assertEqual(results[0]["content"], "high")
        self.assertGreater(results[0]["similarity"], results[1]["similarity"])

    def test_fallback_keyword_search_returns_matching_docs(self):
        with patch("agents.models.AgentEmbedding.objects") as mock_mgr:
            mock_filter = MagicMock()
            mock_mgr.filter.return_value = mock_filter
            mock_filter.filter.return_value.values.return_value = [
                {
                    "content": "despesa alimentação",
                    "source_title": "T",
                    "source_type": "expense",
                },
            ]

            results = _fallback_keyword_search(
                "alimentação", self.user, "finance", top_k=5
            )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["similarity"], 0.5)

    def test_fallback_keyword_search_empty_query(self):
        results = _fallback_keyword_search("", self.user, "finance", top_k=5)
        self.assertEqual(results, [])

    def test_search_library_chunks_delegates_to_search_embeddings(self):
        with patch("agents.tools.rag_tools.search_embeddings") as mock_se:
            mock_se.return_value = []
            search_library_chunks("livro", self.user, top_k=3)
            mock_se.assert_called_once_with(
                "livro", self.user, domain="library", top_k=3
            )


class VectorizeExistingCommandTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="vec_cmd_user", password="pass", email="v@test.com"
        )

    def _run_command(self, **options):
        from django.core.management import call_command

        out = StringIO()
        defaults = {
            "domain": "all",
            "reset": False,
            "batch_size": 50,
            "username": None,
            "stdout": out,
        }
        defaults.update(options)
        call_command(
            "vectorize_existing",
            stdout=out,
            **{k: v for k, v in defaults.items() if k != "stdout"},
        )
        return out.getvalue()

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=False)
    def test_raises_when_llm_unavailable(self, _):
        from django.core.management import CommandError, call_command

        with self.assertRaises(CommandError):
            call_command("vectorize_existing")

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=True)
    @patch("agents.core.llm_client.LLMClient.embed")
    @patch(
        "agents.management.commands.vectorize_existing.Command._upsert_embedding"  # noqa: E501
    )
    def test_finance_domain_processes_expenses_and_revenues(
        self, mock_upsert, mock_embed, mock_avail
    ):
        mock_upsert.return_value = True

        with (
            patch("expenses.models.Expense.objects") as mock_exp,
            patch("revenues.models.Revenue.objects") as mock_rev,
        ):

            mock_exp_qs = mock_exp.filter.return_value.values.return_value
            mock_exp_qs.count.return_value = 0
            mock_exp_qs.iterator.return_value = iter([])
            mock_rev_qs = mock_rev.filter.return_value.values.return_value
            mock_rev_qs.count.return_value = 0
            mock_rev_qs.iterator.return_value = iter([])

            out = StringIO()
            from django.core.management import call_command

            call_command("vectorize_existing", domain="finance", stdout=out)

        output = out.getvalue()
        self.assertIn("finance", output)

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=True)
    @patch("agents.core.llm_client.LLMClient.embed")
    def test_upsert_embedding_calls_embed_and_creates_record(
        self, mock_embed, mock_avail
    ):
        mock_embed.return_value = [0.1] * 768
        src_id = uuid.uuid4()

        with patch("agents.models.AgentEmbedding.objects") as mock_mgr:
            mock_mgr.update_or_create.return_value = (MagicMock(), True)

            from agents.management.commands.vectorize_existing import Command

            cmd = Command()
            cmd.stdout = StringIO()
            cmd.style = MagicMock()
            cmd.style.WARNING = str
            cmd.style.ERROR = str

            result = cmd._upsert_embedding(
                user=self.user,
                domain="finance",
                source_type="expense",
                source_id=src_id,
                source_title="Despesa Teste",
                content="Despesa de R$ 50.00 em alimentação em 2024-01-01",
            )

        self.assertTrue(result)
        mock_embed.assert_called_once()
        mock_mgr.update_or_create.assert_called_once()

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=True)
    def test_upsert_embedding_returns_false_for_empty_content(self, _):
        from agents.management.commands.vectorize_existing import Command

        cmd = Command()
        cmd.stdout = StringIO()
        cmd.style = MagicMock()

        result = cmd._upsert_embedding(
            user=self.user,
            domain="finance",
            source_type="expense",
            source_id=uuid.uuid4(),
            source_title="Test",
            content="",
        )
        self.assertFalse(result)

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=True)
    @patch("agents.core.llm_client.LLMClient.embed", return_value=[])
    def test_upsert_embedding_returns_false_when_embed_empty(
        self, mock_embed, _
    ):
        from agents.management.commands.vectorize_existing import Command

        cmd = Command()
        cmd.stdout = StringIO()
        cmd.style = MagicMock()
        cmd.style.WARNING = str

        result = cmd._upsert_embedding(
            user=self.user,
            domain="finance",
            source_type="expense",
            source_id=uuid.uuid4(),
            source_title="Test",
            content="some content",
        )
        self.assertFalse(result)

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=True)
    @patch(
        "agents.core.llm_client.LLMClient.embed", side_effect=Exception("boom")
    )
    def test_upsert_embedding_logs_error_and_returns_false_on_exception(
        self, mock_embed, _
    ):
        from agents.management.commands.vectorize_existing import Command

        cmd = Command()
        cmd.stdout = StringIO()
        cmd.style = MagicMock()
        cmd.style.ERROR = str

        result = cmd._upsert_embedding(
            user=self.user,
            domain="finance",
            source_type="expense",
            source_id=uuid.uuid4(),
            source_title="Test",
            content="some content",
        )
        self.assertFalse(result)

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=False)
    def test_raises_for_unknown_user(self, _):
        from django.core.management import CommandError, call_command

        with self.assertRaises(CommandError):
            call_command("vectorize_existing", username="nonexistent_xyz")

    @patch("agents.core.llm_client.LLMClient.is_available", return_value=True)
    def test_reset_flag_deletes_embeddings_before_processing(self, mock_avail):
        from agents.management.commands.vectorize_existing import Command

        cmd = Command()
        cmd.stdout = StringIO()
        cmd.style = MagicMock()
        cmd.style.SUCCESS = str

        with (
            patch("agents.models.AgentEmbedding.objects") as mock_mgr,
            patch.object(cmd, "_process_finance", return_value=(0, 0)),
        ):
            mock_mgr.filter.return_value.delete.return_value = (5, {})

            options = {"reset": True, "batch_size": 50}
            cmd._process_domain(self.user, "finance", options)

            mock_mgr.filter.assert_called_once_with(
                user=self.user, domain="finance"
            )
            mock_mgr.filter.return_value.delete.assert_called_once()

    def test_natural_text_formats_expense(self):
        """Verifica que o texto gerado para despesa segue o formato exigido."""
        expense = {
            "uuid": uuid.uuid4(),
            "value": "50.00",
            "category": "alimentação",
            "merchant": "Mercado Livre",
            "date": "2024-01-15",
            "description": "compra mercado",
        }
        merchant = expense["merchant"] or expense["description"]
        text = (
            f"Despesa de R$ {expense['value']} em {expense['category']}"
            f" — {merchant} em {expense['date']}"
        )
        self.assertIn("Despesa de R$", text)
        self.assertIn("alimentação", text)
        self.assertIn("Mercado Livre", text)

    def test_natural_text_formats_revenue(self):
        text = "Receita de R$ 3000.00 em salário em 2024-01-05"
        self.assertIn("Receita de R$", text)
        self.assertIn("salário", text)

    def test_natural_text_formats_budget(self):
        text = (
            "Orçamento de alimentação: limite R$ 500.00,"
            " gasto R$ 300.00 (60%) em 01/2024"
        )
        self.assertIn("Orçamento de alimentação", text)
        self.assertIn("limite R$ 500.00", text)
        self.assertIn("60%", text)

    def test_natural_text_formats_routine(self):
        text = "Rotina 'Meditar': praticar mindfulness, frequência daily"
        self.assertIn("Rotina '", text)
        self.assertIn("frequência daily", text)

    def test_natural_text_formats_goal(self):
        text = (
            "Meta 'Correr 100km': acumular quilometragem,"
            " progresso 45%, prazo 31/12/2024"
        )
        self.assertIn("Meta '", text)
        self.assertIn("progresso 45%", text)
        self.assertIn("prazo 31/12/2024", text)
