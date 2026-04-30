import logging
import math

from agents.core.base_agent import AgentContext, AgentResponse, BaseAgent
from agents.core.llm_client import LLMClient

logger = logging.getLogger(__name__)

# Maps agent.name → embedding domain (agents without a domain get no semantic bonus)
_AGENT_TO_DOMAIN: dict[str, str] = {
    "finance": "finance",
    "budget": "budget",
    "planning": "planning",
    "library": "library",
    "insight": "general",
}

_DOMAINS = ["finance", "budget", "planning", "library", "general"]


def _build_registry() -> list[BaseAgent]:
    from agents.agents.budget_agent import BudgetAgent
    from agents.agents.finance_agent import FinanceAgent
    from agents.agents.forecast_agent import ForecastAgent
    from agents.agents.insight_agent import InsightAgent
    from agents.agents.library_agent import LibraryAgent
    from agents.agents.planning_agent import PlanningAgent

    return [
        FinanceAgent(),
        BudgetAgent(),
        ForecastAgent(),
        LibraryAgent(),
        PlanningAgent(),
        InsightAgent(),
    ]


def _is_postgres() -> bool:
    from django.db import connection

    return "postgresql" in connection.settings_dict.get("ENGINE", "")


def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _pg_domain_avg(embedding: list[float], user_pk: int, domain: str) -> float:
    from django.db import connection

    emb_str = "[" + ",".join(f"{x:.6f}" for x in embedding) + "]"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT AVG(similarity) FROM (
                SELECT 1 - (embedding <=> %s::vector) AS similarity
                FROM "vectors"."agent_embeddings"
                WHERE user_id = %s AND domain = %s AND is_deleted = FALSE
                ORDER BY embedding <=> %s::vector
                LIMIT 3
            ) sub
            """,
            [emb_str, user_pk, domain, emb_str],
        )
        row = cursor.fetchone()
    return float(row[0]) if row and row[0] is not None else 0.0


def _py_domain_avg(embedding: list[float], user_pk: int, domain: str) -> float:
    import json

    from agents.models import AgentEmbedding

    docs = AgentEmbedding.objects.filter(
        user_id=user_pk, domain=domain, is_deleted=False
    ).values("embedding")

    sims = []
    for doc in docs:
        emb = doc["embedding"]
        if isinstance(emb, str):
            try:
                emb = json.loads(emb)
            except (json.JSONDecodeError, TypeError):
                continue
        if not emb:
            continue
        sims.append(_cosine_sim(embedding, list(emb)))

    top3 = sorted(sims, reverse=True)[:3]
    return sum(top3) / len(top3) if top3 else 0.0


def semantic_domain_scores(
    query_embedding: list[float], user_pk: int
) -> dict[str, float]:
    """
    Returns avg cosine similarity of the top-3 closest embeddings per domain.
    Uses pgvector on PostgreSQL and Python cosine on SQLite (tests).
    """
    fn = _pg_domain_avg if _is_postgres() else _py_domain_avg
    return {domain: fn(query_embedding, user_pk, domain) for domain in _DOMAINS}


class AgentRouter:
    @staticmethod
    def select(ctx: AgentContext) -> BaseAgent:
        registry = _build_registry()
        score_map: dict[BaseAgent, float] = {
            agent: agent.can_handle(ctx.query) for agent in registry
        }

        query_embedding = LLMClient.embed(ctx.query)
        if query_embedding:
            try:
                domain_sims = semantic_domain_scores(query_embedding, ctx.user_id)
                for agent in registry:
                    domain = _AGENT_TO_DOMAIN.get(agent.name)
                    if domain:
                        score_map[agent] += 0.15 * domain_sims.get(domain, 0.0)
            except Exception:
                logger.warning(
                    "AgentRouter: semantic scoring failed, using keyword scores only",
                    exc_info=True,
                )

        best_agent = max(score_map, key=lambda a: score_map[a])
        best_score = score_map[best_agent]

        if best_score < 0.2:
            from agents.agents.insight_agent import InsightAgent

            best_agent = InsightAgent()

        logger.info(
            "AgentRouter: selected=%s score=%.2f query=%r",
            best_agent.name,
            best_score,
            ctx.query[:80],
        )
        return best_agent

    @staticmethod
    def route(ctx: AgentContext) -> AgentResponse:
        return AgentRouter.select(ctx).run(ctx)
