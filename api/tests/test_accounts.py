"""
Isolated unit tests for accounts.services.recalculate_account_balance().

These tests exercise the service function directly without going through
serializers or views, so they remain stable even if view/serializer logic
changes.
"""

from datetime import date, time
from decimal import Decimal

from django.test import TestCase

from accounts.models import Account
from accounts.services import recalculate_account_balance
from expenses.models import Expense
from revenues.models import Revenue

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_account(name="TestAcc", balance=Decimal("0.00")):
    """Create an Account bypassing the post_save signal
    (no initial revenue)."""
    return Account.objects.create(
        account_name=name,
        institution_name="NUB",
        account_type="CC",
        current_balance=balance,
        is_active=True,
    )


def _make_revenue(account, value, received=True):
    return Revenue.objects.create(
        description="Rev",
        value=Decimal(value),
        date=date.today(),
        horary=time(10, 0),
        category="salary",
        account=account,
        received=received,
    )


def _make_expense(account, value, payed=True):
    return Expense.objects.create(
        description="Exp",
        value=Decimal(value),
        date=date.today(),
        horary=time(10, 0),
        category="food and drink",
        account=account,
        payed=payed,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class RecalculateAccountBalanceTest(TestCase):
    """Unit tests for recalculate_account_balance(account_id)."""

    def setUp(self):
        self.account = _make_account()

    # --- return value -------------------------------------------------------

    def test_returns_new_balance(self):
        _make_revenue(self.account, "200.00")
        result = recalculate_account_balance(self.account.pk)
        self.assertEqual(result, Decimal("200.00"))

    # --- basic calculations -------------------------------------------------

    def test_zero_balance_with_no_transactions(self):
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("0.00"))

    def test_balance_equals_sum_of_received_revenues(self):
        _make_revenue(self.account, "100.00")
        _make_revenue(self.account, "50.00")
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("150.00"))

    def test_unreceived_revenues_excluded(self):
        _make_revenue(self.account, "100.00", received=True)
        _make_revenue(self.account, "200.00", received=False)
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("100.00"))

    def test_balance_reduced_by_paid_expenses(self):
        _make_revenue(self.account, "300.00")
        _make_expense(self.account, "80.00")
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("220.00"))

    def test_unpaid_expenses_excluded(self):
        _make_revenue(self.account, "300.00")
        _make_expense(self.account, "80.00", payed=True)
        _make_expense(self.account, "50.00", payed=False)
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("220.00"))

    def test_balance_can_be_negative(self):
        _make_expense(self.account, "100.00", payed=True)
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("-100.00"))

    def test_multiple_revenues_and_expenses(self):
        _make_revenue(self.account, "500.00")
        _make_revenue(self.account, "300.00")
        _make_expense(self.account, "200.00")
        _make_expense(self.account, "100.00")
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("500.00"))

    # --- soft-deleted transactions excluded ---------------------------------

    def test_soft_deleted_revenue_excluded(self):
        rev = _make_revenue(self.account, "100.00")
        rev.is_deleted = True
        rev.save(update_fields=["is_deleted"])
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("0.00"))

    def test_soft_deleted_expense_excluded(self):
        _make_revenue(self.account, "200.00")
        exp = _make_expense(self.account, "150.00")
        exp.is_deleted = True
        exp.save(update_fields=["is_deleted"])
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("200.00"))

    # --- isolation: different accounts don't interfere ----------------------

    def test_only_transactions_for_target_account_counted(self):
        other = _make_account(name="OtherAcc")
        _make_revenue(other, "999.00")
        _make_expense(other, "999.00")
        _make_revenue(self.account, "100.00")
        recalculate_account_balance(self.account.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("100.00"))

    # --- persists the result ------------------------------------------------

    def test_persists_balance_to_database(self):
        _make_revenue(self.account, "777.00")
        recalculate_account_balance(self.account.pk)
        fresh = Account.objects.get(pk=self.account.pk)
        self.assertEqual(fresh.current_balance, Decimal("777.00"))

    # --- error handling -----------------------------------------------------

    def test_raises_for_nonexistent_account(self):
        with self.assertRaises(Account.DoesNotExist):
            recalculate_account_balance(99999)
