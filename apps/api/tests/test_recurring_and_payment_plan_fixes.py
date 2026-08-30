"""
Testes das correções de:
- lançamento de despesas/receitas fixas (data por item + "meses já lançados")
- plano de pagamento de dívidas (1ª parcela sempre no futuro + recálculo
  de parcelas de empréstimo, paridade com contas a pagar)
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from app.debt_installment_utils import (
    build_equal_installment_schedule,
    default_first_due_date,
)
from expenses.models import Expense, FixedExpense
from loans.models import Loan, LoanInstallment
from loans.services import recalculate_loan_installments
from payables.models import Payable, PayableInstallment
from payables.signals import generate_payable_installments
from revenues.models import FixedRevenue, Revenue
from revenues.services import (
    bulk_generate_fixed_revenues,
    get_fully_generated_months,
)


def _account(name="FixAcc"):
    return Account.objects.create(
        account_name=name,
        institution_name="NUB",
        account_type="CC",
        is_active=True,
    )


def _member(name="M", document_hash="z" * 64):
    from members.models import Member

    return Member.objects.create(
        name=name, document_hash=document_hash, phone="11999999999", sex="M"
    )


class DebtInstallmentScheduleHelperTest(TestCase):
    def test_first_due_date_anchors_installment_one(self):
        anchor = date(2026, 3, 10)
        schedule = build_equal_installment_schedule(
            Decimal("300.00"),
            3,
            date(2025, 1, 1),
            "monthly",
            first_due_date=anchor,
        )
        self.assertEqual(schedule[0]["due_date"], anchor)
        self.assertEqual(schedule[1]["due_date"], date(2026, 4, 10))
        self.assertEqual(schedule[2]["due_date"], date(2026, 5, 10))

    def test_without_first_due_date_keeps_legacy_behaviour(self):
        start = date(2026, 1, 31)
        schedule = build_equal_installment_schedule(
            Decimal("300.00"), 2, start, "monthly"
        )
        # parcela 1 vence uma cadência DEPOIS de start (comportamento antigo)
        self.assertEqual(schedule[0]["due_date"], date(2026, 2, 28))

    def test_default_first_due_date_is_never_in_the_past(self):
        today = date(2026, 8, 29)
        # dia 5 já passou neste mês -> próximo mês
        self.assertEqual(
            default_first_due_date(5, "monthly", today=today),
            date(2026, 9, 5),
        )
        # dia 29 é hoje -> hoje
        self.assertEqual(
            default_first_due_date(29, "monthly", today=today),
            date(2026, 8, 29),
        )


class PayablePaymentPlanFutureDatesTest(TestCase):
    def setUp(self):
        self.account = _account()

    def test_installments_never_land_in_the_past(self):
        old = timezone.now().date() - timedelta(days=65)
        payable = Payable.objects.create(
            description="Livro comprado em junho",
            value=Decimal("300.00"),
            date=old,
            category="others",
            status="active",
        )
        generate_payable_installments(payable, 3, None, self.account)

        installments = PayableInstallment.objects.filter(payable=payable)
        self.assertEqual(installments.count(), 3)
        today = timezone.now().date()
        for inst in installments:
            self.assertGreaterEqual(inst.due_date, today)

    def test_explicit_first_due_date_is_respected(self):
        payable = Payable.objects.create(
            description="Dívida",
            value=Decimal("300.00"),
            date=timezone.now().date() - timedelta(days=200),
            category="others",
            status="active",
        )
        anchor = timezone.now().date() + timedelta(days=40)
        generate_payable_installments(
            payable, 3, None, self.account, first_due_date=anchor
        )
        first = PayableInstallment.objects.get(
            payable=payable, installment_number=1
        )
        self.assertEqual(first.due_date, anchor)

    def test_paid_installment_cannot_be_edited_via_patch(self):
        user = User.objects.create_user(
            username="patchuser",
            email="p@t.com",
            password="x",
            is_superuser=True,
        )
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION=(
                f"Bearer {RefreshToken.for_user(user).access_token}"
            )
        )
        payable = Payable.objects.create(
            description="D",
            value=Decimal("300.00"),
            date=timezone.now().date(),
            category="others",
            status="active",
            created_by=user,
            updated_by=user,
        )
        generate_payable_installments(payable, 3, user, self.account)
        inst = PayableInstallment.objects.get(
            payable=payable, installment_number=1
        )
        inst.payed = True
        inst.save(update_fields=["payed"])

        resp = client.patch(
            f"/api/v1/payables/{payable.id}/installments/",
            {"installment_number": 1, "value": "999.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class LoanRecalculateInstallmentsTest(TestCase):
    def setUp(self):
        self.account = _account("LoanAcc")
        self.member = _member("LoanRecalc", "l" * 64)
        self.user = User.objects.create_user(
            username="loanrecalc",
            email="l@r.com",
            password="x",
            is_superuser=True,
        )
        self.client = APIClient()
        self.client.credentials(
            HTTP_AUTHORIZATION=(
                f"Bearer {RefreshToken.for_user(self.user).access_token}"
            )
        )

    def _loan(self, installments=3):
        return Loan.objects.create(
            description="Empréstimo",
            value=Decimal("900.00"),
            payed_value=Decimal("0.00"),
            date=timezone.now().date(),
            horary=timezone.now().time(),
            category="loans",
            account=self.account,
            benefited=self.member,
            creditor=self.member,
            payed=False,
            status="active",
            installments=installments,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_loan_payment_plan_first_installment_in_future(self):
        loan = self._loan(installments=1)
        loan.date = timezone.now().date() - timedelta(days=90)
        loan.save(update_fields=["date"])

        resp = self.client.post(
            f"/api/v1/loans/{loan.id}/payment-plan/",
            {"installments": 3},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        today = timezone.now().date()
        for inst in LoanInstallment.objects.filter(loan=loan):
            self.assertGreaterEqual(inst.due_date, today)

    def test_recalculate_change_count_service(self):
        # Loan(installments=3) já nasce com 3 LoanInstallment (loans.signals).
        loan = self._loan(installments=3)
        self.assertEqual(LoanInstallment.objects.filter(loan=loan).count(), 3)
        preview = recalculate_loan_installments(
            loan,
            "change_count",
            new_installment_count=5,
            user=self.user,
            dry_run=False,
        )
        self.assertEqual(preview["new_installment_count"], 5)
        self.assertEqual(
            LoanInstallment.objects.filter(loan=loan, payed=False).count(), 5
        )
        loan.refresh_from_db()
        self.assertEqual(loan.installments, 5)

    def test_recalculate_endpoint(self):
        loan = self._loan(installments=3)
        resp = self.client.post(
            f"/api/v1/loans/{loan.id}/recalculate-installments/",
            {
                "mode": "change_count",
                "new_installment_count": 6,
                "dry_run": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(len(resp.data["preview"]["installments_preview"]), 6)
        # dry-run: nada gravado
        self.assertEqual(LoanInstallment.objects.filter(loan=loan).count(), 3)


class BulkGenerateDateOverrideTest(TestCase):
    def setUp(self):
        self.account = _account("BulkAcc")

    def _fixed_expense(self, due_day=10):
        return FixedExpense.objects.create(
            description="Aluguel",
            default_value=Decimal("1000.00"),
            category="house",
            account=self.account,
            due_day=due_day,
            is_active=True,
            allow_value_edit=True,
        )

    def _fixed_revenue(self, due_day=5):
        return FixedRevenue.objects.create(
            description="Salário",
            default_value=Decimal("5000.00"),
            category="salary",
            account=self.account,
            due_day=due_day,
            is_active=True,
            allow_value_edit=True,
        )

    def test_expense_date_override_within_month(self):
        from expenses.services import bulk_generate_fixed_expenses

        fe = self._fixed_expense(due_day=10)
        bulk_generate_fixed_expenses(
            "2026-05",
            [
                {
                    "fixed_expense_id": fe.id,
                    "value": Decimal("1000.00"),
                    "date": date(2026, 5, 22),
                }
            ],
            None,
        )
        expense = Expense.objects.get(fixed_expense_template=fe)
        self.assertEqual(expense.date, date(2026, 5, 22))

    def test_expense_date_override_outside_month_falls_back_to_due_day(self):
        from expenses.services import bulk_generate_fixed_expenses

        fe = self._fixed_expense(due_day=10)
        bulk_generate_fixed_expenses(
            "2026-05",
            [
                {
                    "fixed_expense_id": fe.id,
                    "value": Decimal("1000.00"),
                    "date": date(2026, 7, 1),
                }
            ],
            None,
        )
        expense = Expense.objects.get(fixed_expense_template=fe)
        self.assertEqual(expense.date, date(2026, 5, 10))

    def test_revenue_date_override_within_month(self):
        fr = self._fixed_revenue(due_day=5)
        bulk_generate_fixed_revenues(
            "2026-05",
            [
                {
                    "fixed_revenue_id": fr.id,
                    "value": Decimal("5000.00"),
                    "date": date(2026, 5, 28),
                }
            ],
            None,
        )
        revenue = Revenue.objects.get(fixed_revenue_template=fr)
        self.assertEqual(revenue.date, date(2026, 5, 28))

    def test_fully_generated_months_reports_current_month(self):
        fr = self._fixed_revenue(due_day=5)
        current = timezone.now().strftime("%Y-%m")
        bulk_generate_fixed_revenues(
            current,
            [{"fixed_revenue_id": fr.id, "value": Decimal("5000.00")}],
            None,
        )
        self.assertIn(current, get_fully_generated_months())

    def test_fully_generated_months_excludes_partially_generated(self):
        self._fixed_revenue(due_day=5)  # gerada abaixo
        fr2 = self._fixed_revenue(due_day=15)
        current = timezone.now().strftime("%Y-%m")
        # gera só um dos dois templates ativos
        bulk_generate_fixed_revenues(
            current,
            [{"fixed_revenue_id": fr2.id, "value": Decimal("5000.00")}],
            None,
        )
        self.assertNotIn(current, get_fully_generated_months())
