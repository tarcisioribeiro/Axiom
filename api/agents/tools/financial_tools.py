from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.utils import timezone


def get_expense_summary(user: User, start: date, end: date) -> list[dict[str, Any]]:
    from expenses.models import Expense

    return list(
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


def get_revenue_summary(user: User, start: date, end: date) -> list[dict[str, Any]]:
    from revenues.models import Revenue

    return list(
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


def get_top_merchants(
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


def get_monthly_trend(user: User, months: int = 3) -> list[dict[str, Any]]:
    """Retorna total de despesas por mês nos últimos N meses."""
    from django.db.models.functions import TruncMonth

    from expenses.models import Expense

    cutoff = timezone.now().date() - timedelta(days=months * 31)
    return list(
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


def get_total_balances(user: User) -> list[dict[str, Any]]:
    from accounts.models import Account

    rows = Account.objects.filter(
        owner__user=user,
        is_active=True,
        is_deleted=False,
    ).values("account_name", "institution_name", "current_balance")
    return [dict(r) for r in rows]


def get_current_month_totals(
    user: User,
    start: date | None = None,
    end: date | None = None,
) -> dict[str, Any]:
    from expenses.models import Expense
    from revenues.models import Revenue

    now = timezone.now().date()
    period_start = start if start is not None else now.replace(day=1)
    period_end = end if end is not None else now

    expenses_total = (
        Expense.objects.filter(
            created_by=user,
            date__range=(period_start, period_end),
            is_deleted=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"]
        or 0
    )
    revenues_total = (
        Revenue.objects.filter(
            created_by=user,
            date__range=(period_start, period_end),
            is_deleted=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"]
        or 0
    )
    return {
        "expenses": float(expenses_total),
        "revenues": float(revenues_total),
        "balance": float(revenues_total) - float(expenses_total),
        "month_start": period_start.strftime("%d/%m/%Y"),
        "today": period_end.strftime("%d/%m/%Y"),
    }
