from typing import Any, cast

from django.contrib.auth.models import User
from django.db.models import Sum
from django.utils import timezone


def get_budget_status(user: User) -> list[dict[str, Any]]:
    """Retorna status de cada orçamento do mês atual com gasto real."""
    from budgets.models import Budget
    from expenses.models import Expense

    now = timezone.now()
    budgets = list(
        Budget.objects.filter(
            created_by=user,
            month=now.month,
            year=now.year,
            is_deleted=False,
        ).values("category", "limit_amount", "rollover_amount", "rollover_enabled")
    )

    month_start = now.date().replace(day=1)
    today = now.date()

    result = []
    for budget in budgets:
        spent = (
            Expense.objects.filter(
                created_by=user,
                category=budget["category"],
                date__range=(month_start, today),
                is_deleted=False,
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
    import calendar

    now = timezone.now().date()
    last_day = calendar.monthrange(now.year, now.month)[1]
    return last_day - now.day


def get_projected_end_of_month(
    spent: float, days_elapsed: int, days_total: int
) -> float:
    """Projeta o gasto total ao fim do mês com base no ritmo atual."""
    if days_elapsed == 0:
        return spent
    daily_rate = spent / days_elapsed
    return daily_rate * days_total
