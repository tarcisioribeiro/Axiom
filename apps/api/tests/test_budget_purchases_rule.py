"""
BudgetStatusView counts the same items the budget "Compras" modal lists
(account expenses of the month, bill payments excluded + card installments
of the month's bill), scoped to the requesting user. Installment endpoints
are scoped to the user as well.
"""

from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse

from budgets.models import Budget
from credit_cards.models import CreditCardInstallment, CreditCardPurchase
from expenses.models import Expense
from tests.test_dashboard_coverage import _DashboardCoverageBaseTestCase


class BudgetPurchasesRuleTest(_DashboardCoverageBaseTestCase):
    def setUp(self):
        super().setUp()
        self.other = User.objects.create_user(
            username=self._unique("other"), password="x"
        )
        self.card = self._make_credit_card()
        self.bill = self._make_bill(self.card, year="2026", month="Jan")
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("1000.00"),
            month=1,
            year=2026,
            created_by=self.user,
        )
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("1.00"),
            month=1,
            year=2026,
            created_by=self.other,
        )
        self._expense(Decimal("50.00"), self.user)  # pending, still counted
        self._expense(
            Decimal("999.00"), self.user, related_bill_payment=self.bill
        )
        self._expense(Decimal("777.00"), self.other)
        self.mine = self._installment(Decimal("100.00"), self.user)
        self.theirs = self._installment(Decimal("333.00"), self.other)

    def _expense(self, value, user, **extra):
        Expense.objects.create(
            description="Food",
            value=value,
            date=date(2026, 1, 10),
            horary="12:00:00",
            category="food and drink",
            account=self.account,
            payed=False,
            created_by=user,
            **extra,
        )

    def _installment(self, value, user):
        purchase = CreditCardPurchase.objects.create(
            description="Market",
            total_value=value,
            purchase_date=date(2026, 1, 5),
            purchase_time=time(12, 0),
            category="food and drink",
            card=self.card,
            total_installments=1,
            created_by=user,
        )
        return CreditCardInstallment.objects.create(
            purchase=purchase,
            installment_number=1,
            value=value,
            due_date=date(2026, 1, 15),
            bill=self.bill,
            payed=False,
            created_by=user,
        )

    def test_status_matches_modal_rule_for_user_only(self):
        response = self.client.get(
            reverse("budget-status"), {"month": 1, "year": 2026}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            Decimal(str(response.data[0]["actual_spent"])), Decimal("150.00")
        )

    def test_installment_list_only_returns_own(self):
        response = self.client.get(
            reverse("credit_card-installment-list"),
            {"bill__month": "Jan", "bill__year": "2026"},
        )
        ids = [i["id"] for i in response.data["results"]]
        self.assertEqual(ids, [self.mine.id])

    def test_cannot_update_other_users_installment(self):
        response = self.client.patch(
            reverse("credit-card-installment-update", args=[self.theirs.id]),
            {"payed": True},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
