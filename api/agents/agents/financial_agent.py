"""
Agente Financeiro — consolida finance, budget e forecast em um único agente
especializado em todo o módulo de Controle Financeiro.
"""

import unicodedata
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent

_KW_EXPENSE = [
    "gasto",
    "gastos",
    "gastei",
    "gastar",
    "despesa",
    "despesas",
    "compra",
    "compras",
    "comprei",
    "paguei",
    "pagamento",
    "pagar",
    "débito",
    "debito",
    "saída",
    "saidas",
    "débitos",
    "categoria",
    "onde gastei",
    "quanto gastei",
]

_KW_REVENUE = [
    "receita",
    "receitas",
    "renda",
    "salário",
    "salario",
    "recebimento",
    "recebi",
    "receber",
    "entrou",
    "entrada",
    "entradas",
    "quanto recebi",
    "rendimento",
    "ganho",
    "ganhos",
]

_KW_BUDGET = [
    "orçamento",
    "orcamento",
    "orçamentos",
    "limite",
    "limites",
    "estouro",
    "estourei",
    "teto",
    "budget",
    "quanto posso",
    "sobrou no orçamento",
    "status do orçamento",
    "dentro do limite",
    "ultrapassei",
    "excedi",
    "sobrar",
    "sobrou",
]

_KW_FORECAST = [
    "previsão",
    "previsao",
    "projeção",
    "projecao",
    "saldo futuro",
    "próximo mês",
    "proximo mes",
    "vai sobrar",
    "vai faltar",
    "vai negativar",
    "fim do mês",
    "fim de mes",
    "fluxo de caixa",
    "cash flow",
    "quanto vou ter",
    "tendência",
    "tendencia",
]

_KW_ACCOUNT = [
    "saldo",
    "conta",
    "contas",
    "banco",
    "bancos",
    "extrato",
    "disponível",
    "disponivel",
    "balanço",
    "balanco",
    "saldo atual",
    "saldo negativo",
    "saldo disponível",
]

_KW_CARD = [
    "cartão",
    "cartao",
    "cartões",
    "cartoes",
    "fatura",
    "faturas",
    "parcelamento",
    "parcela",
    "parcelas",
    "crédito",
    "credito",
    "limite do cartão",
    "gasto no cartão",
    "fatura aberta",
]

_KW_LOAN = [
    "empréstimo",
    "emprestimo",
    "empréstimos",
    "dívida",
    "divida",
    "dívidas",
    "parcelar",
    "financiamento",
    "devo",
    "devia",
    "quitar",
    "saldo devedor",
    "credor",
    "beneficiado",
]

_KW_TRANSFER = [
    "transferência",
    "transferencia",
    "transferi",
    "pix",
    "ted",
    "doc",
    "enviei",
    "mandei",
    "transferir",
]

_KW_FIXED = [
    "gasto fixo",
    "despesa fixa",
    "receita fixa",
    "fixos mensais",
    "contas mensais",
    "compromissos mensais",
    "vencimento",
    "quando vence",
]

_ALL_KW = (
    _KW_EXPENSE
    + _KW_REVENUE
    + _KW_BUDGET
    + _KW_FORECAST
    + _KW_ACCOUNT
    + _KW_CARD
    + _KW_LOAN
    + _KW_TRANSFER
    + _KW_FIXED
)


def _normalize(text: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )


class FinancialAgent(BaseAgent):
    name = "financial"
    description = (
        "Controle financeiro completo: despesas, receitas, orçamentos, "
        "previsão de saldo, cartões, empréstimos e transferências"
    )
    ollama_model = "qwen2.5:14b"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.3-70b-versatile"

    def can_handle(self, query: str) -> float:
        q = _normalize(query)
        hits = sum(1 for w in _ALL_KW if _normalize(w) in q)
        return min(hits * 0.20, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.budget_tools import (
            get_budget_status,
            get_days_remaining_in_month,
        )
        from agents.tools.financial_tools import (
            get_current_month_totals,
            get_expense_summary,
            get_monthly_trend,
            get_revenue_summary,
            get_top_merchants,
            get_total_balances,
        )
        from agents.tools.forecast_tools import (
            compute_balance_projection,
            get_account_balances,
            get_expected_revenues,
            get_fixed_expenses_upcoming,
        )

        user = User.objects.get(pk=ctx.user_id)
        now = timezone.now().date()
        month_start = now.replace(day=1)

        temporal = (
            parse_temporal_intent(ctx.query, now)
            if not ctx.metadata.get("date_from")
            else None
        )

        t_start = temporal[0] if temporal else month_start
        t_end = temporal[1] if temporal else now

        expense_summary = get_expense_summary(user, t_start, t_end)
        revenue_summary = get_revenue_summary(user, t_start, t_end)
        merchants = get_top_merchants(user, t_start, t_end)
        month_totals = get_current_month_totals(user, t_start, t_end)
        trend = get_monthly_trend(user, months=3)
        balances = get_total_balances(user)
        budget_status = get_budget_status(user)
        days_remaining = get_days_remaining_in_month()

        # Previsão de saldo
        account_balances = get_account_balances(user)
        total_balance = sum(a["balance"] for a in account_balances)
        fixed_upcoming = get_fixed_expenses_upcoming(user, days=30)
        expected_revenues = get_expected_revenues(user, days=30)
        projection = compute_balance_projection(
            total_balance,
            fixed_upcoming,
            expected_revenues,
            days=ctx.metadata.get("forecast_days", 30),
        )

        overbudget_items = [b for b in budget_status if b["overbudget"]]

        period_label = (
            f"{t_start.strftime('%d/%m')}–{t_end.strftime('%d/%m/%Y')}"
            if temporal
            else f"{month_start.strftime('%d/%m')}–{now.strftime('%d/%m/%Y')}"
        )

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "period_label": period_label,
            "month_totals": month_totals,
            "expense_summary": expense_summary,
            "revenue_summary": revenue_summary,
            "merchants": merchants,
            "trend": trend,
            "balances": balances,
            "budget_status": budget_status,
            "overbudget_count": len(overbudget_items),
            "days_remaining": days_remaining,
            "projection": projection,
            "fixed_upcoming": fixed_upcoming[:5],
            "sources": [f"Controle Financeiro — {period_label}"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        mt = data["month_totals"]
        totals_block = (
            f"  Despesas: R$ {mt['expenses']:,.2f} | "
            f"Receitas: R$ {mt['revenues']:,.2f} | "
            f"Saldo do período: R$ {mt['balance']:,.2f}"
        )

        exp_block = (
            "\n".join(
                "  - {}: R$ {:,.2f} ({} lançamentos)".format(
                    safe_str(str(e["category"])), float(e["total"]), e["count"]
                )
                for e in data["expense_summary"][:6]
            )
            or "  Sem despesas no período."
        )

        rev_block = (
            "\n".join(
                "  - {}: R$ {:,.2f}".format(
                    safe_str(str(r["category"])), float(r["total"])
                )
                for r in data["revenue_summary"][:5]
            )
            or "  Sem receitas no período."
        )

        merchant_block = (
            "\n".join(
                "  - {}: R$ {:,.2f}".format(
                    safe_str(str(m["merchant"])), float(m["total"])
                )
                for m in data["merchants"][:5]
            )
            or "  Sem dados de estabelecimento."
        )

        balance_block = (
            "\n".join(
                "  - {} ({}): R$ {:,.2f}".format(
                    safe_str(str(b["account_name"])),
                    safe_str(str(b["institution_name"])),
                    float(b["current_balance"]),
                )
                for b in data["balances"][:5]
            )
            or "  Sem contas cadastradas."
        )

        budget_block = (
            "\n".join(
                "  - {} {}: {:.1f}% (R$ {:.2f} de R$ {:.2f}){}".format(
                    "⚠️" if b["overbudget"] else "✓",
                    safe_str(str(b["category"])),
                    b["percentage"],
                    b["spent"],
                    b["limit"],
                    " [ESTOURADO]" if b["overbudget"] else "",
                )
                for b in data["budget_status"][:8]
            )
            or "  Sem orçamentos configurados."
        )

        proj = data["projection"]
        proj_block = (
            f"  Saldo atual: R$ {proj['current_total']:,.2f}\n"
            f"  Entradas previstas: R$ {proj['projected_inflows']:,.2f}\n"
            f"  Saídas previstas: R$ {proj['projected_outflows']:,.2f}\n"
            f"  Saldo projetado: R$ {proj['projected_balance']:,.2f}"
            + (" ⚠️ ATENÇÃO: projeção negativa!" if proj["alert"] else "")
        )

        upcoming_block = (
            "\n".join(
                "  - {} — R$ {:.2f} (vence em {} dias, {})".format(
                    safe_str(str(f["description"])),
                    f["value"],
                    f["days_until"],
                    f["due_date"],
                )
                for f in data["fixed_upcoming"]
            )
            or "  Sem despesas fixas próximas."
        )

        return (
            f"Dados financeiros — {data['period_label']}:\n\n"
            f"Totais do período:\n{totals_block}\n\n"
            f"Despesas por categoria:\n{exp_block}\n\n"
            f"Receitas por categoria:\n{rev_block}\n\n"
            f"Maiores estabelecimentos:\n{merchant_block}\n\n"
            f"Saldos em conta:\n{balance_block}\n\n"
            f"Status dos orçamentos:\n{budget_block}\n"
            f"  Orçamentos estourados: {data['overbudget_count']} | "
            f"Dias restantes no mês: {data['days_remaining']}\n\n"
            f"Projeção de saldo (próximos {proj['days']}"
            f" dias):\n{proj_block}\n\n"
            f"Despesas fixas próximas:\n{upcoming_block}\n\n"
            f"Pergunta: {ctx.query}\n\n"
            "Use markdown para tabelas e listas quando ajudar a visualização. "
            "Seja preciso com valores monetários em BRL. "
            "Alerte sobre riscos financeiros claramente."
        )
