import calendar
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent
from agents.core.prompts import BASE_SYSTEM_PROMPT

_TRIGGER_WORDS = [
    "orçamento",
    "orçamentos",
    "limite",
    "estouro",
    "estourou",
    "estourando",
    "meta de gasto",
    "budget",
    "controle",
    "planejado",
    "previsto",
    "quanto posso",
    "sobrou",
    "quanto tenho",
    "falta para",
]


class BudgetAgent(BaseAgent):
    name = "budget"
    description = "Monitoramento de orçamentos e detecção de desvios"

    def can_handle(self, query: str) -> float:
        q = query.lower()
        hits = sum(1 for w in _TRIGGER_WORDS if w in q)
        return min(hits * 0.30, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.budget_tools import (
            get_budget_status,
            get_days_remaining_in_month,
            get_projected_end_of_month,
        )

        user = User.objects.get(pk=ctx.user_id)
        budgets = get_budget_status(user)
        days_remaining = get_days_remaining_in_month()

        now = timezone.now().date()
        total_days = calendar.monthrange(now.year, now.month)[1]
        days_elapsed = now.day

        critical = [b for b in budgets if b["percentage"] >= 80]
        overbudget = [b for b in budgets if b["overbudget"]]

        projections = []
        for b in budgets[:5]:
            projected = get_projected_end_of_month(b["spent"], days_elapsed, total_days)
            projections.append(
                {
                    "category": b["category"],
                    "projected": projected,
                    "limit": b["limit"],
                    "will_exceed": projected > b["limit"],
                }
            )

        return {
            "system_prompt": BASE_SYSTEM_PROMPT,
            "budgets": budgets,
            "critical": critical,
            "overbudget": overbudget,
            "projections": projections,
            "days_remaining": days_remaining,
            "days_elapsed": days_elapsed,
            "total_days": total_days,
            "month": now.strftime("%B/%Y"),
            "sources": [f"Orçamentos {now.strftime('%B/%Y')}"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        if not data["budgets"]:
            budget_block = "  Nenhum orçamento configurado para este mês."
        else:
            lines = []
            for b in data["budgets"]:
                status = (
                    "🔴"
                    if b["overbudget"]
                    else ("🟡" if b["percentage"] >= 80 else "🟢")
                )
                lines.append(
                    f"  {status} {b['category']}: "
                    f"R$ {b['spent']:.2f} / R$ {b['limit']:.2f} "
                    f"({b['percentage']:.0f}%) — sobram R$ {b['remaining']:.2f}"
                )
            budget_block = "\n".join(lines)

        projection_block = ""
        for p in data["projections"]:
            if p["will_exceed"]:
                excesso = p["projected"] - p["limit"]
                projection_block += (
                    f"\n  ⚠️ {p['category']}: projeção R$ {p['projected']:.2f} "
                    f"(excede em R$ {excesso:.2f})"
                )

        history_block = ""
        if ctx.history:
            from agents.core.memory import ConversationMemory

            history_block = (
                f"\nHistórico:\n{ConversationMemory.format_for_prompt(ctx.history)}\n"
            )

        no_breach = "  Nenhuma categoria vai estourar no ritmo atual."
        return (
            f"Mês: {data['month']}\n"
            f"Dia: {data['days_elapsed']} de {data['total_days']}"
            f" ({data['days_remaining']} dias restantes)\n\n"
            f"Orçamentos:\n{budget_block}\n\n"
            f"Projeções de estouro (ritmo atual):\n"
            f"{projection_block or no_breach}\n"
            f"{history_block}\n"
            f"Pergunta: {ctx.query}\n\n"
            "Seja direto sobre desvios. "
            "Sugira realocações ou cortes específicos quando necessário."
        )
