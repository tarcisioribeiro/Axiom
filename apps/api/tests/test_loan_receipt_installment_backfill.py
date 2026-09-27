"""Tests for loans migration 0012 (receipt installment backfill)."""

from datetime import date
from decimal import Decimal
from importlib import import_module

from django.apps import apps
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from accounts.models import Account
from loans.models import Loan, LoanInstallment
from members.models import Member

backfill = import_module(
    "loans.migrations.0012_backfill_lent_loan_receipt_installment"
).create_receipt_installment


class LentLoanReceiptInstallmentBackfillTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("lender", password="x")
        self.account = Account.objects.create(
            account_name="Acc", institution_name="NUB", account_type="CC"
        )
        self.member = Member.objects.create(
            name="M", document_hash="z" * 64, phone="11999999999", sex="M"
        )

    def _loan(self, loan_type="lent", payed_value="500.00"):
        return Loan.objects.create(
            description="Emp",
            value=Decimal("500.00"),
            payed_value=Decimal(payed_value),
            date=date.today(),
            horary=timezone.now().time(),
            category="loans",
            account=self.account,
            benefited=self.member,
            creditor=self.member,
            installments=1,
            loan_type=loan_type,
            created_by=self.user,
        )

    def test_creates_single_received_installment_only_for_paid_lent_loans(
        self,
    ):
        paid_lent = self._loan()
        self._loan(payed_value="100.00")  # lent, not fully received
        self._loan(loan_type="borrowed")  # borrowed, paid

        backfill(apps, None)
        backfill(apps, None)  # idempotent

        installments = LoanInstallment.objects.all()
        self.assertEqual(installments.count(), 1)
        inst = installments.get()
        self.assertEqual(inst.loan_id, paid_lent.id)
        self.assertEqual(inst.installment_number, 1)
        self.assertEqual(inst.value, Decimal("500.00"))
        self.assertTrue(inst.payed)
        self.assertEqual(
            inst.due_date, timezone.localtime(paid_lent.created_at).date()
        )
