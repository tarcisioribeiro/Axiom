"""
Tools financeiras com cache Redis.

TTL de 60s alinhado a CACHE_TTL_DASHBOARD_STATS para consistência entre
as queries do dashboard e as queries dos agentes sobre os mesmos dados.
"""

from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Count, Sum
from django.utils import timezone

_TTL_EXPENSES = 60  # alinhado ao CACHE_TTL_DASHBOARD_STATS
_TTL_BALANCES = 30  # alinhado ao CACHE_TTL_ACCOUNT_BALANCES
_TTL_TREND = 120  # menos volátil, pode ser mais longo


def _cache_key(*parts: Any) -> str:
    return "agents:" + ":".join(str(p) for p in parts)


def get_expense_summary(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    key = _cache_key("expense_summary", user.pk, start, end)
    cached = cache.get(key)
    if cached is not None:
        return cached

    from expenses.models import Expense

    result = list(
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
    cache.set(key, result, _TTL_EXPENSES)
    return result


def get_revenue_summary(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    key = _cache_key("revenue_summary", user.pk, start, end)
    cached = cache.get(key)
    if cached is not None:
        return cached

    from revenues.models import Revenue

    result = list(
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
    cache.set(key, result, _TTL_EXPENSES)
    return result


def get_top_merchants(
    user: User, start: date, end: date, limit: int = 5
) -> list[dict[str, Any]]:
    key = _cache_key("top_merchants", user.pk, start, end, limit)
    cached = cache.get(key)
    if cached is not None:
        return cached

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
    result = list(qs)
    cache.set(key, result, _TTL_EXPENSES)
    return result


def get_monthly_trend(user: User, months: int = 3) -> list[dict[str, Any]]:
    key = _cache_key("monthly_trend", user.pk, months)
    cached = cache.get(key)
    if cached is not None:
        return cached

    from django.db.models.functions import TruncMonth

    from expenses.models import Expense

    cutoff = timezone.now().date() - timedelta(days=months * 31)
    result = list(
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
    cache.set(key, result, _TTL_TREND)
    return result


def get_total_balances(user: User) -> list[dict[str, Any]]:
    key = _cache_key("total_balances", user.pk)
    cached = cache.get(key)
    if cached is not None:
        return cached

    from accounts.models import Account

    rows = Account.objects.filter(
        owner__user=user,
        is_active=True,
        is_deleted=False,
    ).values("account_name", "institution_name", "current_balance")
    result = [dict(r) for r in rows]
    cache.set(key, result, _TTL_BALANCES)
    return result


def get_current_month_totals(
    user: User,
    start: date | None = None,
    end: date | None = None,
) -> dict[str, Any]:
    now = timezone.now().date()
    period_start = start if start is not None else now.replace(day=1)
    period_end = end if end is not None else now

    key = _cache_key("month_totals", user.pk, period_start, period_end)
    cached = cache.get(key)
    if cached is not None:
        return cached

    from expenses.models import Expense
    from revenues.models import Revenue

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
    result = {
        "expenses": float(expenses_total),
        "revenues": float(revenues_total),
        "balance": float(revenues_total) - float(expenses_total),
        "month_start": period_start.strftime("%d/%m/%Y"),
        "today": period_end.strftime("%d/%m/%Y"),
    }
    cache.set(key, result, _TTL_EXPENSES)
    return result
