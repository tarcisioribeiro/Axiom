import calendar
from datetime import timedelta
from typing import Any, cast

from django.contrib.auth.models import User
from django.db.models import Avg
from django.utils import timezone


def get_account_balances(user: User) -> list[dict[str, Any]]:
    from accounts.models import Account

    accounts = Account.objects.filter(
        owner__user=user,
        is_active=True,
        is_deleted=False,
    ).values(
        "account_name",
        "institution_name",
        "current_balance",
        "minimum_balance",
    )
    return [
        {
            "name": str(a["account_name"]),
            "institution": str(a["institution_name"]),
            "balance": float(a["current_balance"]),
            "minimum": float(a["minimum_balance"]),
        }
        for a in accounts
    ]


def get_fixed_expenses_upcoming(
    user: User, days: int = 30
) -> list[dict[str, Any]]:
    """Retorna despesas fixas que vencem nos próximos N dias."""
    from expenses.models import FixedExpense

    today = timezone.now().date()
    upcoming = []

    fixed = FixedExpense.objects.filter(
        created_by=user,
        is_active=True,
        is_deleted=False,
    ).values("description", "default_value", "due_day", "category")

    for fe in fixed:
        due_day = fe["due_day"]
        # Calcula próxima data de vencimento
        try:
            next_due = today.replace(day=due_day)
        except ValueError:
            # Dia inexistente no mês (ex: 31 em fevereiro)
            last = calendar.monthrange(today.year, today.month)[1]
            next_due = today.replace(day=last)

        if next_due < today:
            # Já venceu este mês — projeta pro mês seguinte
            next_month = today.replace(day=1) + timedelta(days=32)
            try:
                next_due = next_month.replace(day=due_day)
            except ValueError:
                last = calendar.monthrange(next_month.year, next_month.month)[
                    1
                ]
                next_due = next_month.replace(day=last)

        days_until = (next_due - today).days
        if days_until <= days:
            upcoming.append(
                {
                    "description": fe["description"],
                    "value": float(fe["default_value"]),
                    "due_date": next_due.strftime("%d/%m/%Y"),
                    "days_until": days_until,
                    "category": fe["category"],
                }
            )

    upcoming.sort(key=lambda x: cast(int, x["days_until"]))
    return upcoming


def get_expected_revenues(user: User, days: int = 30) -> list[dict[str, Any]]:
    """
    Retorna receitas recorrentes históricas para estimar entradas futuras.
    """
    from revenues.models import Revenue

    cutoff = timezone.now().date() - timedelta(days=90)
    recurring = (
        Revenue.objects.filter(
            created_by=user,
            date__gte=cutoff,
            is_deleted=False,
            recurring=True,
            related_transfer__isnull=True,
        )
        .values("description", "category", "source")
        .annotate(avg_value=Avg("value"))
    )
    return [
        {
            "description": r["description"],
            "category": r["category"],
            "avg_value": float(r["avg_value"]),
        }
        for r in recurring
    ]


def compute_balance_projection(
    total_balance: float,
    fixed_expenses: list[dict[str, Any]],
    expected_revenues: list[dict[str, Any]],
    days: int = 30,
) -> dict[str, Any]:
    """Projeção simplificada de saldo ao fim do período."""
    outflows = sum(
        fe["value"] for fe in fixed_expenses if fe["days_until"] <= days
    )
    inflows = sum(r["avg_value"] for r in expected_revenues)

    projected = total_balance + inflows - outflows
    return {
        "current_total": total_balance,
        "projected_inflows": inflows,
        "projected_outflows": outflows,
        "projected_balance": projected,
        "days": days,
        "alert": projected < 0,
    }
