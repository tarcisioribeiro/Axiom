import json
import os
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
        with patch.dict(os.environ, {"LLM_PROVIDER": "ollama"}):
            self.assertEqual(agent.get_model(), "qwen2.5:7b")

    def test_get_model_anthropic_returns_haiku(self) -> None:
        from agents.agents.finance_agent import FinanceAgent

        agent = FinanceAgent()
        with patch.dict(os.environ, {"LLM_PROVIDER": "anthropic"}):
            self.assertEqual(agent.get_model(), "claude-haiku-4-5-20251001")


class TestLLMClientChat(TestCase):
    @patch("agents.core.llm_client._PROVIDER", "ollama")
    @patch("requests.post")
    def test_chat_sends_custom_model_in_payload(self, mock_post: MagicMock) -> None:
        from agents.core.llm_client import LLMClient

        mock_response = MagicMock()
        mock_response.json.return_value = {"message": {"content": "test response"}}
        mock_post.return_value = mock_response

        messages = [{"role": "user", "content": "Hello"}]
        LLMClient.chat(messages, model="custom-model")

        mock_post.assert_called_once()
        json_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(json_payload["model"], "custom-model")

    @patch("agents.core.llm_client._PROVIDER", "ollama")
    @patch("agents.core.llm_client._OLLAMA_MODEL", "global-default")
    @patch("requests.post")
    def test_chat_uses_global_model_when_none_provided(
        self, mock_post: MagicMock
    ) -> None:
        from agents.core.llm_client import LLMClient

        mock_response = MagicMock()
        mock_response.json.return_value = {"message": {"content": "test response"}}
        mock_post.return_value = mock_response

        messages = [{"role": "user", "content": "Hello"}]
        LLMClient.chat(messages)

        json_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(json_payload["model"], "global-default")


def _make_mock_agent(tokens: list[str], sources: list[str] | None = None) -> MagicMock:
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
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="stream_test_user",
            email="stream@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def _post_stream(self, query: str = "test question") -> StreamingHttpResponse:
        return self.client.post(
            "/api/v1/agents/stream/",
            {"query": query, "session_id": "test-session"},
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
        mock_select.return_value = _make_mock_agent(["Hel", "lo"], sources=["src1"])
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
            self.user.pk, "test-session", "my question", "answer"
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
        # Django wraps streaming_content in a map object; wrap in a genexp so we
        # get a closeable generator that simulates a client disconnect mid-stream.
        gen = (chunk for chunk in response.streaming_content)
        next(gen)  # consume first event
        try:
            gen.close()  # simulate disconnect — must not raise
        except Exception as exc:
            self.fail(f"Unexpected exception on generator close: {exc}")
