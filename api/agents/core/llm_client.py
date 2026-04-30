import json
import logging
import os
from typing import Any

import requests

logger = logging.getLogger(__name__)

_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
_OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")
_OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
_TIMEOUT_CHAT = int(os.getenv("LLM_TIMEOUT_CHAT", "120"))
_TIMEOUT_EMBED = int(os.getenv("LLM_TIMEOUT_EMBED", "30"))


class LLMClient:
    """Abstração sobre Ollama (local) ou Anthropic API."""

    @classmethod
    def complete(cls, prompt: str, system: str = "") -> str:
        try:
            if _PROVIDER == "anthropic":
                return cls._anthropic(prompt, system)
            return cls._ollama(prompt, system)
        except Exception as exc:
            logger.error("LLM completion failed: %s", exc)
            return "Desculpe, não foi possível processar sua pergunta no momento."

    @classmethod
    def embed(cls, text: str) -> list[float]:
        try:
            return cls._ollama_embed(text)
        except Exception as exc:
            logger.error("LLM embedding failed: %s", exc)
            return []

    @classmethod
    def _ollama(cls, prompt: str, system: str) -> str:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = requests.post(
            f"{_OLLAMA_URL}/api/chat",
            json={"model": _OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=_TIMEOUT_CHAT,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return str(data["message"]["content"])

    @classmethod
    def _anthropic(cls, prompt: str, system: str) -> str:
        import anthropic

        client = anthropic.Anthropic()
        system_text = system or "Você é um assistente financeiro pessoal."
        msg = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=1024,
            system=system_text,
            messages=[{"role": "user", "content": prompt}],
        )
        return str(msg.content[0].text)  # type: ignore[union-attr]

    @classmethod
    def _ollama_embed(cls, text: str) -> list[float]:
        resp = requests.post(
            f"{_OLLAMA_URL}/api/embeddings",
            json={"model": _OLLAMA_EMBED_MODEL, "prompt": text},
            timeout=_TIMEOUT_EMBED,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return list(data["embedding"])

    @classmethod
    def is_available(cls) -> bool:
        """Verifica se o LLM está acessível."""
        try:
            if _PROVIDER == "anthropic":
                return bool(os.getenv("ANTHROPIC_API_KEY"))
            resp = requests.get(f"{_OLLAMA_URL}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    @classmethod
    def list_models(cls) -> list[str]:
        """Retorna modelos disponíveis no Ollama."""
        try:
            resp = requests.get(f"{_OLLAMA_URL}/api/tags", timeout=5)
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []

    @classmethod
    def serialize_embedding(cls, embedding: list[float]) -> str:
        return json.dumps(embedding)

    @classmethod
    def deserialize_embedding(cls, raw: str) -> list[float]:
        result: list[float] = json.loads(raw)
        return result
