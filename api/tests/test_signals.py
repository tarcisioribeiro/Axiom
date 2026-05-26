"""
Tests for all Django signal handlers.

Covers:
- accounts/signals.py  — initial revenue on account creation
                         (balance updates are covered by
                          tests/test_accounts.py)
- credit_cards/signals.py — bill total recalculation, bill defaults
- transfers/signals.py    — auto-create expense/revenue, cleanup on delete
- payables/signals.py     — paid_value sync
- loans/signals.py        — payed_value sync and status transitions
- expenses/signals.py     — auto-categorization
- personal_planning/signals.py — goal progress on task completion
"""

from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Account
from expenses.models import CategorizationRule, Expense
from revenues.models import Revenue

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_account(name="TestAcc", atype="CC"):
    return Account.objects.create(
        account_name=name,
        institution_name="NUB",
        account_type=atype,
        is_active=True,
    )


def _make_member(name="Test Member", document_hash=None):
    from members.models import Member

    if document_hash is None:
        # Use a unique hash derived from the name to avoid collisions
        import hashlib

        document_hash = (
            hashlib.md5(name.encode()).hexdigest().ljust(64, "0")[:64]
        )
    return Member.objects.create(
        name=name,
        document_hash=document_hash,
        phone="11999999999",
        sex="M",
    )


def _make_expense(account, value="50.00", payed=True, **kwargs):
    defaults = dict(
        description="Test expense",
        value=Decimal(value),
        date=date.today(),
        horary=time(10, 0),
        category="food and drink",
        account=account,
        payed=payed,
    )
    defaults.update(kwargs)
    return Expense.objects.create(**defaults)


def _make_revenue(account, value="100.00", received=True, **kwargs):
    defaults = dict(
        description="Test revenue",
        value=Decimal(value),
        date=date.today(),
        horary=time(10, 0),
        category="salary",
        account=account,
        received=received,
    )
    defaults.update(kwargs)
    return Revenue.objects.create(**defaults)


# ---------------------------------------------------------------------------
# accounts/signals.py
# ---------------------------------------------------------------------------


class AccountInitialRevenueSignalTest(TestCase):
    """
    create_initial_revenue_on_account_creation creates Revenue for new
    accounts.
    """

    def test_initial_revenue_created_when_account_has_positive_balance(self):
        account = Account.objects.create(
            account_name="InitAcc",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("500.00"),
        )
        revenues = Revenue.objects.filter(
            account=account, description="Saldo inicial"
        )
        self.assertEqual(revenues.count(), 1)
        self.assertEqual(revenues.first().value, Decimal("500.00"))

    def test_initial_revenue_not_created_when_balance_is_zero(self):
        account = Account.objects.create(
            account_name="ZeroAcc",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("0.00"),
        )
        revenues = Revenue.objects.filter(
            account=account, description="Saldo inicial"
        )
        self.assertEqual(revenues.count(), 0)

    def test_initial_revenue_uses_opening_date_when_set(self):
        opening = date(2025, 1, 15)
        account = Account.objects.create(
            account_name="DateAcc",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("100.00"),
            opening_date=opening,
        )
        rev = Revenue.objects.get(account=account, description="Saldo inicial")
        self.assertEqual(rev.date, opening)

    def test_initial_revenue_not_created_on_subsequent_saves(self):
        account = Account.objects.create(
            account_name="UpdateAcc",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("200.00"),
        )
        # Saving again should NOT create another initial revenue
        account.account_name = "UpdateAcc2"
        account.save()
        revenues = Revenue.objects.filter(
            account=account, description="Saldo inicial"
        )
        self.assertEqual(revenues.count(), 1)


# ---------------------------------------------------------------------------
# credit_cards/signals.py
# ---------------------------------------------------------------------------


class CreditCardBillSignalTest(TestCase):
    """Signal recalculates bill total when installments are added/removed."""

    def _make_credit_card(self, account):
        from credit_cards.models import CreditCard

        card = CreditCard(
            name="Test Card",
            on_card_name="TEST USER",
            flag="MSC",
            validation_date=date(2030, 1, 1),
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("6000.00"),
            associated_account=account,
        )
        # Set CVV via descriptor to satisfy encryption + validation
        card.security_code = "123"
        card.save()
        return card

    def _make_bill(self, card):
        from credit_cards.models import CreditCardBill

        return CreditCardBill.objects.create(
            credit_card=card,
            year="2026",
            month="Jan",
            invoice_beginning_date=date(2026, 1, 1),
            invoice_ending_date=date(2026, 1, 31),
            closed=False,
            status="open",
        )

    def _make_purchase(self, card):
        from credit_cards.models import CreditCardPurchase

        return CreditCardPurchase.objects.create(
            description="Test Purchase",
            total_value=Decimal("300.00"),
            purchase_date=date(2026, 1, 5),
            purchase_time=time(12, 0),
            category="food and drink",
            card=card,
            total_installments=3,
        )

    def setUp(self):
        self.account = _make_account()
        self.card = self._make_credit_card(self.account)
        self.bill = self._make_bill(self.card)
        self.purchase = self._make_purchase(self.card)

    def test_bill_total_updated_when_installment_added(self):
        from credit_cards.models import CreditCardInstallment

        CreditCardInstallment.objects.create(
            purchase=self.purchase,
            installment_number=1,
            value=Decimal("100.00"),
            due_date=date(2026, 2, 1),
            bill=self.bill,
        )
        self.bill.refresh_from_db()
        self.assertEqual(self.bill.total_amount, Decimal("100.00"))
        self.assertAlmostEqual(
            float(self.bill.minimum_payment), float(Decimal("10.00"))
        )

    def test_bill_total_sums_all_installments(self):
        from credit_cards.models import CreditCardInstallment

        CreditCardInstallment.objects.create(
            purchase=self.purchase,
            installment_number=1,
            value=Decimal("100.00"),
            due_date=date(2026, 2, 1),
            bill=self.bill,
        )
        CreditCardInstallment.objects.create(
            purchase=self.purchase,
            installment_number=2,
            value=Decimal("100.00"),
            due_date=date(2026, 3, 1),
            bill=self.bill,
        )
        self.bill.refresh_from_db()
        self.assertEqual(self.bill.total_amount, Decimal("200.00"))

    def test_bill_total_decreases_when_installment_deleted(self):
        from credit_cards.models import CreditCardInstallment

        inst = CreditCardInstallment.objects.create(
            purchase=self.purchase,
            installment_number=1,
            value=Decimal("100.00"),
            due_date=date(2026, 2, 1),
            bill=self.bill,
        )
        inst.delete()
        self.bill.refresh_from_db()
        self.assertEqual(self.bill.total_amount, Decimal("0.00"))

    def test_ensure_bill_defaults_corrects_wrong_status(self):
        from credit_cards.models import CreditCardBill

        # Create a bill that would have wrong status at DB level
        bill = CreditCardBill(
            credit_card=self.card,
            year="2026",
            month="Feb",
            invoice_beginning_date=date(2026, 2, 1),
            invoice_ending_date=date(2026, 2, 28),
            closed=True,
            status="closed",
        )
        # Force direct DB update to bypass signal on initial save,
        # then re-save to trigger ensure_bill_defaults
        bill.save()  # signal fires here and should correct to open/False
        bill.refresh_from_db()
        # The signal corrects closed=True and status='closed' on creation
        self.assertEqual(bill.status, "open")
        self.assertFalse(bill.closed)


# ---------------------------------------------------------------------------
# transfers/signals.py
# ---------------------------------------------------------------------------


class TransferSignalTest(TestCase):
    """Transfer signals create/delete linked expense and revenue."""

    def setUp(self):
        self.origin = _make_account("Origin", "CC")
        self.dest = _make_account("Dest", "CS")

    def _make_transfer(self, transfered=True):
        from transfers.models import Transfer

        return Transfer.objects.create(
            description="Test Transfer",
            value=Decimal("200.00"),
            date=date.today(),
            horary=time(10, 0),
            category="pix",
            origin_account=self.origin,
            destiny_account=self.dest,
            transfered=transfered,
            fee=Decimal("0.00"),
        )

    def test_expense_and_revenue_created_on_completed_transfer(self):
        transfer = self._make_transfer(transfered=True)
        expense = Expense.objects.filter(
            related_transfer=transfer,
            account=self.origin,
        ).first()
        revenue = Revenue.objects.filter(
            related_transfer=transfer,
            account=self.dest,
        ).first()

        self.assertIsNotNone(
            expense, "Expense should be created for origin account"
        )
        self.assertIsNotNone(
            revenue, "Revenue should be created for dest account"
        )
        self.assertEqual(expense.value, Decimal("200.00"))
        self.assertEqual(revenue.value, Decimal("200.00"))

    def test_transfer_with_fee_adds_fee_to_expense_value(self):
        from transfers.models import Transfer

        transfer = Transfer.objects.create(
            description="Fee Transfer",
            value=Decimal("100.00"),
            date=date.today(),
            horary=time(10, 0),
            category="ted",
            origin_account=self.origin,
            destiny_account=self.dest,
            transfered=True,
            fee=Decimal("5.00"),
        )
        expense = Expense.objects.filter(related_transfer=transfer).first()
        self.assertIsNotNone(expense)
        self.assertEqual(expense.value, Decimal("105.00"))  # value + fee

    def test_no_expense_revenue_when_transfer_not_completed(self):
        transfer = self._make_transfer(transfered=False)
        self.assertFalse(
            Expense.objects.filter(related_transfer=transfer).exists()
        )
        self.assertFalse(
            Revenue.objects.filter(related_transfer=transfer).exists()
        )

    def test_no_duplicate_expense_on_transfer_update(self):
        """
        Saving the same transfer again must not create duplicate
        transactions.
        """
        transfer = self._make_transfer(transfered=True)
        initial_count = Expense.objects.filter(
            related_transfer=transfer
        ).count()
        transfer.notes = "updated"
        transfer.save()
        self.assertEqual(
            Expense.objects.filter(related_transfer=transfer).count(),
            initial_count,
        )

    def test_related_transactions_deleted_when_transfer_deleted(self):
        transfer = self._make_transfer(transfered=True)
        transfer_pk = transfer.pk
        self.assertTrue(
            Expense.objects.filter(related_transfer_id=transfer_pk).exists()
        )
        self.assertTrue(
            Revenue.objects.filter(related_transfer_id=transfer_pk).exists()
        )

        transfer.delete()
        self.assertFalse(
            Expense.objects.filter(related_transfer_id=transfer_pk).exists()
        )
        self.assertFalse(
            Revenue.objects.filter(related_transfer_id=transfer_pk).exists()
        )


# ---------------------------------------------------------------------------
# payables/signals.py
# ---------------------------------------------------------------------------


class PayableSignalTest(TestCase):
    """Expense save/delete keeps Payable.paid_value in sync."""

    def _make_payable(self, value="300.00"):
        from payables.models import Payable

        return Payable.objects.create(
            description="Dentist bill",
            value=Decimal(value),
            date=date.today(),
            category="health and care",
            status="active",
        )

    def setUp(self):
        self.account = _make_account()
        self.payable = self._make_payable()

    def test_paid_value_updated_when_expense_linked_and_paid(self):
        _make_expense(
            self.account,
            value="100.00",
            payed=True,
            related_payable=self.payable,
        )
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, Decimal("100.00"))

    def test_payable_marked_paid_when_fully_covered(self):
        _make_expense(
            self.account,
            value="300.00",
            payed=True,
            related_payable=self.payable,
        )
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.status, "paid")

    def test_payable_status_reverted_when_expense_deleted(self):
        exp = _make_expense(
            self.account,
            value="300.00",
            payed=True,
            related_payable=self.payable,
        )
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.status, "paid")

        exp.delete()
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, Decimal("0.00"))
        self.assertEqual(self.payable.status, "active")

    def test_paid_value_sums_multiple_expenses(self):
        _make_expense(
            self.account,
            value="100.00",
            payed=True,
            related_payable=self.payable,
        )
        _make_expense(
            self.account,
            value="50.00",
            payed=True,
            related_payable=self.payable,
        )
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, Decimal("150.00"))

    def test_soft_deleted_expense_excluded_from_paid_value(self):
        """is_deleted=True expenses are excluded from the paid_value total."""
        exp = _make_expense(
            self.account,
            value="100.00",
            payed=True,
            related_payable=self.payable,
        )
        # Soft-delete by setting is_deleted and saving via update (bypasses
        # signal)
        Expense.objects.filter(pk=exp.pk).update(is_deleted=True)
        # Trigger signal by saving another expense to force recalculation
        # (payables signal checks is_deleted=False in filter)
        # We verify directly by checking the signal function logic
        from payables.signals import update_payable_paid_value

        update_payable_paid_value(self.payable)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, Decimal("0.00"))


# ---------------------------------------------------------------------------
# loans/signals.py
# ---------------------------------------------------------------------------


class LoanSignalTest(TestCase):
    """Expense and Revenue saves/deletes update Loan.payed_value and status."""

    def _make_loan(self, value="1000.00"):
        from loans.models import Loan

        member = _make_member("Loan Member", document_hash="l" * 64)
        creditor = _make_member("Creditor", document_hash="c" * 64)
        account = _make_account("LoanAcc")
        return Loan.objects.create(
            description="Test Loan",
            value=Decimal(value),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(10, 0),
            category="loans",
            account=account,
            benefited=member,
            creditor=creditor,
            payed=False,
            status="active",
        )

    def setUp(self):
        self.account = _make_account("ExpAcc")
        self.loan = self._make_loan("500.00")

    def test_payed_value_updated_when_expense_linked(self):
        _make_expense(
            self.account, value="200.00", payed=True, related_loan=self.loan
        )
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.payed_value, Decimal("200.00"))

    def test_loan_status_becomes_paid_when_fully_covered_by_expenses(self):
        _make_expense(
            self.account, value="500.00", payed=True, related_loan=self.loan
        )
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.status, "paid")

    def test_payed_value_updated_when_revenue_linked(self):
        _make_revenue(
            self.account, value="150.00", received=True, related_loan=self.loan
        )
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.payed_value, Decimal("150.00"))

    def test_payed_value_sums_expense_and_revenue(self):
        _make_expense(
            self.account, value="100.00", payed=True, related_loan=self.loan
        )
        _make_revenue(
            self.account, value="100.00", received=True, related_loan=self.loan
        )
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.payed_value, Decimal("200.00"))

    def test_loan_status_becomes_overdue_when_past_due_date_and_unpaid(self):
        from loans.signals import update_loan_status

        self.loan.due_date = date(2020, 1, 1)  # Past date
        self.loan.payed_value = Decimal("0.00")
        self.loan.save(update_fields=["due_date", "payed_value", "updated_at"])
        update_loan_status(self.loan)
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.status, "overdue")

    def test_payed_value_recalculated_after_expense_deleted(self):
        exp = _make_expense(
            self.account, value="300.00", payed=True, related_loan=self.loan
        )
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.payed_value, Decimal("300.00"))

        exp.delete()
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.payed_value, Decimal("0.00"))


# ---------------------------------------------------------------------------
# expenses/signals.py (auto-categorization)
# ---------------------------------------------------------------------------


class AutoCategorizeExpenseSignalTest(TestCase):
    """pre_save signal applies categorization rules to new expenses."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="cattest", password="pass123", is_superuser=True
        )
        self.account = _make_account()

    def test_category_auto_applied_when_rule_matches_merchant(self):
        CategorizationRule.objects.create(
            merchant_contains="starbucks",
            category="food and drink",
            is_active=True,
            owner=self.user,
        )
        exp = Expense.objects.create(
            description="Coffee",
            value=Decimal("15.00"),
            date=date.today(),
            horary=time(9, 0),
            category="others",
            account=self.account,
            payed=True,
            merchant="Starbucks Paulista",
            created_by=self.user,
        )
        exp.refresh_from_db()
        self.assertEqual(exp.category, "food and drink")
        self.assertTrue(exp.auto_categorized)

    def test_category_not_changed_when_no_rule_matches(self):
        exp = Expense.objects.create(
            description="Random",
            value=Decimal("30.00"),
            date=date.today(),
            horary=time(9, 0),
            category="others",
            account=self.account,
            payed=True,
            merchant="Unknown Shop",
            created_by=self.user,
        )
        self.assertEqual(exp.category, "others")
        self.assertFalse(exp.auto_categorized)

    def test_category_not_changed_when_already_categorized(self):
        CategorizationRule.objects.create(
            merchant_contains="unknown",
            category="food and drink",
            is_active=True,
            owner=self.user,
        )
        exp = Expense.objects.create(
            description="Already categorized",
            value=Decimal("30.00"),
            date=date.today(),
            horary=time(9, 0),
            category="transport",  # already has a non-'others' category
            account=self.account,
            payed=True,
            merchant="Unknown Shop",
            created_by=self.user,
        )
        # Signal only fires for 'others' category
        self.assertEqual(exp.category, "transport")

    def test_inactive_rule_is_ignored(self):
        CategorizationRule.objects.create(
            merchant_contains="mcdonalds",
            category="food and drink",
            is_active=False,  # inactive
            owner=self.user,
        )
        exp = Expense.objects.create(
            description="Burger",
            value=Decimal("25.00"),
            date=date.today(),
            horary=time(12, 0),
            category="others",
            account=self.account,
            payed=True,
            merchant="McDonalds",
            created_by=self.user,
        )
        self.assertEqual(exp.category, "others")

    def test_rule_matching_is_case_insensitive(self):
        CategorizationRule.objects.create(
            merchant_contains="UBER",
            category="transport",
            is_active=True,
            owner=self.user,
        )
        exp = Expense.objects.create(
            description="Ride",
            value=Decimal("12.00"),
            date=date.today(),
            horary=time(8, 0),
            category="others",
            account=self.account,
            payed=True,
            merchant="uber trip",
            created_by=self.user,
        )
        self.assertEqual(exp.category, "transport")

    def test_signal_skipped_when_no_merchant(self):
        CategorizationRule.objects.create(
            merchant_contains="test",
            category="food and drink",
            is_active=True,
            owner=self.user,
        )
        exp = Expense.objects.create(
            description="Cash buy",
            value=Decimal("50.00"),
            date=date.today(),
            horary=time(10, 0),
            category="others",
            account=self.account,
            payed=True,
            merchant="",  # no merchant
            created_by=self.user,
        )
        self.assertEqual(exp.category, "others")

    def test_edit_to_others_triggers_recategorization(self):
        """Updating category to 'others' re-applies matching rules."""
        CategorizationRule.objects.create(
            merchant_contains="starbucks",
            category="food and drink",
            is_active=True,
            owner=self.user,
        )
        exp = Expense.objects.create(
            description="Coffee",
            value=Decimal("15.00"),
            date=date.today(),
            horary=time(9, 0),
            category="transport",  # explicitly set on creation
            account=self.account,
            payed=True,
            merchant="Starbucks Paulista",
            created_by=self.user,
        )
        self.assertEqual(exp.category, "transport")
        self.assertFalse(exp.auto_categorized)

        # User resets category back to 'others'
        exp.category = "others"
        exp.save()
        exp.refresh_from_db()

        self.assertEqual(exp.category, "food and drink")
        self.assertTrue(exp.auto_categorized)

    def test_edit_to_specific_category_clears_auto_flag(self):
        """
        Manually setting a specific category clears the auto_categorized
        flag.
        """
        CategorizationRule.objects.create(
            merchant_contains="uber",
            category="transport",
            is_active=True,
            owner=self.user,
        )
        # Create expense — auto-categorized on creation
        exp = Expense.objects.create(
            description="Ride",
            value=Decimal("20.00"),
            date=date.today(),
            horary=time(8, 0),
            category="others",
            account=self.account,
            payed=True,
            merchant="Uber trip",
            created_by=self.user,
        )
        self.assertEqual(exp.category, "transport")
        self.assertTrue(exp.auto_categorized)

        # User explicitly overrides with a different category
        exp.category = "food and drink"
        exp.save()
        exp.refresh_from_db()

        self.assertEqual(exp.category, "food and drink")
        self.assertFalse(exp.auto_categorized)

    def test_edit_other_fields_category_already_others_no_recategorization(
        self,
    ):
        """
        Updating other fields when category is already 'others' does not
        re-apply.
        """
        exp = Expense.objects.create(
            description="Mystery",
            value=Decimal("10.00"),
            date=date.today(),
            horary=time(10, 0),
            category="others",
            account=self.account,
            payed=False,
            merchant="Unknown Shop",
            created_by=self.user,
        )
        self.assertEqual(exp.category, "others")
        self.assertFalse(exp.auto_categorized)

        # Add a rule and update an unrelated field — category is still 'others'
        CategorizationRule.objects.create(
            merchant_contains="unknown",
            category="purchases",
            is_active=True,
            owner=self.user,
        )
        exp.payed = True
        exp.save()
        exp.refresh_from_db()

        # category stays 'others', auto_categorized stays False (no category
        # change)
        self.assertEqual(exp.category, "others")
        self.assertFalse(exp.auto_categorized)


# ---------------------------------------------------------------------------
# personal_planning/signals.py
# ---------------------------------------------------------------------------


class GoalProgressSignalTest(TestCase):
    """TaskInstance completion increments linked Goal.current_value."""

    def _make_member(self):
        return _make_member("Goal Member", document_hash="g" * 64)

    def _make_task(self, member):
        from personal_planning.models import RoutineTask

        return RoutineTask.objects.create(
            name="Daily Meditation",
            category="wellness",
            periodicity="daily",
            is_active=True,
            owner=member,
        )

    def _make_goal(self, member, task, goal_type="total_days", target=10):
        from personal_planning.models import Goal

        return Goal.objects.create(
            title="Meditate 10 days",
            goal_type=goal_type,
            related_task=task,
            target_value=target,
            current_value=0,
            start_date=date.today(),
            status="active",
            owner=member,
        )

    def _make_instance(self, task, member, status="pending"):
        from personal_planning.models import TaskInstance

        return TaskInstance.objects.create(
            template=task,
            task_name=task.name,
            category=task.category,
            scheduled_date=date.today(),
            status=status,
            owner=member,
        )

    def setUp(self):
        self.member = self._make_member()
        self.task = self._make_task(self.member)
        self.goal = self._make_goal(self.member, self.task)

    def test_goal_status_unchanged_when_target_not_reached(self):
        # Signal now uses calculated_current_value; current_value field is not
        # incremented directly. The goal stays active while below target.
        instance = self._make_instance(
            self.task, self.member, status="pending"
        )
        instance.status = "completed"
        instance.save()

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.status, "active")

    def test_goal_not_updated_when_instance_not_completed(self):
        instance = self._make_instance(
            self.task, self.member, status="pending"
        )
        instance.status = "in_progress"
        instance.save()

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_value, 0)

    def test_goal_marked_completed_when_target_reached(self):
        self.goal.target_value = 1
        self.goal.save()

        instance = self._make_instance(
            self.task, self.member, status="pending"
        )
        instance.status = "completed"
        instance.save()

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.status, "completed")
        self.assertIsNotNone(self.goal.end_date)

    def test_goal_not_updated_when_instance_has_no_template(self):
        from personal_planning.models import TaskInstance

        # Create a one-off task instance with no template
        instance = TaskInstance.objects.create(
            template=None,
            task_name="Ad-hoc task",
            category="wellness",
            scheduled_date=date.today(),
            status="pending",
            owner=self.member,
            occurrence_index=1,
        )
        instance.status = "completed"
        instance.save()

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_value, 0)

    def test_unrelated_goal_not_updated(self):
        other_task = self._make_task(self.member)
        other_task.name = "Other Task"
        other_task.save()

        other_goal = self._make_goal(self.member, other_task)

        # Complete instance for the main task
        instance = self._make_instance(
            self.task, self.member, status="pending"
        )
        instance.status = "completed"
        instance.save()

        other_goal.refresh_from_db()
        self.assertEqual(other_goal.current_value, 0)
