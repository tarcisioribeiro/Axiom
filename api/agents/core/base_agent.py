"""
Classe base e tipos de dados para todos os agentes.

Mudanças principais:
- run() e stream() injetam ctx.history como turns estruturados (user/assistant)
  em vez de serializar o histórico como texto dentro do prompt. Isso preserva
  o formato nativo de multi-turn dos LLMs e é compatível com todos os
  providers.
- build_context_safely() executa build_context() com timeout configurável para
  evitar que queries lentas no banco bloqueiem o worker WSGI indefinidamente.
- safe_str() sanitiza strings de dados externos (merchant names, categorias)
  antes de serem injetadas no prompt, prevenindo indirect prompt injection.
- Compressão de contexto aplicada automaticamente quando o prompt excede
  o limite estimado de tokens (via context_compressor).
"""

import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout
from dataclasses import dataclass, field
from typing import Any

from app.config import cfg

logger = logging.getLogger(__name__)

_BUILD_CONTEXT_TIMEOUT = float(cfg("AGENT_CONTEXT_TIMEOUT", "10"))


def safe_str(value: Any, max_len: int = 120) -> str:
    """
    Sanitiza string de dados externos antes de injetar no prompt LLM.

    Remove caracteres de controle (newlines, tabs, etc.) que poderiam ser
    usados para indirect prompt injection via dados do banco (merchant names,
    categorias inseridas pelo usuário, títulos de livros, etc.).
    """
    if value is None:
        return ""
    cleaned = re.sub(r"[\x00-\x1f\x7f]", " ", str(value)).strip()
    return cleaned[:max_len]


@dataclass
class AgentContext:
    user_id: int
    query: str
    history: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    language: str = "pt-BR"


@dataclass
class AgentResponse:
    content: str
    agent_name: str
    sources: list[str] = field(default_factory=list)


class BaseAgent(ABC):
    name: str
    description: str
    ollama_model: str = "mistral:7b-instruct"
    anthropic_model: str = "claude-haiku-4-5-20251001"
    groq_model: str = "llama-3.1-8b-instant"

    def get_model(self) -> str:
        provider = cfg("LLM_PROVIDER", "ollama")
        if provider == "anthropic":
            return self.anthropic_model
        if provider == "groq":
            return self.groq_model
        return self.ollama_model

    @abstractmethod
    def can_handle(self, query: str) -> float:
        """Score 0.0–1.0 indicando se este agente deve tratar a query."""

    @abstractmethod
    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        """Busca dados relevantes do banco para a query."""

    @abstractmethod
    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        """
        Monta o prompt com o contexto atual.

        IMPORTANTE: NÃO incluir histórico conversacional aqui — o BaseAgent
        injeta ctx.history como turns estruturados em _build_messages().
        """

    def build_context_safely(self, ctx: AgentContext) -> dict[str, Any]:
        """
        Executa build_context() com timeout para evitar queries bloqueantes.

        Se o timeout for atingido ou ocorrer exceção, retorna contexto mínimo
        (apenas system_prompt e sources vazias) para garantir que o LLM ainda
        receba uma resposta coerente.
        """
        import time

        from agents.core.prompts import get_system_prompt

        t0 = time.monotonic()
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(self.build_context, ctx)
            try:
                result = future.result(timeout=_BUILD_CONTEXT_TIMEOUT)
                try:
                    from app.metrics import record_agent_context_build

                    record_agent_context_build(
                        self.name, time.monotonic() - t0
                    )
                except Exception:
                    pass
                return result
            except FuturesTimeout:
                logger.warning(
                    "build_context timeout (%.1fs) para agente '%s'",
                    _BUILD_CONTEXT_TIMEOUT,
                    self.name,
                )
                try:
                    from app.metrics import record_agent_context_timeout

                    record_agent_context_timeout(self.name)
                except Exception:
                    pass
            except Exception as exc:
                logger.error(
                    "build_context falhou para agente '%s': %s", self.name, exc
                )
        return {
            "system_prompt": get_system_prompt(ctx.language),
            "sources": [],
        }

    def _build_messages(
        self,
        ctx: AgentContext,
        current_prompt: str,
        system: str,
    ) -> list[dict[str, str]]:
        """
        Monta a lista de mensagens para o LLM com histórico como turns reais.

        Estrutura:
            [system] → [history_user] → [history_assistant] → ...
            → [user: prompt]

        Normaliza roles legados ("agent") para "assistant" para compatibilidade
        com providers OpenAI-compatible (Groq) que rejeitam
        roles desconhecidas.
        """
        from agents.core.summarizer import maybe_compress_history

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})

        # Comprime histórico longo antes de injetar
        compressed = maybe_compress_history(ctx.history)
        for turn in compressed:
            raw_role = turn.get("role", "user")
            role = (
                "assistant" if raw_role in ("agent", "assistant") else "user"
            )
            messages.append({"role": role, "content": turn["content"]})

        messages.append({"role": "user", "content": current_prompt})
        return messages

    def run(self, ctx: AgentContext) -> AgentResponse:
        from agents.core import context_compressor
        from agents.core.llm_client import LLMClient

        data = self.build_context_safely(ctx)

        # Comprimir contexto se prompt estimado for grande
        compressed_data = context_compressor.compress(data, query=ctx.query)

        prompt = self.build_prompt(ctx, compressed_data)
        system = compressed_data.get("system_prompt", "")
        messages = self._build_messages(ctx, prompt, system)

        raw = LLMClient.chat(
            messages,
            model=self.get_model(),
            language=ctx.language,
            agent_name=self.name,
        )
        return AgentResponse(
            content=raw,
            agent_name=self.name,
            sources=compressed_data.get("sources", []),
        )

    def stream(self, ctx: AgentContext) -> Generator[str, None, None]:
        from agents.core import context_compressor
        from agents.core.llm_client import LLMClient

        data = self.build_context_safely(ctx)
        compressed_data = context_compressor.compress(data, query=ctx.query)

        prompt = self.build_prompt(ctx, compressed_data)
        self._stream_sources: list[str] = compressed_data.get("sources", [])
        system = compressed_data.get("system_prompt", "")
        messages = self._build_messages(ctx, prompt, system)

        yield from LLMClient.stream_chat(
            messages,
            model=self.get_model(),
            language=ctx.language,
            agent_name=self.name,
        )
