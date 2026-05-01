from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent
from agents.core.prompts import BASE_SYSTEM_PROMPT

_TRIGGER_WORDS = [
    "resumo",
    "geral",
    "briefing",
    "visão geral",
    "como estou",
    "situação",
    "panorama",
    "overview",
    "diagnóstico",
    "tudo",
    "completo",
    "balanço geral",
]


class InsightAgent(BaseAgent):
    """Orquestrador — sintetiza dados de todos os domínios."""

    name = "insight"
    description = "Briefing geral: síntese financeira, orçamentos e rotinas"
    ollama_model = "llama3.1:8b"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.3-70b-versatile"

    def can_handle(self, query: str) -> float:
        q = query.lower()
        hits = sum(1 for w in _TRIGGER_WORDS if w in q)
        return min(hits * 0.32, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.budget_tools import (
            get_budget_status,
            get_days_remaining_in_month,
        )
        from agents.tools.financial_tools import (
            get_current_month_totals,
            get_total_balances,
        )
        from agents.tools.forecast_tools import get_fixed_expenses_upcoming
        from agents.tools.planning_tools import get_routine_summary

        user = User.objects.get(pk=ctx.user_id)
        now = timezone.now()

        # Financeiro
        month_totals = get_current_month_totals(user)
        balances = get_total_balances(user)
        total_balance = sum(float(b["current_balance"]) for b in balances)

        # Orçamento
        budgets = get_budget_status(user)
        overbudget = [b for b in budgets if b["overbudget"]]
        critical = [b for b in budgets if b["percentage"] >= 80 and not b["overbudget"]]
        days_remaining = get_days_remaining_in_month()

        # Previsão próximos 15 dias
        upcoming_bills = get_fixed_expenses_upcoming(user, days=15)

        # Planejamento
        planning = get_routine_summary(user, days=7)

        return {
            "system_prompt": BASE_SYSTEM_PROMPT,
            "month_totals": month_totals,
            "total_balance": total_balance,
            "budgets": budgets,
            "overbudget": overbudget,
            "critical_budgets": critical,
            "upcoming_bills": upcoming_bills,
            "planning": planning,
            "days_remaining": days_remaining,
            "month": now.strftime("%B/%Y"),
            "sources": ["Dashboard financeiro", "Orçamentos", "Rotinas"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        mt = data["month_totals"]
        fin_block = (
            f"**Financeiro ({data['month']}):**\n"
            f"  - Receitas: R$ {mt['revenues']:.2f}\n"
            f"  - Despesas: R$ {mt['expenses']:.2f}\n"
            f"  - Resultado: R$ {mt['balance']:.2f} "
            f"({'✅ positivo' if mt['balance'] >= 0 else '🔴 negativo'})\n"
            f"  - Saldo total em contas: R$ {data['total_balance']:.2f}"
        )

        budget_block = ""
        if data["overbudget"]:
            items = ", ".join(
                f"{b['category']} (+R$ {b['spent'] - b['limit']:.0f})"
                for b in data["overbudget"]
            )
            budget_block += f"\n🔴 **Orçamentos estourados:** {items}"
        if data["critical_budgets"]:
            items = ", ".join(
                f"{b['category']} ({b['percentage']:.0f}%)"
                for b in data["critical_budgets"]
            )
            budget_block += f"\n🟡 **Orçamentos críticos (>80%):** {items}"
        if not budget_block:
            budget_block = "\n✅ Todos os orçamentos dentro do limite."

        bills_block = ""
        if data["upcoming_bills"]:
            total_bills = sum(b["value"] for b in data["upcoming_bills"])
            bills_block = (
                f"\n\n**Contas nos próximos 15 dias:** "
                f"R$ {total_bills:.2f} ({len(data['upcoming_bills'])} lançamentos)"
            )

        p = data["planning"]
        planning_block = (
            f"\n\n**Rotinas (últimos 7 dias):** "
            f"{p['completion_rate']}% de cumprimento "
            f"({p['completed']}/{p['total']} tarefas)"
        )

        history_block = ""
        if ctx.history:
            from agents.core.memory import ConversationMemory

            history_block = (
                f"\nHistórico:\n{ConversationMemory.format_for_prompt(ctx.history)}\n"
            )

        return f"""Dados do usuário — {data['month']}:

{fin_block}
{budget_block}{bills_block}{planning_block}

Dias restantes no mês: {data['days_remaining']}
{history_block}
Pergunta: {ctx.query}

Gere um briefing claro e acionável. Destaque os 2-3 pontos mais importantes.
Use linguagem natural, como um consultor financeiro de confiança."""
