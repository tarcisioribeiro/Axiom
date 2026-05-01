import json
import logging
import os
from collections.abc import Generator
from typing import Any

import requests

logger = logging.getLogger(__name__)

_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
_OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")
_OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
_GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
_TIMEOUT_CHAT = int(os.getenv("LLM_TIMEOUT_CHAT", "120"))
_TIMEOUT_EMBED = int(os.getenv("LLM_TIMEOUT_EMBED", "30"))


class LLMClient:
    """Abstração sobre Ollama (local), Groq (nuvem) ou Anthropic API."""

    @classmethod
    def chat(
        cls,
        messages: list[dict[str, str]],
        stream: bool = False,
        model: str | None = None,
    ) -> str:
        """Envia lista de mensagens ao LLM. model sobrescreve o env var global."""
        try:
            if _PROVIDER == "anthropic":
                return cls._anthropic_chat(messages, model=model)
            if _PROVIDER == "groq":
                return cls._groq_chat(messages, model=model)
            return cls._ollama_chat(messages, model=model)
        except Exception as exc:
            logger.error("LLM chat failed: %s", exc, exc_info=True)
            return "Desculpe, não foi possível processar sua pergunta no momento."

    @classmethod
    def stream_chat(
        cls,
        messages: list[dict[str, str]],
        model: str | None = None,
    ) -> Generator[str, None, None]:
        """Yields tokens conforme chegam do LLM."""
        try:
            if _PROVIDER == "anthropic":
                yield from cls._anthropic_stream(messages, model=model)
            elif _PROVIDER == "groq":
                yield from cls._groq_stream(messages, model=model)
            else:
                yield from cls._ollama_stream(messages, model=model)
        except Exception as exc:
            logger.error("LLM stream_chat failed: %s", exc, exc_info=True)
            yield "Desculpe, não foi possível processar sua pergunta no momento."

    @classmethod
    def complete(cls, prompt: str, system: str = "") -> str:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return cls.chat(messages)

    @classmethod
    def embed(cls, text: str) -> list[float]:
        # Embeddings sempre via Ollama (nomic-embed-text), independente do provider
        try:
            return cls._ollama_embed(text)
        except Exception as exc:
            logger.error("LLM embedding failed: %s", exc)
            return []

    # ── Ollama ────────────────────────────────────────────────────────────────

    @classmethod
    def _ollama_chat(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        effective_model = model or _OLLAMA_MODEL
        try:
            resp = requests.post(
                f"{_OLLAMA_URL}/api/chat",
                json={"model": effective_model, "messages": messages, "stream": False},
                timeout=_TIMEOUT_CHAT,
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return str(data["message"]["content"])
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                if effective_model != _OLLAMA_MODEL:
                    logger.warning(
                        "Ollama: modelo '%s' não encontrado, usando fallback '%s'",
                        effective_model,
                        _OLLAMA_MODEL,
                    )
                    return cls._ollama_chat(messages, model=_OLLAMA_MODEL)
            raise

    @classmethod
    def _ollama_stream(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> Generator[str, None, None]:
        effective_model = model or _OLLAMA_MODEL
        try:
            resp = requests.post(
                f"{_OLLAMA_URL}/api/chat",
                json={"model": effective_model, "messages": messages, "stream": True},
                timeout=_TIMEOUT_CHAT,
                stream=True,
            )
            resp.raise_for_status()
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                if effective_model != _OLLAMA_MODEL:
                    logger.warning(
                        "Ollama: modelo '%s' não encontrado, usando fallback '%s'",
                        effective_model,
                        _OLLAMA_MODEL,
                    )
                    yield from cls._ollama_stream(messages, model=_OLLAMA_MODEL)
                    return
            raise
        for line in resp.iter_lines():
            if line:
                chunk: dict[str, Any] = json.loads(line)
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token

    # ── Groq (OpenAI-compatible) ───────────────────────────────────────────────

    @classmethod
    def _groq_chat(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        effective_model = model or _GROQ_MODEL
        resp = requests.post(
            f"{_GROQ_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {_GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": effective_model, "messages": messages, "stream": False},
            timeout=_TIMEOUT_CHAT,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return str(data["choices"][0]["message"]["content"])

    @classmethod
    def _groq_stream(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> Generator[str, None, None]:
        effective_model = model or _GROQ_MODEL
        resp = requests.post(
            f"{_GROQ_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {_GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": effective_model, "messages": messages, "stream": True},
            timeout=_TIMEOUT_CHAT,
            stream=True,
        )
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            raw = line.decode("utf-8") if isinstance(line, bytes) else line
            if not raw.startswith("data: "):
                continue
            payload = raw[6:]
            if payload == "[DONE]":
                break
            try:
                chunk: dict[str, Any] = json.loads(payload)
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                token = delta.get("content", "")
                if token:
                    yield token
            except (json.JSONDecodeError, IndexError, KeyError):
                continue

    # ── Anthropic ─────────────────────────────────────────────────────────────

    @classmethod
    def _anthropic_chat(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        import anthropic

        client = anthropic.Anthropic()
        system_text = "Você é um assistente financeiro pessoal."
        chat_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                chat_messages.append({"role": msg["role"], "content": msg["content"]})

        effective_model: str = (
            model
            or os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            or "claude-haiku-4-5-20251001"
        )
        sdk_messages: list[Any] = chat_messages
        result = client.messages.create(
            model=effective_model,
            max_tokens=1024,
            system=system_text,
            messages=sdk_messages,
        )
        return str(result.content[0].text)  # type: ignore[union-attr]

    @classmethod
    def _anthropic_stream(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> Generator[str, None, None]:
        import anthropic

        client = anthropic.Anthropic()
        system_text = "Você é um assistente financeiro pessoal."
        chat_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                chat_messages.append({"role": msg["role"], "content": msg["content"]})

        effective_model: str = (
            model
            or os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            or "claude-haiku-4-5-20251001"
        )
        sdk_messages: list[Any] = chat_messages
        with client.messages.stream(
            model=effective_model,
            max_tokens=1024,
            system=system_text,
            messages=sdk_messages,
        ) as stream:
            for event in stream:
                if hasattr(event, "delta") and hasattr(event.delta, "text"):
                    yield event.delta.text

    # ── Embeddings ─────────────────────────────────────────────────────────────

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

    # ── Status ─────────────────────────────────────────────────────────────────

    @classmethod
    def is_available(cls) -> bool:
        """Verifica se o LLM está acessível."""
        try:
            if _PROVIDER == "anthropic":
                return bool(os.getenv("ANTHROPIC_API_KEY"))
            if _PROVIDER == "groq":
                return bool(_GROQ_API_KEY)
            resp = requests.get(f"{_OLLAMA_URL}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    @classmethod
    def list_models(cls) -> list[str]:
        """Retorna modelos disponíveis."""
        if _PROVIDER == "groq":
            return [_GROQ_MODEL]
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
