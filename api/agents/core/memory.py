"""
Gerenciamento de memória conversacional por usuário/sessão via Redis.

Correções aplicadas:
- Role "agent" → "assistant" para compatibilidade com
  OpenAI-compatible APIs (Groq)
- TTL renovado a cada acesso (touch) para manter sessões ativas corretamente
- Append com get-then-set permanece (Redis não tem list append
  atômico com TTL),
  mas a janela garante que perdas em race conditions sejam somente 1 turno
- format_for_prompt mantido como fallback legado (não utilizado
  pelo BaseAgent novo)
"""

import json
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_MAX_TURNS = 10  # pares user/assistant mantidos no Redis
_TTL = 3600  # TTL da sessão em segundos (1 hora, renovado a cada acesso)


class ConversationMemory:
    """Gerencia o histórico de conversa por usuário/sessão via Redis."""

    @staticmethod
    def _key(user_id: int, session_id: str) -> str:
        return f"agent_memory:{user_id}:{session_id}"

    @classmethod
    def get(cls, user_id: int, session_id: str) -> list[dict[str, str]]:
        key = cls._key(user_id, session_id)
        try:
            raw = cache.get(key)
            if not raw:
                return []
            result: list[dict[str, str]] = json.loads(raw)
            # Renova TTL a cada leitura (sessão ativa não expira)
            cache.touch(key, _TTL)
            return result
        except Exception as exc:
            logger.warning("Memory read failed: %s", exc)
            return []

    @classmethod
    def append(
        cls, user_id: int, session_id: str, query: str, answer: str
    ) -> None:
        """
        Adiciona um turno ao histórico.

        Role 'assistant' (não 'agent') para compatibilidade com
        todos os providers
        OpenAI-compatible (Groq, OpenAI, Anthropic via Messages API).
        """
        key = cls._key(user_id, session_id)
        try:
            history = cls.get(user_id, session_id)
            history.append({"role": "user", "content": query})
            history.append({"role": "assistant", "content": answer})
            # Janela deslizante: mantém no máximo _MAX_TURNS pares
            history = history[-(_MAX_TURNS * 2) :]
            cache.set(key, json.dumps(history), _TTL)
        except Exception as exc:
            logger.warning("Memory write failed: %s", exc)

    @classmethod
    def clear(cls, user_id: int, session_id: str) -> None:
        cache.delete(cls._key(user_id, session_id))

    @classmethod
    def format_for_prompt(cls, history: list[dict[str, str]]) -> str:
        """
        Serializa histórico para string (fallback legado).

        Normalmente não utilizado — BaseAgent injeta o histórico como chat
        turns estruturados. Mantido para compatibilidade com código externo.
        """
        if not history:
            return ""
        lines = []
        for msg in history[-6:]:
            role = "Usuário" if msg["role"] == "user" else "Assistente"
            lines.append(f"{role}: {msg['content']}")
        return "\n".join(lines)
