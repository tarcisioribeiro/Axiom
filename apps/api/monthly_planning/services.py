"""Prévia e aplicação do plano mensal.

`build_apply_preview` é a fonte única do que o "Aplicar Plano" faz: o apply
usa a mesma lista de itens, então a prévia nunca diverge do resultado.

Regras (as mesmas da tela do planejador):
- Receita/despesa fixa desmarcada (`override.enabled == False`) não é lançada.
- Valor ajustado (`override.value`) substitui o valor padrão.
- Lançamento do mês já quitado (recebido/pago) não é alterado.
- Categoria de orçamento desmarcada (`budget_disabled_categories`) é ignorada.
"""

from calendar import month_abbr, monthrange
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth.models import User

from budgets.models import Budget
from credit_cards.models import CreditCardInstallment
from expenses.models import Expense, FixedExpense
from expenses.services import _blocked_cards
from monthly_planning.models import MonthlyPlan
from revenues.models import FixedRevenue, Revenue

# Ações de cada item na prévia.
CREATE = "create"  # será lançado
UPDATE = "update"  # já lançado; o valor será atualizado (reaplicação)
EXISTING = "existing"  # já lançado; nada muda (primeira aplicação)
SETTLED = "settled"  # já recebido/pago; nada muda
BLOCKED = "blocked"  # cartão sem limite; não será lançado


def _override_value(override: dict, default: Decimal) -> Decimal:
    raw = override.get("value")
    if raw in (None, ""):
        return default
    try:
        return Decimal(str(raw))
    except InvalidOperation:
        return default


def _launch_action(existing: Any, settled: bool, is_reapply: bool) -> str:
    if existing is None:
        return CREATE
    if settled:
        return SETTLED
    return UPDATE if is_reapply else EXISTING


def build_apply_preview(plan: MonthlyPlan, user: User) -> dict:
    is_reapply = bool(plan.applied_at)
    last_day = monthrange(plan.year, plan.month)[1]
    month_start = date(plan.year, plan.month, 1)
    month_end = date(plan.year, plan.month, last_day)

    revenue_overrides = plan.fixed_revenue_overrides or {}
    revenues: list[dict[str, Any]] = []
    for fr in FixedRevenue.objects.filter(
        created_by=user, is_active=True, is_deleted=False
    ).order_by("description"):
        override = revenue_overrides.get(str(fr.id)) or {}
        if override.get("enabled") is False:
            continue
        existing = Revenue.objects.filter(
            fixed_revenue_template=fr,
            date__gte=month_start,
            date__lte=month_end,
            is_deleted=False,
        ).first()
        revenues.append(
            {
                "id": fr.id,
                "description": fr.description,
                "value": _override_value(override, fr.default_value),
                "action": _launch_action(
                    existing, bool(existing and existing.received), is_reapply
                ),
            }
        )

    expense_overrides = plan.fixed_expense_overrides or {}
    month_code = month_abbr[plan.month]
    expenses: list[dict[str, Any]] = []
    fixed_exps: dict[int, FixedExpense] = {}
    for fe in (
        FixedExpense.objects.filter(
            created_by=user, is_active=True, is_deleted=False
        )
        .select_related("credit_card")
        .order_by("description")
    ):
        override = expense_overrides.get(str(fe.id)) or {}
        if override.get("enabled") is False:
            continue
        existing_exp: Any
        if fe.credit_card:
            existing_exp = CreditCardInstallment.objects.filter(
                purchase__description=fe.description,
                purchase__card=fe.credit_card,
                bill__year=plan.year,
                bill__month=month_code,
                bill__is_deleted=False,
                is_deleted=False,
                purchase__is_deleted=False,
            ).first()
        else:
            existing_exp = Expense.objects.filter(
                fixed_expense_template=fe,
                date__gte=month_start,
                date__lte=month_end,
                is_deleted=False,
            ).first()
        fixed_exps[fe.id] = fe
        expenses.append(
            {
                "id": fe.id,
                "description": fe.description,
                "credit_card_name": (
                    fe.credit_card.name if fe.credit_card else None
                ),
                "value": _override_value(override, fe.default_value),
                "action": _launch_action(
                    existing_exp,
                    bool(existing_exp and existing_exp.payed),
                    is_reapply,
                ),
            }
        )

    # Mesmo cálculo de limite do lançamento em lote: cartões sem limite para
    # os itens a lançar ficam bloqueados (não são gerados).
    blocked = _blocked_cards(
        fixed_exps,
        [
            {"fixed_expense_id": e["id"], "value": float(e["value"])}
            for e in expenses
            if e["action"] in (CREATE, UPDATE)
        ],
        str(plan.year),
        f"{plan.month:02d}",
        is_reapply,
    )
    for e in expenses:
        card_id = fixed_exps[e["id"]].credit_card_id
        if card_id in blocked and e["action"] in (CREATE, UPDATE):
            e["action"] = BLOCKED

    disabled = set(plan.budget_disabled_categories or [])
    existing_budgets = set(
        Budget.objects.filter(
            created_by=user,
            month=plan.month,
            year=plan.year,
            is_deleted=False,
        ).values_list("category", flat=True)
    )
    budgets: list[dict[str, Any]] = []
    for category, amount in sorted((plan.budget_overrides or {}).items()):
        if category in disabled or amount in (None, ""):
            continue
        budgets.append(
            {
                "category": category,
                "amount": _override_value({"value": amount}, Decimal("0")),
                "action": UPDATE if category in existing_budgets else CREATE,
            }
        )

    def total(items: list, key: str = "value") -> Decimal:
        return sum(
            (i[key] for i in items if i["action"] in (CREATE, UPDATE)),
            Decimal("0"),
        )

    return {
        "is_reapply": is_reapply,
        "revenues": revenues,
        "expenses": expenses,
        "budgets": budgets,
        "blocked_cards": list(blocked.values()),
        "totals": {
            "revenues": total(revenues),
            "expenses": total(expenses),
            "budgets": total(budgets, "amount"),
        },
    }
