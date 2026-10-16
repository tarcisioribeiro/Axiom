"""
Ponto único de acesso ao ORM de `accounts`, `expenses`, `revenues` e
`budgets` a partir de `agents/`.

Só este pacote (`agents/providers/`) importa models de outros apps — o
restante de `agents/` (tools, agents de domínio, views) consome estas
funções. Ver documentation/architecture/agents-llm-boundary.md.
"""

from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Avg, Count, Sum
from django.db.models.functions import TruncMonth

from agents.providers.access import requires_screen


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=[]
)
def expense_category_summary(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    from expenses.models import Expense

    qs: Any = (
        Expense.objects.filter(
            created_by=user,
            date__range=(start, end),
            is_deleted=False,
            related_transfer__isnull=True,
        )
        .values("category")
        .annotate(total=Sum("value"), count=Count("id"))
        .order_by("-total")
    )
    return list(qs)


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=[]
)
def revenue_category_summary(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    from revenues.models import Revenue

    qs: Any = (
        Revenue.objects.filter(
            created_by=user,
            date__range=(start, end),
            is_deleted=False,
            related_transfer__isnull=True,
        )
        .values("category")
        .annotate(total=Sum("value"), count=Count("id"))
        .order_by("-total")
    )
    return list(qs)


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=[]
)
def top_merchants(
    user: User, start: date, end: date, limit: int = 5
) -> list[dict[str, Any]]:
    from expenses.models import Expense

    qs: Any = (
        Expense.objects.filter(
            created_by=user,
            date__range=(start, end),
            merchant__isnull=False,
            is_deleted=False,
            related_transfer__isnull=True,
        )
        .exclude(merchant="")
        .values("merchant")
        .annotate(total=Sum("value"), count=Count("id"))
        .order_by("-total")[:limit]
    )
    return list(qs)


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=[]
)
def monthly_expense_trend(user: User, cutoff: date) -> list[dict[str, Any]]:
    from expenses.models import Expense

    qs: Any = (
        Expense.objects.filter(
            created_by=user,
            date__gte=cutoff,
            is_deleted=False,
            related_transfer__isnull=True,
        )
        .annotate(month=TruncMonth("date"))
        .values("month")
        .annotate(total=Sum("value"), count=Count("id"))
        .order_by("month")
    )
    return list(qs)


@requires_screen("finance.accounts", "finance.dashboard", empty=[])
def account_balances(user: User) -> list[dict[str, Any]]:
    """Saldos de contas ativas — `account_name`, `institution_name`,
    `current_balance`, `minimum_balance`."""
    from accounts.models import Account

    rows = Account.objects.filter(
        owner__user=user,
        is_active=True,
        is_deleted=False,
    ).values(
        "account_name",
        "institution_name",
        "current_balance",
        "minimum_balance",
    )
    return [dict(r) for r in rows]


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=0.0
)
def expense_total(user: User, start: date, end: date) -> float:
    from expenses.models import Expense

    total = (
        Expense.objects.filter(
            created_by=user,
            date__range=(start, end),
            is_deleted=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"]
        or 0
    )
    return float(total)


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=0.0
)
def revenue_total(user: User, start: date, end: date) -> float:
    from revenues.models import Revenue

    total = (
        Revenue.objects.filter(
            created_by=user,
            date__range=(start, end),
            is_deleted=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"]
        or 0
    )
    return float(total)


@requires_screen("finance.recurring", empty=[])
def fixed_expenses_active(user: User) -> list[dict[str, Any]]:
    from expenses.models import FixedExpense

    rows = FixedExpense.objects.filter(
        created_by=user,
        is_active=True,
        is_deleted=False,
    ).values("description", "default_value", "due_day", "category")
    return [dict(r) for r in rows]


@requires_screen("finance.recurring", empty=[])
def recurring_revenues_avg(user: User, cutoff: date) -> list[dict[str, Any]]:
    from revenues.models import Revenue

    qs: Any = (
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
    return list(qs)


@requires_screen("finance.budgets", empty=[])
def budgets_for_period(
    user: User, year: int, month: int
) -> list[dict[str, Any]]:
    from budgets.models import Budget

    rows: Any = Budget.objects.filter(
        created_by=user,
        month=month,
        year=year,
        is_deleted=False,
    ).values("category", "limit_amount", "rollover_amount", "rollover_enabled")
    return list(rows)


@requires_screen(
    "finance.transactions", "finance.dashboard", "finance.analytics", empty=0.0
)
def expense_total_for_category(
    user: User, category: str, start: date, end: date
) -> float:
    from expenses.models import Expense

    total = (
        Expense.objects.filter(
            created_by=user,
            category=category,
            date__range=(start, end),
            is_deleted=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"]
        or 0
    )
    return float(total)
