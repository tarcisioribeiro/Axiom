import os
from abc import ABC, abstractmethod
from collections.abc import Generator
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentContext:
    user_id: int
    query: str
    history: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResponse:
    content: str
    agent_name: str
    sources: list[str] = field(default_factory=list)


class BaseAgent(ABC):
    name: str
    description: str
    # Modelos por provider — subclasses podem sobrescrever individualmente.
    # Ollama: usa o env var OLLAMA_MODEL como fallback automático se o modelo não
    # estiver instalado (tratado em LLMClient._ollama_chat/_ollama_stream).
    ollama_model: str = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    def get_model(self) -> str:
        """Retorna o modelo adequado para o provider configurado."""
        provider = os.getenv("LLM_PROVIDER", "ollama")
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
        """Monta o prompt final para o LLM."""

    def run(self, ctx: AgentContext) -> AgentResponse:
        from agents.core.llm_client import LLMClient

        data = self.build_context(ctx)
        prompt = self.build_prompt(ctx, data)
        system = data.get("system_prompt", "")
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        raw = LLMClient.chat(messages, model=self.get_model())
        return AgentResponse(
            content=raw,
            agent_name=self.name,
            sources=data.get("sources", []),
        )

    def stream(self, ctx: AgentContext) -> Generator[str, None, None]:
        from agents.core.llm_client import LLMClient

        data = self.build_context(ctx)
        prompt = self.build_prompt(ctx, data)
        self._stream_sources: list[str] = data.get("sources", [])
        system = data.get("system_prompt", "")
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        yield from LLMClient.stream_chat(messages, model=self.get_model())
