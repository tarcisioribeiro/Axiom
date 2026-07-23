"""
Tools financeiras com cache Redis.

TTL de 60s alinhado a CACHE_TTL_DASHBOARD_STATS para consistência entre
as queries do dashboard e as queries dos agentes sobre os mesmos dados.
"""

from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone

from agents.providers import financial_provider

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

    result = financial_provider.expense_category_summary(user, start, end)
    cache.set(key, result, _TTL_EXPENSES)
    return result


def get_revenue_summary(
    user: User, start: date, end: date
) -> list[dict[str, Any]]:
    key = _cache_key("revenue_summary", user.pk, start, end)
    cached = cache.get(key)
    if cached is not None:
        return cached

    result = financial_provider.revenue_category_summary(user, start, end)
    cache.set(key, result, _TTL_EXPENSES)
    return result


def get_top_merchants(
    user: User, start: date, end: date, limit: int = 5
) -> list[dict[str, Any]]:
    key = _cache_key("top_merchants", user.pk, start, end, limit)
    cached = cache.get(key)
    if cached is not None:
        return cached

    result = financial_provider.top_merchants(user, start, end, limit)
    cache.set(key, result, _TTL_EXPENSES)
    return result


def get_monthly_trend(user: User, months: int = 3) -> list[dict[str, Any]]:
    key = _cache_key("monthly_trend", user.pk, months)
    cached = cache.get(key)
    if cached is not None:
        return cached

    cutoff = timezone.now().date() - timedelta(days=months * 31)
    result = financial_provider.monthly_expense_trend(user, cutoff)
    cache.set(key, result, _TTL_TREND)
    return result


def get_total_balances(user: User) -> list[dict[str, Any]]:
    key = _cache_key("total_balances", user.pk)
    cached = cache.get(key)
    if cached is not None:
        return cached

    result = [
        {
            "account_name": a["account_name"],
            "institution_name": a["institution_name"],
            "current_balance": a["current_balance"],
        }
        for a in financial_provider.account_balances(user)
    ]
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

    expenses_total = financial_provider.expense_total(
        user, period_start, period_end
    )
    revenues_total = financial_provider.revenue_total(
        user, period_start, period_end
    )
    result = {
        "expenses": expenses_total,
        "revenues": revenues_total,
        "balance": revenues_total - expenses_total,
        "month_start": period_start.strftime("%d/%m/%Y"),
        "today": period_end.strftime("%d/%m/%Y"),
    }
    cache.set(key, result, _TTL_EXPENSES)
    return result
