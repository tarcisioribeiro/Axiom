from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent

_TRIGGER_WORDS = [
    "gastei",
    "gasto",
    "despesa",
    "despesas",
    "receita",
    "receitas",
    "quanto",
    "categoria",
    "compra",
    "paguei",
    "cobrado",
    "estabelecimento",
    "merchant",
    "alimentação",
    "transporte",
    "saúde",
    "lazer",
    "assinatura",
    "comprei",
    "gastando",
    "valor",
    "gastar",
    "mês passado",
    "semana passada",
]


class FinanceAgent(BaseAgent):
    name = "finance"
    description = "Análise de despesas, receitas e padrões de consumo"
    ollama_model = "qwen2.5:7b"
    anthropic_model = "claude-haiku-4-5-20251001"
    groq_model = "llama-3.1-8b-instant"

    def can_handle(self, query: str) -> float:
        q = query.lower()
        hits = sum(1 for w in _TRIGGER_WORDS if w in q)
        return min(hits * 0.22, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.financial_tools import (
            get_expense_summary,
            get_monthly_trend,
            get_revenue_summary,
            get_top_merchants,
        )

        user = User.objects.get(pk=ctx.user_id)
        now = timezone.now().date()
        month_start = now.replace(day=1)

        if ctx.metadata.get("date_from"):
            try:
                start = date.fromisoformat(ctx.metadata["date_from"])
                end = date.fromisoformat(
                    ctx.metadata.get("date_to", now.isoformat())
                )
            except ValueError:
                start, end = month_start, now
        else:
            temporal = parse_temporal_intent(ctx.query, now)
            start, end = temporal if temporal else (month_start, now)

        expenses = get_expense_summary(user, start, end)
        revenues = get_revenue_summary(user, start, end)
        merchants = get_top_merchants(user, start, end, limit=5)
        trend = get_monthly_trend(user, months=3)

        total_expenses = sum(float(r["total"] or 0) for r in expenses)
        total_revenues = sum(float(r["total"] or 0) for r in revenues)

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "expenses": expenses,
            "revenues": revenues,
            "merchants": merchants,
            "trend": trend,
            "total_expenses": total_expenses,
            "total_revenues": total_revenues,
            "period_start": start.strftime("%d/%m/%Y"),
            "period_end": end.strftime("%d/%m/%Y"),
            "sources": [
                f"Despesas {start.strftime('%d/%m')}"
                f"–{end.strftime('%d/%m/%Y')}"
            ],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        # safe_str sanitiza merchant names e categorias contra indirect
        # injection
        expense_lines = (
            "\n".join(
                f"  - {safe_str(r['category'])}: "
                f"R$ {float(r['total'] or 0):.2f}"
                f" ({r['count']} lançamentos)"
                for r in data["expenses"][:8]
            )
            or "  (sem despesas no período)"
        )

        revenue_lines = (
            "\n".join(
                f"  - {safe_str(r['category'])}: "
                f"R$ {float(r['total'] or 0):.2f}"
                for r in data["revenues"][:5]
            )
            or "  (sem receitas no período)"
        )

        merchant_lines = (
            "\n".join(
                f"  - {safe_str(r['merchant'])}: "
                f"R$ {float(r['total'] or 0):.2f}"
                f" ({r['count']}x)"
                for r in data["merchants"]
            )
            or "  (sem dados de estabelecimento)"
        )

        trend_lines = (
            "\n".join(
                "  - {}: R$ {:.2f}".format(
                    safe_str(
                        r["month"].strftime("%b/%Y")
                        if hasattr(r["month"], "strftime")
                        else r["month"]
                    ),
                    float(r["total"] or 0),
                )
                for r in data["trend"]
            )
            or "  (sem histórico)"
        )

        _period = f"{data['period_start']} a {data['period_end']}"
        return f"""Período analisado: {_period}

**Total despesas:** R$ {data['total_expenses']:.2f}
**Total receitas:** R$ {data['total_revenues']:.2f}
**Saldo do período:** R$ {data['total_revenues'] - data['total_expenses']:.2f}

Gastos por categoria:
{expense_lines}

Receitas por categoria:
{revenue_lines}

Top estabelecimentos:
{merchant_lines}

Tendência mensal (últimos 3 meses):
{trend_lines}

Pergunta: {ctx.query}

Responda de forma direta e estruturada. Use **negrito** para valores
importantes."""
