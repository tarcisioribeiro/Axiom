import json
import uuid
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken


class TestFinanceAgentGetModel(TestCase):
    def test_get_model_ollama_returns_qwen(self) -> None:
        from agents.agents.finance_agent import FinanceAgent

        agent = FinanceAgent()
        with patch("agents.core.base_agent.cfg", return_value="ollama"):
            self.assertEqual(agent.get_model(), "qwen2.5:7b")

    def test_get_model_anthropic_returns_haiku(self) -> None:
        from agents.agents.finance_agent import FinanceAgent

        agent = FinanceAgent()
        with patch("agents.core.base_agent.cfg", return_value="anthropic"):
            self.assertEqual(agent.get_model(), "claude-haiku-4-5-20251001")


def _cfg_ollama_only(key: str, default: object = None) -> object:
    return "ollama" if key == "LLM_PROVIDER" else default


def _cfg_ollama_global_model(key: str, default: object = None) -> object:
    if key == "LLM_PROVIDER":
        return "ollama"
    if key == "OLLAMA_MODEL":
        return "global-default"
    return default


class TestLLMClientChat(TestCase):
    @patch("agents.core.llm_client._cfg", side_effect=_cfg_ollama_only)
    @patch("requests.post")
    def test_chat_sends_custom_model_in_payload(
        self, mock_post: MagicMock, _mock_cfg: MagicMock
    ) -> None:
        from agents.core.llm_client import LLMClient

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "test response"}
        }
        mock_post.return_value = mock_response

        messages = [{"role": "user", "content": "Hello"}]
        LLMClient.chat(messages, model="custom-model")

        mock_post.assert_called_once()
        json_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(json_payload["model"], "custom-model")

    @patch("agents.core.llm_client._cfg", side_effect=_cfg_ollama_global_model)
    @patch("requests.post")
    def test_chat_uses_global_model_when_none_provided(
        self, mock_post: MagicMock, _mock_cfg: MagicMock
    ) -> None:
        from agents.core.llm_client import LLMClient

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "test response"}
        }
        mock_post.return_value = mock_response

        messages = [{"role": "user", "content": "Hello"}]
        LLMClient.chat(messages)

        json_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(json_payload["model"], "global-default")


class _SyncThread:
    """Replaces threading.Thread in tests — runs target synchronously on
    start()."""

    def __init__(self, target=None, daemon=False, **kwargs):
        self._target = target

    def start(self) -> None:
        if self._target:
            self._target()


def _make_mock_agent(
    tokens: list[str], sources: list[str] | None = None
) -> MagicMock:
    """Build a mock agent whose stream() yields the given tokens."""
    mock_agent = MagicMock()
    mock_agent.name = "MockAgent"
    mock_agent._stream_sources = sources or []

    def _stream_side_effect(ctx: object) -> object:
        mock_agent._stream_sources = sources or []
        yield from tokens

    mock_agent.stream.side_effect = _stream_side_effect
    return mock_agent


class TestAgentStreamView(APITestCase):
    _SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="stream_test_user",
            email="stream@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _post_stream(
        self, query: str = "test question"
    ) -> StreamingHttpResponse:
        return self.client.post(
            "/api/v1/agents/stream/",
            {"query": query, "session_id": self._SESSION_ID},
            content_type="application/json",
        )

    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_returns_event_stream_content_type(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        mock_select.return_value = _make_mock_agent(["Hello"])
        mock_memory.get.return_value = []

        response = self._post_stream()

        self.assertIsInstance(response, StreamingHttpResponse)
        self.assertIn("text/event-stream", response["Content-Type"])

    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_contains_token_and_done_events(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        mock_select.return_value = _make_mock_agent(
            ["Hel", "lo"], sources=["src1"]
        )
        mock_memory.get.return_value = []

        response = self._post_stream()
        content = b"".join(response.streaming_content).decode()

        events = [
            json.loads(line[len("data: ") :])
            for line in content.splitlines()
            if line.startswith("data: ")
        ]
        tokens = [e["token"] for e in events if "token" in e]
        done_events = [e for e in events if e.get("done") is True]

        self.assertEqual(tokens, ["Hel", "lo"])
        self.assertEqual(len(done_events), 1)
        self.assertEqual(done_events[0]["agent"], "MockAgent")
        self.assertEqual(done_events[0]["sources"], ["src1"])
        self.assertIn("query_id", done_events[0])

    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_tokens_arrive_in_order(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        tokens = ["one", " two", " three"]
        mock_select.return_value = _make_mock_agent(tokens)
        mock_memory.get.return_value = []

        response = self._post_stream()
        content = b"".join(response.streaming_content).decode()

        collected = [
            json.loads(line[len("data: ") :])["token"]
            for line in content.splitlines()
            if line.startswith("data: ") and '"token"' in line
        ]
        self.assertEqual(collected, tokens)

    @patch("agents.views.threading.Thread", _SyncThread)
    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_saves_conversation_after_completion(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        mock_select.return_value = _make_mock_agent(["answer"])
        mock_memory.get.return_value = []

        response = self._post_stream("my question")
        b"".join(response.streaming_content)

        mock_memory.append.assert_called_once_with(
            self.user.pk, self._SESSION_ID, "my question", "answer"
        )
        mock_conv.objects.bulk_create.assert_called_once()

    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_invalid_request_returns_400(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        response = self.client.post(
            "/api/v1/agents/stream/",
            {},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_required_headers_present(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        mock_select.return_value = _make_mock_agent([])
        mock_memory.get.return_value = []

        response = self._post_stream()
        b"".join(response.streaming_content)

        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertEqual(response["X-Accel-Buffering"], "no")

    @patch("agents.views.AgentConversation")
    @patch("agents.views.ConversationMemory")
    @patch("agents.views.AgentRouter.select")
    def test_stream_disconnection_no_unhandled_exception(
        self,
        mock_select: MagicMock,
        mock_memory: MagicMock,
        mock_conv: MagicMock,
    ) -> None:
        mock_select.return_value = _make_mock_agent(["tok1", "tok2", "tok3"])
        mock_memory.get.return_value = []

        response = self._post_stream()
        # Django wraps streaming_content in a map object; wrap in a genexp
        # so we get a closeable generator that simulates a client disconnect
        # mid-stream.
        gen = (chunk for chunk in response.streaming_content)
        next(gen)  # consume first event
        try:
            gen.close()  # simulate disconnect — must not raise
        except Exception as exc:
            self.fail(f"Unexpected exception on generator close: {exc}")


class TestAgentAskViewQueryId(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="ask_qid_user",
            email="ask_qid@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    @patch("agents.views.AgentRouter.route")
    @patch("agents.views.ConversationMemory")
    def test_ask_response_contains_query_id(
        self, mock_memory: MagicMock, mock_route: MagicMock
    ) -> None:
        from agents.core.base_agent import AgentResponse

        mock_route.return_value = AgentResponse(
            content="answer", agent_name="finance"
        )
        mock_memory.get.return_value = []

        session = "550e8400-e29b-41d4-a716-446655440001"
        response = self.client.post(
            "/api/v1/agents/ask/",
            {"query": "test question", "session_id": session},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("query_id", response.data)
        # Must be a valid UUID string
        parsed = uuid.UUID(response.data["query_id"])
        self.assertIsInstance(parsed, uuid.UUID)

    @patch("agents.views.threading.Thread", _SyncThread)
    @patch("agents.views.AgentRouter.route")
    @patch("agents.views.ConversationMemory")
    def test_ask_saves_query_id_to_conversation(
        self, mock_memory: MagicMock, mock_route: MagicMock
    ) -> None:
        from agents.core.base_agent import AgentResponse
        from agents.models import AgentConversation

        mock_route.return_value = AgentResponse(
            content="answer", agent_name="finance"
        )
        mock_memory.get.return_value = []

        session = "550e8400-e29b-41d4-a716-446655440002"
        response = self.client.post(
            "/api/v1/agents/ask/",
            {"query": "save test", "session_id": session},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        returned_qid = uuid.UUID(response.data["query_id"])
        records = AgentConversation.objects.filter(
            user=self.user, query_id=returned_qid
        )
        self.assertEqual(records.count(), 2)
        roles = set(records.values_list("role", flat=True))
        self.assertEqual(roles, {"user", "agent"})


class TestAgentRouterSemantic(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="router_sem_user",
            email="router_sem@test.com",
            password="testpass123",
        )

    @patch("agents.core.router.semantic_domain_scores")
    @patch("agents.core.router.LLMClient")
    def test_semantic_bonus_selects_library_domain_agent(
        self, mock_llm: MagicMock, mock_scores: MagicMock
    ) -> None:
        from agents.core.base_agent import AgentContext
        from agents.core.router import AgentRouter

        mock_llm.embed.return_value = [0.1] * 4
        mock_scores.return_value = {
            "finance": 0.1,
            "budget": 0.1,
            "planning": 0.1,
            "library": 0.95,
            "general": 0.1,
        }

        ctx = AgentContext(user_id=self.user.pk, query="livro resumo leitura")
        agent = AgentRouter.select(ctx)

        # Both 'intellect' and 'library' agents map to the library domain —
        # either is a valid selection when semantic score is high for that
        # domain.
        self.assertIn(agent.name, {"library", "intellect"})
        mock_scores.assert_called_once_with([0.1] * 4, self.user.pk)

    @patch("agents.core.router.LLMClient")
    def test_routing_uses_keywords_when_embed_fails(
        self, mock_llm: MagicMock
    ) -> None:
        from agents.core.base_agent import AgentContext
        from agents.core.router import AgentRouter

        mock_llm.embed.return_value = []  # failed embed

        ctx = AgentContext(
            user_id=self.user.pk, query="despesas gastos financeiro conta"
        )
        agent = AgentRouter.select(ctx)

        # Must not raise and must return a valid agent
        self.assertIsNotNone(agent)
        self.assertIsNotNone(agent.name)

    @patch("agents.core.router.semantic_domain_scores")
    @patch("agents.core.router.LLMClient")
    def test_routing_continues_when_semantic_scoring_raises(
        self, mock_llm: MagicMock, mock_scores: MagicMock
    ) -> None:
        from agents.core.base_agent import AgentContext
        from agents.core.router import AgentRouter

        mock_llm.embed.return_value = [0.1] * 4
        mock_scores.side_effect = RuntimeError("DB unavailable")

        ctx = AgentContext(user_id=self.user.pk, query="qualquer pergunta")
        # Must not raise even when semantic_domain_scores blows up
        agent = AgentRouter.select(ctx)
        self.assertIsNotNone(agent)


class TestNewModularAgents(TestCase):
    """Testes básicos dos 4 novos agentes modulares."""

    def _assert_model(
        self, agent_cls, provider: str, expected_model: str
    ) -> None:
        agent = agent_cls()
        with patch("agents.core.base_agent.cfg", return_value=provider):
            self.assertEqual(agent.get_model(), expected_model)

    def test_personal_agent_ollama_model(self) -> None:
        from agents.agents.personal_agent import PersonalAgent

        self._assert_model(PersonalAgent, "ollama", "llama3.1:8b")

    def test_personal_agent_anthropic_model(self) -> None:
        from agents.agents.personal_agent import PersonalAgent

        self._assert_model(PersonalAgent, "anthropic", "claude-sonnet-4-6")

    def test_financial_agent_ollama_model(self) -> None:
        from agents.agents.financial_agent import FinancialAgent

        self._assert_model(FinancialAgent, "ollama", "qwen2.5:14b")

    def test_financial_agent_anthropic_model(self) -> None:
        from agents.agents.financial_agent import FinancialAgent

        self._assert_model(FinancialAgent, "anthropic", "claude-sonnet-4-6")

    def test_security_agent_ollama_model(self) -> None:
        from agents.agents.security_agent import SecurityAgent

        self._assert_model(SecurityAgent, "ollama", "mistral:7b-instruct")

    def test_security_agent_anthropic_model(self) -> None:
        from agents.agents.security_agent import SecurityAgent

        self._assert_model(SecurityAgent, "anthropic", "claude-sonnet-4-6")

    def test_intellect_agent_ollama_model(self) -> None:
        from agents.agents.intellect_agent import IntellectAgent

        self._assert_model(IntellectAgent, "ollama", "llama3.1:8b")

    def test_intellect_agent_anthropic_model(self) -> None:
        from agents.agents.intellect_agent import IntellectAgent

        self._assert_model(IntellectAgent, "anthropic", "claude-sonnet-4-6")

    def test_personal_agent_can_handle_high_score(self) -> None:
        from agents.agents.personal_agent import PersonalAgent

        agent = PersonalAgent()
        score = agent.can_handle(
            "quais são minhas rotinas de treino e nutrição hoje?"
        )
        self.assertGreater(score, 0.2)

    def test_financial_agent_can_handle_high_score(self) -> None:
        from agents.agents.financial_agent import FinancialAgent

        agent = FinancialAgent()
        score = agent.can_handle(
            "quanto gastei em despesas esse mês no cartão?"
        )
        self.assertGreater(score, 0.2)

    def test_security_agent_can_handle_high_score(self) -> None:
        from agents.agents.security_agent import SecurityAgent

        agent = SecurityAgent()
        score = agent.can_handle("quantas senhas tenho cadastradas no cofre?")
        self.assertGreater(score, 0.2)

    def test_intellect_agent_can_handle_high_score(self) -> None:
        from agents.agents.intellect_agent import IntellectAgent

        agent = IntellectAgent()
        score = agent.can_handle(
            "quais livros li e quais cursos completei esse mês?"
        )
        self.assertGreater(score, 0.2)

    def test_router_select_by_name_personal(self) -> None:
        from agents.core.router import AgentRouter

        agent = AgentRouter.select_by_name("personal")
        self.assertIsNotNone(agent)
        self.assertEqual(agent.name, "personal")  # type: ignore[union-attr]

    def test_router_select_by_name_financial(self) -> None:
        from agents.core.router import AgentRouter

        agent = AgentRouter.select_by_name("financial")
        self.assertIsNotNone(agent)
        self.assertEqual(agent.name, "financial")  # type: ignore[union-attr]

    def test_router_select_by_name_invalid_returns_none(self) -> None:
        from agents.core.router import AgentRouter

        agent = AgentRouter.select_by_name("nonexistent_agent")
        self.assertIsNone(agent)
