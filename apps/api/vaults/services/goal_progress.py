from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

VAULT_BASED_CATEGORIES = {
    "savings",
    "investment",
    "emergency",
    "travel",
    "education",
    "property",
    "vehicle",
    "retirement",
    "health",
    "other",
}


def compute_progress(goal) -> dict:
    """
    Computes financial goal progress based on the goal's category.

    For vault-based categories, aggregates vault balances.
    For reduce_expenses, sums current-month expenses in the linked
    category/account.
    For increase_revenue, sums current-month revenues in the linked account.

    Returns:
        dict with keys: current_value (Decimal), target_value (Decimal),
                        percentage (Decimal), data_source (str)
    """
    target = goal.target_value

    if goal.category in VAULT_BASED_CATEGORIES:
        current = goal.current_value
        data_source = "vaults"
    elif goal.category == "reduce_expenses":
        current = _sum_current_month_expenses(goal)
        data_source = "expenses"
    elif goal.category == "increase_revenue":
        current = _sum_current_month_revenues(goal)
        data_source = "revenues"
    else:
        current = goal.current_value
        data_source = "vaults"

    if target <= 0:
        percentage = Decimal("0.00")
    else:
        percentage = min((current / target) * 100, Decimal("100.00")).quantize(
            Decimal("0.01")
        )

    return {
        "current_value": current,
        "target_value": target,
        "percentage": percentage,
        "data_source": data_source,
    }


def _sum_current_month_expenses(goal) -> Decimal:
    from expenses.models import Expense

    now = timezone.now()
    qs = Expense.objects.filter(
        is_deleted=False,
        date__year=now.year,
        date__month=now.month,
        created_by=goal.created_by,
    )
    if goal.linked_expense_category:
        qs = qs.filter(category=goal.linked_expense_category)
    if goal.linked_account_id:
        qs = qs.filter(account_id=goal.linked_account_id)

    total = qs.aggregate(total=Sum("value"))["total"]
    return total or Decimal("0.00")


def _sum_current_month_revenues(goal) -> Decimal:
    from revenues.models import Revenue

    now = timezone.now()
    qs = Revenue.objects.filter(
        is_deleted=False,
        date__year=now.year,
        date__month=now.month,
        created_by=goal.created_by,
    )
    if goal.linked_account_id:
        qs = qs.filter(account_id=goal.linked_account_id)

    total = qs.aggregate(total=Sum("value"))["total"]
    return total or Decimal("0.00")
