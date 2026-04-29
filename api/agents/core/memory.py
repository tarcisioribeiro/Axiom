import json
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_MAX_TURNS = 10
_TTL = 3600  # 1 hora


class ConversationMemory:
    """Gerencia o histórico de conversa por usuário/sessão via Redis."""

    @staticmethod
    def _key(user_id: int, session_id: str) -> str:
        return f"agent_memory:{user_id}:{session_id}"

    @classmethod
    def get(cls, user_id: int, session_id: str) -> list[dict[str, str]]:
        try:
            raw = cache.get(cls._key(user_id, session_id))
            if not raw:
                return []
            result: list[dict[str, str]] = json.loads(raw)
            return result
        except Exception as exc:
            logger.warning("Memory read failed: %s", exc)
            return []

    @classmethod
    def append(cls, user_id: int, session_id: str, query: str, answer: str) -> None:
        try:
            history = cls.get(user_id, session_id)
            history.append({"role": "user", "content": query})
            history.append({"role": "agent", "content": answer})
            history = history[-(_MAX_TURNS * 2) :]
            cache.set(cls._key(user_id, session_id), json.dumps(history), _TTL)
        except Exception as exc:
            logger.warning("Memory write failed: %s", exc)

    @classmethod
    def clear(cls, user_id: int, session_id: str) -> None:
        cache.delete(cls._key(user_id, session_id))

    @classmethod
    def format_for_prompt(cls, history: list[dict[str, str]]) -> str:
        if not history:
            return ""
        lines = []
        for msg in history[-6:]:
            role = "Usuário" if msg["role"] == "user" else "Assistente"
            lines.append(f"{role}: {msg['content']}")
        return "\n".join(lines)
