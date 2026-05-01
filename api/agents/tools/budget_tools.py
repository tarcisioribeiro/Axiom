import calendar
from datetime import date
from typing import Any, cast

from django.contrib.auth.models import User
from django.db.models import Sum
from django.utils import timezone


def get_budget_status(
    user: User,
    year: int | None = None,
    month: int | None = None,
    expense_start: date | None = None,
    expense_end: date | None = None,
) -> list[dict[str, Any]]:
    """
    Returns status of each budget for the given month.

    - year/month: which budget definitions to load (defaults to current month).
    - expense_start/expense_end: date range for actual spending (defaults to
      the full target month capped at today for the current month).
    """
    from budgets.models import Budget
    from expenses.models import Expense

    now = timezone.now()
    target_year = year if year is not None else now.year
    target_month = month if month is not None else now.month

    budgets = list(
        Budget.objects.filter(
            created_by=user,
            month=target_month,
            year=target_year,
            is_deleted=False,
        ).values("category", "limit_amount", "rollover_amount", "rollover_enabled")
    )

    # Determine expense date range
    if expense_start is not None and expense_end is not None:
        period_start, period_end = expense_start, expense_end
    else:
        _, last_day = calendar.monthrange(target_year, target_month)
        period_start = date(target_year, target_month, 1)
        month_end = date(target_year, target_month, last_day)
        today = now.date()
        period_end = month_end if month_end < today else today

    result = []
    for budget in budgets:
        spent = (
            Expense.objects.filter(
                created_by=user,
                category=budget["category"],
                date__range=(period_start, period_end),
                is_deleted=False,
                related_transfer__isnull=True,
            ).aggregate(total=Sum("value"))["total"]
            or 0
        )
        effective_limit = float(budget["limit_amount"]) + float(
            budget["rollover_amount"] or 0
        )
        pct = (float(spent) / effective_limit * 100) if effective_limit > 0 else 0
        result.append(
            {
                "category": budget["category"],
                "limit": effective_limit,
                "spent": float(spent),
                "remaining": max(0.0, effective_limit - float(spent)),
                "percentage": round(pct, 1),
                "overbudget": float(spent) > effective_limit,
            }
        )

    result.sort(key=lambda x: cast(float, x["percentage"]), reverse=True)
    return result


def get_days_remaining_in_month() -> int:
    now = timezone.now().date()
    last_day = calendar.monthrange(now.year, now.month)[1]
    return last_day - now.day


def get_projected_end_of_month(
    spent: float, days_elapsed: int, days_total: int
) -> float:
    """Projects total spending at end of month based on current pace."""
    if days_elapsed == 0:
        return spent
    daily_rate = spent / days_elapsed
    return daily_rate * days_total
