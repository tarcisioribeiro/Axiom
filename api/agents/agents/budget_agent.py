import calendar
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent

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
    ollama_model = "qwen2.5:7b"
    anthropic_model = "claude-haiku-4-5-20251001"
    groq_model = "llama-3.1-8b-instant"

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
        now = timezone.now().date()

        temporal = (
            parse_temporal_intent(ctx.query, now)
            if not ctx.metadata.get("date_from")
            else None
        )

        if temporal:
            exp_start, exp_end = temporal
            target_year = exp_start.year
            target_month = exp_start.month
            is_historical = exp_end < now
            budgets = get_budget_status(
                user,
                year=target_year,
                month=target_month,
                expense_start=exp_start,
                expense_end=exp_end,
            )
            period_label = (
                f"{exp_start.strftime('%d/%m')}–{exp_end.strftime('%d/%m/%Y')}"
            )
            month_label = (
                calendar.month_abbr[target_month] + "/" + str(target_year)
            )
        else:
            target_year = now.year
            target_month = now.month
            is_historical = False
            budgets = get_budget_status(user)
            month_label = now.strftime("%B/%Y")
            period_label = month_label

        total_days = calendar.monthrange(now.year, now.month)[1]
        days_elapsed = now.day

        critical = [b for b in budgets if b["percentage"] >= 80]
        overbudget = [b for b in budgets if b["overbudget"]]

        projections: list[dict[str, Any]] = []
        if not is_historical:
            days_remaining = get_days_remaining_in_month()
            for b in budgets[:5]:
                projected = get_projected_end_of_month(
                    b["spent"], days_elapsed, total_days
                )
                projections.append(
                    {
                        "category": b["category"],
                        "projected": projected,
                        "limit": b["limit"],
                        "will_exceed": projected > b["limit"],
                    }
                )
        else:
            days_remaining = 0

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "budgets": budgets,
            "critical": critical,
            "overbudget": overbudget,
            "projections": projections,
            "days_remaining": days_remaining,
            "days_elapsed": days_elapsed,
            "total_days": total_days,
            "month": month_label,
            "period_label": period_label,
            "is_historical": is_historical,
            "sources": [f"Orçamentos {month_label} — despesas {period_label}"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        if not data["budgets"]:
            budget_block = "  Nenhum orçamento configurado para este período."
        else:
            lines = []
            for b in data["budgets"]:
                status_icon = (
                    "🔴"
                    if b["overbudget"]
                    else ("🟡" if b["percentage"] >= 80 else "🟢")
                )
                lines.append(
                    f"  {status_icon} {safe_str(b['category'])}: "
                    f"R$ {b['spent']:.2f} / R$ {b['limit']:.2f} "
                    f"({b['percentage']:.0f}%) — sobram"
                    f" R$ {b['remaining']:.2f}"
                )
            budget_block = "\n".join(lines)

        if data["projections"]:
            proj_lines = []
            for p in data["projections"]:
                if p["will_exceed"]:
                    excesso = p["projected"] - p["limit"]
                    proj_lines.append(
                        f"  ⚠️ {safe_str(p['category'])}: projeção"
                        f" R$ {p['projected']:.2f}"
                        f" (excede em R$ {excesso:.2f})"
                    )
            projection_block = "\n".join(proj_lines) if proj_lines else ""
        else:
            projection_block = ""

        header = (
            f"Mês: {data['month']}\n"
            f"Período das despesas: {data['period_label']}\n"
            if data["is_historical"]
            else (
                f"Mês: {data['month']}\n"
                f"Dia: {data['days_elapsed']} de {data['total_days']}"
                f" ({data['days_remaining']} dias restantes)\n"
            )
        )

        _no_breach = "  Nenhuma categoria vai estourar no ritmo atual."
        proj_section = (
            ""
            if data["is_historical"]
            else (
                f"\nProjeções de estouro (ritmo atual):\n"
                f"{projection_block or _no_breach}\n"
            )
        )

        return (
            f"{header}\n"
            f"Orçamentos:\n{budget_block}\n"
            f"{proj_section}\n"
            f"Pergunta: {ctx.query}\n\n"
            "Seja direto sobre desvios. "
            "Sugira realocações ou cortes específicos quando necessário."
        )
