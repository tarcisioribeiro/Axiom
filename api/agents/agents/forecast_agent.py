from typing import Any

from django.contrib.auth.models import User

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt

_TRIGGER_WORDS = [
    "previsão",
    "projeção",
    "saldo",
    "vai sobrar",
    "vai faltar",
    "próximo mês",
    "próximos dias",
    "daqui",
    "cheque especial",
    "negativo",
    "ficar no vermelho",
    "sobra",
    "falta",
    "fluxo de caixa",
    "quanto vou ter",
    "entradas",
    "saídas",
    "contas a pagar",
]


class ForecastAgent(BaseAgent):
    name = "forecast"
    description = "Previsão de saldo e fluxo de caixa futuro"
    ollama_model = "qwen2.5:14b"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.3-70b-versatile"

    def can_handle(self, query: str) -> float:
        q = query.lower()
        hits = sum(1 for w in _TRIGGER_WORDS if w in q)
        return min(hits * 0.28, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.forecast_tools import (
            compute_balance_projection,
            get_account_balances,
            get_expected_revenues,
            get_fixed_expenses_upcoming,
        )

        user = User.objects.get(pk=ctx.user_id)
        days = int(ctx.metadata.get("forecast_days", 30))

        accounts = get_account_balances(user)
        fixed_upcoming = get_fixed_expenses_upcoming(user, days=days)
        expected_revenues = get_expected_revenues(user, days=days)

        total_balance = sum(a["balance"] for a in accounts)
        projection = compute_balance_projection(
            total_balance, fixed_upcoming, expected_revenues, days=days
        )

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "accounts": accounts,
            "fixed_upcoming": fixed_upcoming,
            "expected_revenues": expected_revenues,
            "projection": projection,
            "days": days,
            "sources": [
                "Contas bancárias",
                "Despesas fixas",
                "Histórico de receitas",
            ],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        account_lines = (
            "\n".join(
                f"  - {safe_str(a['name'])} ({safe_str(a['institution'])}):"
                f" R$ {a['balance']:.2f}"
                for a in data["accounts"]
            )
            or "  (sem contas cadastradas)"
        )

        fixed_lines = (
            "\n".join(
                f"  - {safe_str(fe['description'])}: R$ {fe['value']:.2f}"
                f" em {fe['due_date']} ({fe['days_until']}d)"
                for fe in data["fixed_upcoming"][:8]
            )
            or "  (sem despesas fixas previstas)"
        )

        revenue_lines = (
            "\n".join(
                f"  - {safe_str(r['description'])}: "
                f"~R$ {r['avg_value']:.2f}/mês"
                for r in data["expected_revenues"][:5]
            )
            or "  (sem receitas recorrentes identificadas)"
        )

        proj = data["projection"]
        alert = (
            "⚠️ ALERTA: saldo projetado NEGATIVO!"
            if proj["alert"]
            else "✅ Saldo positivo projetado"
        )

        return f"""Previsão para os próximos {data['days']} dias

**Saldo atual total:** R$ {proj['current_total']:.2f}

Contas:
{account_lines}

Despesas fixas previstas:
{fixed_lines}

Receitas recorrentes esperadas:
{revenue_lines}

**Projeção:**
- Entradas estimadas: R$ {proj['projected_inflows']:.2f}
- Saídas confirmadas: R$ {proj['projected_outflows']:.2f}
- **Saldo projetado: R$ {proj['projected_balance']:.2f}**
- {alert}

Pergunta: {ctx.query}

Seja preciso com datas e valores. Alerte sobre riscos de saldo negativo."""
