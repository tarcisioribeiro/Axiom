"""A análise da IA (autoestima e impulso) roda no worker, fora do pedido.

Antes o LLM era chamado dentro do POST: com o Ollama lento o pedido levava
120 s, o frontend desistia em 30 s e o registro era salvo mesmo assim.
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import CrisisImpulseLog, SelfEsteemAssessment

CHAT = "agents.core.llm_client.LLMClient.chat"
ANSWERS = {f"q{i}": 2 for i in range(1, 11)}


class WellnessAiAsyncTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="ai_async", email="ai@test.com", password="testpass123"
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        Member.objects.create(
            name="AI User",
            document_hash="a" * 64,
            phone="11999999944",
            sex="M",
            user=self.user,
        )

    def test_self_esteem_responds_before_llm(self):
        with patch(CHAT, side_effect=TimeoutError) as chat:
            with self.captureOnCommitCallbacks() as callbacks:
                resp = self.client.post(
                    "/api/v1/personal-planning/wellness/self-esteem/",
                    {"assessed_at": "2026-10-15", **ANSWERS},
                    format="json",
                )
            self.assertEqual(resp.status_code, 201)
            chat.assert_not_called()  # nada de LLM dentro do pedido

            # No worker, a falha do LLM não quebra nem apaga o registro
            for callback in callbacks:
                callback()
            chat.assert_called_once()
        self.assertEqual(SelfEsteemAssessment.objects.count(), 1)

    def test_crisis_responds_before_llm(self):
        with patch(CHAT, side_effect=TimeoutError) as chat:
            with self.captureOnCommitCallbacks(execute=True):
                resp = self.client.post(
                    "/api/v1/personal-planning/wellness/crisis/",
                    {"emotional_state": "anxiety", "impulse_type": "other"},
                    format="json",
                )
                chat.assert_not_called()
            chat.assert_called_once()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(CrisisImpulseLog.objects.count(), 1)
