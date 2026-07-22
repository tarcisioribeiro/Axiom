"""
Cliente LLM com suporte a Ollama (local), Groq (cloud) e Anthropic.

Melhorias implementadas:
- Anthropic client reutilizado via singleton thread-safe
  (evita TCP+TLS por request)
- Circuit breaker para Ollama: após THRESHOLD falhas, fast-fail para fallback
cloud
- Cache de embeddings no Redis (TTL 5min) para evitar
  embed duplicado da mesma query
- Estimativa de tokens via contagem de chars (1 token ≈ 4 chars para português)
- max_tokens configurável via env LLM_MAX_TOKENS (padrão: 2048)
- embed() retorna [] em caso de falha silenciosa (não propaga para o pipeline)
"""

import hashlib
import json
import logging
import os
import threading
import time
from collections.abc import Callable, Generator
from typing import Any, Optional

import requests

from app.config import cfg as _cfg

logger = logging.getLogger(__name__)

_GROQ_BASE_URL = "https://api.groq.com/openai/v1"

_FALLBACK_ERROR: dict[str, str] = {
    "pt": "Desculpe, não foi possível processar sua pergunta no momento.",
    "en": "Sorry, I'm unable to process your request at this time.",
}

# ── Anthropic singleton
# ────────────────────────────────────────────────────────
_anthropic_client: Any = None
_anthropic_lock = threading.Lock()


def _get_anthropic_client() -> Any:
    """Retorna (e cria se necessário) o cliente Anthropic reutilizável."""
    global _anthropic_client
    if _anthropic_client is None:
        with _anthropic_lock:
            if _anthropic_client is None:
                import anthropic

                _anthropic_client = anthropic.Anthropic()
    return _anthropic_client


# ── Helpers
# ───────────────────────────────────────────────────────────────────


def _error_message(language: str = "pt-BR") -> str:
    prefix = language.split("-")[0].lower()
    return _FALLBACK_ERROR.get(prefix, _FALLBACK_ERROR["pt"])


def _estimate_tokens(text: str) -> int:
    """Aproximação de tokens: ~4 chars por token para português."""
    return max(1, len(text) // 4)


def _count_tokens_in(messages: list[dict[str, str]]) -> int:
    return sum(_estimate_tokens(m.get("content", "")) for m in messages)


# ── LLMClient
# ─────────────────────────────────────────────────────────────────


class LLMClient:
    """Abstração sobre Ollama (local), Groq (nuvem) ou Anthropic API."""

    @classmethod
    def _dispatch_chat(
        cls, provider: str, messages: list[dict[str, str]], model: str | None
    ) -> str:
        if provider == "anthropic":
            return cls._anthropic_chat(messages, model=model)
        if provider == "groq":
            return cls._groq_chat(messages, model=model)
        return cls._ollama_chat(messages, model=model)

    @classmethod
    def _dispatch_stream(
        cls, provider: str, messages: list[dict[str, str]], model: str | None
    ) -> Generator[str, None, None]:
        if provider == "anthropic":
            yield from cls._anthropic_stream(messages, model=model)
        elif provider == "groq":
            yield from cls._groq_stream(messages, model=model)
        else:
            yield from cls._ollama_stream(messages, model=model)

    @classmethod
    def _get_providers(cls) -> list[str]:
        primary = str(_cfg("LLM_PROVIDER", "ollama"))
        fallback_raw = _cfg("LLM_FALLBACK_PROVIDERS", "") or ""
        fallbacks = [
            p.strip()
            for p in str(fallback_raw).split(",")
            if p.strip() and p.strip() != primary
        ]
        return [primary] + fallbacks

    @classmethod
    def _should_skip_ollama(cls) -> bool:
        from agents.core.circuit_breaker import ollama_circuit

        return ollama_circuit.is_open

    @classmethod
    def chat(
        cls,
        messages: list[dict[str, str]],
        stream: bool = False,
        model: str | None = None,
        language: str = "pt-BR",
        agent_name: str = "unknown",
    ) -> str:
        record_llm_request: Optional[Callable[..., None]] = None
        record_llm_fallback: Optional[Callable[..., None]] = None
        try:
            from app.metrics import record_llm_fallback, record_llm_request
        except ImportError:
            pass

        providers = cls._get_providers()
        last_exc: Exception | None = None

        for i, provider in enumerate(providers):
            # Fast-fail Ollama quando circuit breaker está aberto
            if provider == "ollama" and cls._should_skip_ollama():
                logger.info(
                    "Ollama circuit breaker aberto"
                    " — pulando para próximo provider"
                )
                continue

            if i > 0 and record_llm_fallback is not None:
                record_llm_fallback(providers[i - 1], provider)

            t0 = time.monotonic()
            try:
                result = cls._dispatch_chat(provider, messages, model)
                duration = time.monotonic() - t0
                tokens_in = _count_tokens_in(messages)
                tokens_out = _estimate_tokens(result)
                if record_llm_request is not None:
                    record_llm_request(
                        provider,
                        agent_name,
                        "success",
                        duration,
                        tokens_in,
                        tokens_out,
                    )
                if provider == "ollama":
                    from agents.core.circuit_breaker import ollama_circuit

                    ollama_circuit.record_success()
                return result
            except Exception as exc:
                duration = time.monotonic() - t0
                if record_llm_request is not None:
                    record_llm_request(provider, agent_name, "error", duration)
                logger.warning(
                    "LLM provider '%s' falhou (chat): %s", provider, exc
                )
                if provider == "ollama":
                    from agents.core.circuit_breaker import ollama_circuit

                    ollama_circuit.record_failure()
                last_exc = exc

        logger.error(
            "Todos os LLM providers falharam (chat). Último erro: %s",
            last_exc,
            exc_info=True,
        )
        return _error_message(language)

    @classmethod
    def stream_chat(
        cls,
        messages: list[dict[str, str]],
        model: str | None = None,
        language: str = "pt-BR",
        agent_name: str = "unknown",
    ) -> Generator[str, None, None]:
        record_llm_request: Optional[Callable[..., None]] = None
        record_llm_fallback: Optional[Callable[..., None]] = None
        record_llm_stream_session: Optional[Callable[..., None]] = None
        try:
            from app.metrics import (
                record_llm_fallback,
                record_llm_request,
                record_llm_stream_session,
            )
        except ImportError:
            pass

        providers = cls._get_providers()
        last_exc: Exception | None = None

        for i, provider in enumerate(providers):
            if provider == "ollama" and cls._should_skip_ollama():
                logger.info(
                    "Ollama circuit breaker aberto — próximo provider (stream)"
                )
                continue

            if i > 0 and record_llm_fallback is not None:
                record_llm_fallback(providers[i - 1], provider)

            t0 = time.monotonic()
            try:
                gen = cls._dispatch_stream(provider, messages, model)
                first = next(gen, None)
            except Exception as exc:
                if record_llm_request is not None:
                    record_llm_request(
                        provider, agent_name, "error", time.monotonic() - t0
                    )
                logger.warning(
                    "LLM provider '%s' falhou ao iniciar stream: %s",
                    provider,
                    exc,
                )
                if provider == "ollama":
                    from agents.core.circuit_breaker import ollama_circuit

                    ollama_circuit.record_failure()
                last_exc = exc
                continue

            if first is None:
                return

            if record_llm_stream_session is not None:
                record_llm_stream_session(agent_name)

            tokens_in = _count_tokens_in(messages)
            if record_llm_request is not None:
                record_llm_request(
                    provider,
                    agent_name,
                    "success",
                    time.monotonic() - t0,
                    tokens_in,
                    0,
                )
            if provider == "ollama":
                from agents.core.circuit_breaker import ollama_circuit

                ollama_circuit.record_success()

            yield first
            yield from gen
            return

        logger.error(
            "Todos os LLM providers falharam (stream). Último erro: %s",
            last_exc,
            exc_info=True,
        )
        yield _error_message(language)

    @classmethod
    def complete(cls, prompt: str, system: str = "") -> str:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return cls.chat(messages)

    @classmethod
    def embed(cls, text: str) -> list[float]:
        """
        Gera embedding via Ollama (nomic-embed-text).

        Usa cache Redis com TTL de 5 minutos para evitar re-embedding da mesma
        query dentro de uma janela de tempo (routing + RAG na mesma request).
        """
        cache_key = (
            "embed:"
            + hashlib.md5(text.encode(), usedforsecurity=False).hexdigest()
        )
        try:
            from django.core.cache import cache as django_cache

            cached = django_cache.get(cache_key)
            if cached is not None:
                try:
                    from app.metrics import record_embedding_cache_hit

                    record_embedding_cache_hit()
                except Exception:
                    pass
                return cached
        except Exception:
            pass

        try:
            result = cls._ollama_embed(text)
            try:
                from django.core.cache import cache as django_cache

                django_cache.set(cache_key, result, timeout=300)
            except Exception:
                pass
            return result
        except Exception as exc:
            logger.error("LLM embedding falhou: %s", exc)
            return []

    # ── Ollama
    # ────────────────────────────────────────────────────────────────

    @classmethod
    def _ollama_chat(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        ollama_url = _cfg("OLLAMA_BASE_URL", "http://ollama:11434")
        ollama_model = _cfg("OLLAMA_MODEL", "mistral:7b-instruct")
        timeout_chat = int(_cfg("LLM_TIMEOUT_CHAT", "120"))
        effective_model = model or ollama_model
        try:
            resp = requests.post(
                f"{ollama_url}/api/chat",
                json={
                    "model": effective_model,
                    "messages": messages,
                    "stream": False,
                },
                timeout=timeout_chat,
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return str(data["message"]["content"])
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                if effective_model != ollama_model:
                    logger.warning(
                        "Ollama: modelo '%s' não encontrado,"
                        " usando fallback '%s'",
                        effective_model,
                        ollama_model,
                    )
                    return cls._ollama_chat(messages, model=ollama_model)
            raise

    @classmethod
    def _ollama_stream(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> Generator[str, None, None]:
        ollama_url = _cfg("OLLAMA_BASE_URL", "http://ollama:11434")
        ollama_model = _cfg("OLLAMA_MODEL", "mistral:7b-instruct")
        timeout_chat = int(_cfg("LLM_TIMEOUT_CHAT", "120"))
        effective_model = model or ollama_model
        try:
            resp = requests.post(
                f"{ollama_url}/api/chat",
                json={
                    "model": effective_model,
                    "messages": messages,
                    "stream": True,
                },
                timeout=timeout_chat,
                stream=True,
            )
            resp.raise_for_status()
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                if effective_model != ollama_model:
                    logger.warning(
                        "Ollama: modelo '%s' não encontrado,"
                        " usando fallback '%s'",
                        effective_model,
                        ollama_model,
                    )
                    yield from cls._ollama_stream(messages, model=ollama_model)
                    return
            raise
        for line in resp.iter_lines():
            if line:
                chunk: dict[str, Any] = json.loads(line)
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token

    # ── Groq (OpenAI-compatible)
    # ───────────────────────────────────────────────

    @classmethod
    def _groq_chat(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        groq_api_key = _cfg("GROQ_API_KEY", "")
        groq_model = _cfg("GROQ_MODEL", "llama-3.1-8b-instant")
        timeout_chat = int(_cfg("LLM_TIMEOUT_CHAT", "120"))
        effective_model = model or groq_model
        resp = requests.post(
            f"{_GROQ_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": effective_model,
                "messages": messages,
                "stream": False,
            },
            timeout=timeout_chat,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return str(data["choices"][0]["message"]["content"])

    @classmethod
    def _groq_stream(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> Generator[str, None, None]:
        groq_api_key = _cfg("GROQ_API_KEY", "")
        groq_model = _cfg("GROQ_MODEL", "llama-3.1-8b-instant")
        timeout_chat = int(_cfg("LLM_TIMEOUT_CHAT", "120"))
        effective_model = model or groq_model
        resp = requests.post(
            f"{_GROQ_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": effective_model,
                "messages": messages,
                "stream": True,
            },
            timeout=timeout_chat,
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

    # ── Anthropic
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def _anthropic_chat(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        client = _get_anthropic_client()
        max_tokens = int(_cfg("LLM_MAX_TOKENS", "2048"))
        system_text = "Você é um assistente financeiro pessoal."
        chat_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                chat_messages.append(
                    {"role": msg["role"], "content": msg["content"]}
                )

        effective_model: str = (
            model
            or _cfg("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            or "claude-haiku-4-5-20251001"
        )
        result = client.messages.create(
            model=effective_model,
            max_tokens=max_tokens,
            system=system_text,
            messages=chat_messages,
        )
        return str(result.content[0].text)  # type: ignore[union-attr]

    @classmethod
    def _anthropic_stream(
        cls, messages: list[dict[str, str]], model: str | None = None
    ) -> Generator[str, None, None]:
        client = _get_anthropic_client()
        max_tokens = int(_cfg("LLM_MAX_TOKENS", "2048"))
        system_text = "Você é um assistente financeiro pessoal."
        chat_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                chat_messages.append(
                    {"role": msg["role"], "content": msg["content"]}
                )

        effective_model: str = (
            model
            or _cfg("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            or "claude-haiku-4-5-20251001"
        )
        with client.messages.stream(
            model=effective_model,
            max_tokens=max_tokens,
            system=system_text,
            messages=chat_messages,
        ) as stream:
            for event in stream:
                if hasattr(event, "delta") and hasattr(event.delta, "text"):
                    yield event.delta.text

    # ── Embeddings
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def _ollama_embed(cls, text: str) -> list[float]:
        ollama_url = _cfg("OLLAMA_BASE_URL", "http://ollama:11434")
        ollama_embed_model = _cfg("OLLAMA_EMBED_MODEL", "nomic-embed-text")
        timeout_embed = int(_cfg("LLM_TIMEOUT_EMBED", "30"))
        resp = requests.post(
            f"{ollama_url}/api/embeddings",
            json={"model": ollama_embed_model, "prompt": text},
            timeout=timeout_embed,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return list(data["embedding"])

    # ── Status
    # ─────────────────────────────────────────────────────────────────

    @classmethod
    def is_available(cls) -> bool:
        try:
            provider = _cfg("LLM_PROVIDER", "ollama")
            if provider == "anthropic":
                return bool(
                    _cfg("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
                )
            if provider == "groq":
                return bool(_cfg("GROQ_API_KEY"))
            ollama_url = _cfg("OLLAMA_BASE_URL", "http://ollama:11434")
            resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    @classmethod
    def list_models(cls) -> list[str]:
        provider = _cfg("LLM_PROVIDER", "ollama")
        if provider == "groq":
            return [_cfg("GROQ_MODEL", "llama-3.1-8b-instant")]
        ollama_url = _cfg("OLLAMA_BASE_URL", "http://ollama:11434")
        try:
            resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
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
