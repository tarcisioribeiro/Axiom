from abc import ABC, abstractmethod
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
        raw = LLMClient.complete(prompt, system=data.get("system_prompt", ""))
        return AgentResponse(
            content=raw,
            agent_name=self.name,
            sources=data.get("sources", []),
        )
