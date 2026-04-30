import logging

from agents.core.base_agent import AgentContext, AgentResponse, BaseAgent

logger = logging.getLogger(__name__)


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


class AgentRouter:
    @staticmethod
    def route(ctx: AgentContext) -> AgentResponse:
        registry = _build_registry()
        scores = [(agent, agent.can_handle(ctx.query)) for agent in registry]
        best_agent, best_score = max(scores, key=lambda x: x[1])

        if best_score < 0.2:
            from agents.agents.insight_agent import InsightAgent

            best_agent = InsightAgent()

        logger.info(
            "AgentRouter: selected=%s score=%.2f query=%r",
            best_agent.name,
            best_score,
            ctx.query[:80],
        )
        return best_agent.run(ctx)
