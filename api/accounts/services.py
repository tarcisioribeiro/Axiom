"""
Service layer for account balance management.

Replaces the post_save/post_delete signal-based approach with an explicit
function that can be called, tested, and reasoned about independently.
"""

import datetime
from decimal import Decimal
from typing import Union

from django.db import models, transaction

from accounts.models import Account


def get_projected_balance(
    account_id: Union[int, str], target_date: datetime.date
) -> Decimal:
    """
    Returns the projected account balance on target_date.

    Starts from current_balance (already confirmed revenues − expenses) and
    adds pending revenues / subtracts pending expenses whose date falls up to
    and including target_date.  Transfer-generated records are excluded because
    the transfer itself is tracked separately.
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    account = Account.objects.get(pk=account_id)
    base = account.current_balance

    pending_revenues = Revenue.objects.filter(
        account=account,
        received=False,
        is_deleted=False,
        date__lte=target_date,
    ).aggregate(total=models.Sum("value"))["total"] or Decimal("0.00")

    pending_expenses = Expense.objects.filter(
        account=account,
        payed=False,
        is_deleted=False,
        is_initial_balance=False,
        date__lte=target_date,
    ).aggregate(total=models.Sum("value"))["total"] or Decimal("0.00")

    return base + pending_revenues - pending_expenses


def recalculate_account_balance(account_id: Union[int, str]) -> Decimal:
    """
    Recalculate and persist the current balance for a given account.

    Uses SELECT FOR UPDATE to prevent concurrent update races. Always runs
    inside a transaction so the balance write is atomic with the originating
    expense/revenue write when the caller wraps both in transaction.atomic().

    Parameters
    ----------
    account_id : int | str
        Primary key of the Account to recalculate.

    Returns
    -------
    Decimal
        The newly computed balance.

    Raises
    ------
    Account.DoesNotExist
        If no Account with the given pk exists.
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    with transaction.atomic():
        account = Account.objects.select_for_update().get(pk=account_id)

        total_revenues = Revenue.objects.filter(
            account=account, received=True, is_deleted=False
        ).aggregate(total=models.Sum("value"))["total"] or Decimal("0.00")

        total_expenses = Expense.objects.filter(
            account=account, payed=True, is_deleted=False
        ).aggregate(total=models.Sum("value"))["total"] or Decimal("0.00")

        new_balance = total_revenues - total_expenses
        account.current_balance = new_balance
        account.save(update_fields=["current_balance"])

    return new_balance
