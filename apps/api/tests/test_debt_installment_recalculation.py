"""
Tests for the debt payment plan recalculation feature:
- payables.signals.generate_payable_installments
- payables.services.{increase_payable_value, recalculate_installments,
  create_expense_and_redistribute}
- payables/loans payment-plan endpoints
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from expenses.models import Expense, FixedExpense
from payables.models import Payable, PayableInstallment
from payables.services import (
    create_expense_and_redistribute,
    increase_payable_value,
    recalculate_installments,
)
from payables.signals import generate_payable_installments


def _make_account(name="RecalcAcc"):
    return Account.objects.create(
        account_name=name,
        institution_name="NUB",
        account_type="CC",
        is_active=True,
    )


def _make_member(name="Loan Member", document_hash="m" * 64):
    from members.models import Member

    return Member.objects.create(
        name=name,
        document_hash=document_hash,
        phone="11999999999",
        sex="M",
    )


def _make_payable(value="300.00", is_cumulative=False, paid_value="0.00"):
    return Payable.objects.create(
        description="Tratamento dentário",
        value=Decimal(value),
        paid_value=Decimal(paid_value),
        date=date.today(),
        category="health and care",
        status="active",
        is_cumulative=is_cumulative,
    )


class GeneratePayableInstallmentsTest(TestCase):
    def setUp(self):
        self.account = _make_account()
        self.payable = _make_payable("300.00")

    def test_generate_payable_installments_equal_split(self):
        fixed_expense = generate_payable_installments(
            self.payable, 3, None, self.account
        )
        installments = list(
            PayableInstallment.objects.filter(payable=self.payable).order_by(
                "installment_number"
            )
        )
        self.assertEqual(len(installments), 3)
        self.assertEqual(sum(i.value for i in installments), Decimal("300.00"))
        for inst in installments:
            self.assertEqual(inst.value, Decimal("100.00"))

        self.payable.refresh_from_db()
        self.assertEqual(self.payable.installments, 3)

        self.assertEqual(fixed_expense.related_payable, self.payable)
        self.assertEqual(fixed_expense.default_value, Decimal("100.00"))
        self.assertFalse(fixed_expense.allow_value_edit)

    def test_generate_payable_installments_reconciles_rounding(self):
        payable = _make_payable("100.00")
        generate_payable_installments(payable, 3, None, self.account)
        installments = list(
            PayableInstallment.objects.filter(payable=payable).order_by(
                "installment_number"
            )
        )
        self.assertEqual(sum(i.value for i in installments), Decimal("100.00"))
        # last installment absorbs the rounding remainder
        self.assertEqual(installments[-1].value, Decimal("33.34"))

    def test_generate_payable_installments_accounts_for_already_paid(self):
        payable = _make_payable("300.00", paid_value="100.00")
        generate_payable_installments(payable, 2, None, self.account)
        installments = list(PayableInstallment.objects.filter(payable=payable))
        self.assertEqual(sum(i.value for i in installments), Decimal("200.00"))


class IncreasePayableValueTest(TestCase):
    def setUp(self):
        self.account = _make_account()
        self.payable = _make_payable("300.00", is_cumulative=True)
        generate_payable_installments(self.payable, 3, None, self.account)
        self.payable.refresh_from_db()

    def test_increase_value_requires_cumulative_flag(self):
        non_cumulative = _make_payable("100.00", is_cumulative=False)
        with self.assertRaises(ValidationError):
            increase_payable_value(
                non_cumulative, Decimal("200.00"), None, dry_run=True
            )

    def test_increase_value_rejects_lower_value(self):
        with self.assertRaises(ValidationError):
            increase_payable_value(
                self.payable, Decimal("100.00"), None, dry_run=True
            )

    def test_dry_run_makes_no_writes(self):
        before = list(
            PayableInstallment.objects.filter(
                payable=self.payable
            ).values_list("value", flat=True)
        )
        preview = increase_payable_value(
            self.payable, Decimal("450.00"), None, dry_run=True
        )
        after = list(
            PayableInstallment.objects.filter(
                payable=self.payable
            ).values_list("value", flat=True)
        )
        self.payable.refresh_from_db()
        self.assertEqual(before, after)
        self.assertEqual(self.payable.value, Decimal("300.00"))
        self.assertEqual(preview.new_value_per_installment, Decimal("150.00"))

    def test_increase_value_commits_and_redistributes(self):
        preview = increase_payable_value(
            self.payable, Decimal("450.00"), None, dry_run=False
        )
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.value, Decimal("450.00"))
        installments = list(
            PayableInstallment.objects.filter(payable=self.payable)
        )
        self.assertEqual(sum(i.value for i in installments), Decimal("450.00"))
        self.assertEqual(preview.new_value_per_installment, Decimal("150.00"))


class RecalculateInstallmentsTest(TestCase):
    def setUp(self):
        self.account = _make_account()
        self.payable = _make_payable("300.00")
        generate_payable_installments(self.payable, 3, None, self.account)
        self.payable.refresh_from_db()
        self.fixed_expense = FixedExpense.objects.get(
            related_payable=self.payable
        )

    def test_recalculate_keep_count_redistributes_evenly(self):
        # Simulate one installment already paid (100.00), remaining 200.00
        first = PayableInstallment.objects.filter(
            payable=self.payable
        ).order_by("installment_number")[0]
        first.payed = True
        first.save(update_fields=["payed"])

        preview = recalculate_installments(
            self.payable, mode="keep_count", dry_run=False
        )
        self.assertEqual(preview.new_installment_count, 3)
        open_installments = list(
            PayableInstallment.objects.filter(
                payable=self.payable, payed=False
            )
        )
        self.assertEqual(len(open_installments), 2)
        self.assertEqual(
            sum(i.value for i in open_installments),
            self.payable.value - self.payable.paid_value,
        )

    def test_recalculate_change_count_creates_new_open_installments(self):
        preview = recalculate_installments(
            self.payable,
            mode="change_count",
            new_installment_count=5,
            dry_run=False,
        )
        self.assertEqual(preview.new_installment_count, 5)
        open_installments = PayableInstallment.objects.filter(
            payable=self.payable, payed=False
        )
        self.assertEqual(open_installments.count(), 5)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.installments, 5)

    def test_recalculate_preserves_past_paid_installments(self):
        first = PayableInstallment.objects.filter(
            payable=self.payable
        ).order_by("installment_number")[0]
        first.payed = True
        first.save(update_fields=["payed"])
        original_value = first.value

        recalculate_installments(
            self.payable,
            mode="change_count",
            new_installment_count=4,
            dry_run=False,
        )
        first.refresh_from_db()
        self.assertEqual(first.value, original_value)
        self.assertTrue(first.payed)

    def test_recalculate_updates_future_fixed_expense_default_value(self):
        recalculate_installments(
            self.payable,
            mode="change_count",
            new_installment_count=2,
            dry_run=False,
        )
        self.fixed_expense.refresh_from_db()
        self.assertEqual(self.fixed_expense.default_value, Decimal("150.00"))

    def test_recalculate_updates_current_month_expense(self):
        today = timezone.now().date()
        current_expense = Expense.objects.create(
            description=self.fixed_expense.description,
            value=self.fixed_expense.default_value,
            date=today,
            category=self.fixed_expense.category,
            account=self.account,
            payed=False,
            fixed_expense_template=self.fixed_expense,
            related_payable=self.payable,
        )

        recalculate_installments(
            self.payable,
            mode="change_count",
            new_installment_count=2,
            dry_run=False,
        )
        current_expense.refresh_from_db()
        self.assertEqual(current_expense.value, Decimal("150.00"))

    def test_recalculate_does_not_touch_past_month_expense(self):
        past_date = date.today().replace(day=1) - timedelta(days=45)
        past_expense = Expense.objects.create(
            description=self.fixed_expense.description,
            value=Decimal("100.00"),
            date=past_date,
            category=self.fixed_expense.category,
            account=self.account,
            payed=True,
            fixed_expense_template=self.fixed_expense,
            related_payable=self.payable,
        )

        recalculate_installments(
            self.payable,
            mode="change_count",
            new_installment_count=2,
            dry_run=False,
        )
        past_expense.refresh_from_db()
        self.assertEqual(past_expense.value, Decimal("100.00"))

    def test_dry_run_makes_no_writes(self):
        before = list(
            PayableInstallment.objects.filter(
                payable=self.payable
            ).values_list("value", flat=True)
        )
        recalculate_installments(
            self.payable,
            mode="change_count",
            new_installment_count=5,
            dry_run=True,
        )
        after = list(
            PayableInstallment.objects.filter(
                payable=self.payable
            ).values_list("value", flat=True)
        )
        self.assertEqual(before, after)
        self.assertEqual(
            PayableInstallment.objects.filter(payable=self.payable).count(), 3
        )


class CreateExpenseAndRedistributeTest(TestCase):
    def setUp(self):
        self.account = _make_account()
        self.payable = _make_payable("300.00")
        generate_payable_installments(self.payable, 3, None, self.account)
        self.payable.refresh_from_db()

    def test_dry_run_creates_no_expense_and_no_writes(self):
        before_count = Expense.objects.count()
        expense, preview = create_expense_and_redistribute(
            self.payable,
            {
                "value": "100.00",
                "account": self.account.id,
                "date": str(date.today()),
            },
            mode="keep_count",
            dry_run=True,
        )
        self.assertIsNone(expense)
        self.assertEqual(Expense.objects.count(), before_count)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, Decimal("0.00"))
        self.assertEqual(preview.remaining_value, Decimal("200.00"))

    def test_commit_creates_expense_and_redistributes_atomically(self):
        expense, preview = create_expense_and_redistribute(
            self.payable,
            {
                "value": "100.00",
                "account": self.account.id,
                "date": str(date.today()),
            },
            mode="keep_count",
            user=None,
            dry_run=False,
        )
        self.assertIsNotNone(expense)
        self.assertEqual(expense.related_payable, self.payable)

        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, Decimal("100.00"))

        open_installments = PayableInstallment.objects.filter(
            payable=self.payable, payed=False
        )
        self.assertEqual(open_installments.count(), 2)
        self.assertEqual(
            sum(i.value for i in open_installments), Decimal("200.00")
        )
        # oldest installment was marked paid by the linked-expense signal
        self.assertEqual(
            PayableInstallment.objects.filter(
                payable=self.payable, payed=True
            ).count(),
            1,
        )
        self.assertEqual(preview.remaining_value, Decimal("200.00"))


class PaymentPlanEndpointTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="planuser",
            email="plan@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.account = _make_account()

    def test_payable_payment_plan_endpoint_creates_plan(self):
        payable = Payable.objects.create(
            description="Conserto",
            value=Decimal("600.00"),
            date=date.today(),
            category="others",
            status="active",
            created_by=self.user,
            updated_by=self.user,
        )
        response = self.client.post(
            f"/api/v1/payables/{payable.id}/payment-plan/",
            {"installments": 3, "account": self.account.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        payable.refresh_from_db()
        self.assertEqual(payable.installments, 3)
        self.assertEqual(
            PayableInstallment.objects.filter(payable=payable).count(), 3
        )

    def test_payable_payment_plan_endpoint_rejects_already_planned(self):
        payable = Payable.objects.create(
            description="Conserto",
            value=Decimal("600.00"),
            date=date.today(),
            category="others",
            status="active",
            installments=3,
            created_by=self.user,
            updated_by=self.user,
        )
        response = self.client.post(
            f"/api/v1/payables/{payable.id}/payment-plan/",
            {"installments": 2, "account": self.account.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_loan_payment_plan_endpoint_creates_plan(self):
        member = _make_member("Loan Plan Member", "p" * 64)
        from loans.models import Loan

        loan = Loan.objects.create(
            description="Empréstimo",
            value=Decimal("900.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=timezone.now().time(),
            category="loans",
            account=self.account,
            benefited=member,
            creditor=member,
            payed=False,
            status="active",
            installments=1,
            created_by=self.user,
            updated_by=self.user,
        )
        response = self.client.post(
            f"/api/v1/loans/{loan.id}/payment-plan/",
            {"installments": 3},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        loan.refresh_from_db()
        self.assertEqual(loan.installments, 3)

    def test_loan_payment_plan_endpoint_rejects_already_planned(self):
        member = _make_member("Loan Plan Member 2", "q" * 64)
        from loans.models import Loan

        loan = Loan.objects.create(
            description="Empréstimo parcelado",
            value=Decimal("900.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=timezone.now().time(),
            category="loans",
            account=self.account,
            benefited=member,
            creditor=member,
            payed=False,
            status="active",
            installments=3,
            created_by=self.user,
            updated_by=self.user,
        )
        response = self.client.post(
            f"/api/v1/loans/{loan.id}/payment-plan/",
            {"installments": 5},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
