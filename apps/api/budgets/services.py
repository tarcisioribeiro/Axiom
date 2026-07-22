from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from app.config import cfg


def validate_budget_limit(
    category, value, month, year, user, exclude_expense_id=None
):
    """
    Check whether adding `value` to the given category/month/year would exceed
    the user's configured budget limit.

    Returns a budget_warning dict when the limit is exceeded in 'soft' mode,
    or None when within the limit or no budget is configured.
    In 'hard' mode, raises serializers.ValidationError instead of returning.
    In 'off' mode, always returns None.

    exclude_expense_id: pk of the Expense being updated; that row is excluded
    from the current total so we don't double-count it.
    """
    from budgets.models import Budget
    from expenses.models import Expense

    mode = cfg("BUDGET_ENFORCEMENT_MODE", "soft")
    if mode == "off":
        return None

    budget = Budget.objects.filter(
        category=category,
        month=month,
        year=year,
        created_by=user,
        is_deleted=False,
    ).first()

    if not budget:
        return None

    qs = Expense.objects.filter(
        category=category,
        date__month=month,
        date__year=year,
        payed=True,
        created_by=user,
        is_deleted=False,
    )
    if exclude_expense_id is not None:
        qs = qs.exclude(pk=exclude_expense_id)

    current_total = qs.aggregate(total=Sum("value"))["total"] or Decimal(
        "0.00"
    )
    projected_total = current_total + Decimal(str(value))

    if projected_total <= budget.limit_amount:
        return None

    overage = projected_total - budget.limit_amount
    warning = {
        "category": category,
        "limit_amount": str(budget.limit_amount),
        "actual_spent": str(current_total),
        "projected_total": str(projected_total),
        "overage": str(overage),
    }

    if mode == "hard":
        raise serializers.ValidationError(
            {
                "budget": (
                    f"Limite de orçamento excedido"
                    f" para a categoria '{category}'. "
                    f"Limite: R$ {budget.limit_amount}, "
                    f"Total projetado: R$ {projected_total} "
                    f"(excesso: R$ {overage})."
                )
            }
        )

    return warning
