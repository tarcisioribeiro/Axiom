import os
from unittest.mock import MagicMock, patch

from django.test import TestCase


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
