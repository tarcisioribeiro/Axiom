"""
Spending analytics (monthly statement + spending insights) count the card
installments of the month's bill in the purchase's real category and ignore
bill payment expenses, which would otherwise double-count the purchases as
"bills and services".
"""

from datetime import time
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone

from credit_cards.models import MONTHS as BILL_MONTHS
from credit_cards.models import CreditCardInstallment, CreditCardPurchase
from expenses.models import Expense
from tests.test_dashboard_coverage import _DashboardCoverageBaseTestCase


class SpendingByCategoryTest(_DashboardCoverageBaseTestCase):
    def setUp(self):
        super().setUp()
        self.today = timezone.now().date()
        card = self._make_credit_card()
        bill = self._make_bill(
            card,
            year=str(self.today.year),
            month=BILL_MONTHS[self.today.month - 1][0],
        )
        for value, category, extra in (
            ("50.00", "food and drink", {}),
            ("999.00", "bills and services", {"related_bill_payment": bill}),
        ):
            Expense.objects.create(
                description="x",
                value=Decimal(value),
                date=self.today,
                horary="12:00:00",
                category=category,
                account=self.account,
                payed=True,
                created_by=self.user,
                **extra,
            )
        purchase = CreditCardPurchase.objects.create(
            description="Market",
            total_value=Decimal("1000.00"),
            purchase_date=self.today,
            purchase_time=time(12, 0),
            category="food and drink",
            card=card,
            total_installments=10,
            created_by=self.user,
        )
        # Only the installment on this month's bill counts, not total_value
        CreditCardInstallment.objects.create(
            purchase=purchase,
            installment_number=1,
            value=Decimal("100.00"),
            due_date=self.today,
            bill=bill,
            payed=False,
            created_by=self.user,
        )

    def test_monthly_statement(self):
        response = self.client.get(
            reverse("monthly-statement"),
            {"year": self.today.year, "month": self.today.month},
        )
        self.assertEqual(response.data["total_expenses"], "150.00")
        self.assertEqual(
            response.data["expenses_by_category"],
            [{"category": "food and drink", "total": "150.00", "count": 2}],
        )

    def test_spending_insights(self):
        response = self.client.get(reverse("spending-insights"))
        self.assertEqual(
            response.data["top_categories"],
            [{"category": "food and drink", "total": 150.0}],
        )

    def test_spending_insights_month_param(self):
        first = self.today.replace(day=1)
        response = self.client.get(
            reverse("spending-insights"),
            {"year": first.year + 1, "month": first.month},
        )
        self.assertEqual(response.data["period"]["year"], first.year + 1)
        self.assertEqual(response.data["top_categories"], [])
        # 12 months back is outside the 6-month window
        self.assertEqual(response.data["trend"]["prior_avg"], 0)
