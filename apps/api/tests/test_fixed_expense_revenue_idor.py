"""
Regression tests for the FixedExpense/FixedRevenue IDOR fixes.

Before the fix, FixedExpenseListCreateView/FixedExpenseDetailView,
BulkGenerateFixedExpensesView, BulkMarkPaidView, ExportExpensesView, and
their exact mirrors on the revenues side had no owner filter at all: any
authenticated user could read, update, soft-delete, bulk-generate from, or
export another user's finance data by guessing an id. Fixed by scoping
every queryset/lookup to `created_by=request.user`.
"""

from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from expenses.models import Expense, FixedExpense
from members.models import Member
from revenues.models import FixedRevenue, Revenue


class TwoUserTestCase(APITestCase):
    """User A owns the data under test; User B is an unrelated user."""

    def setUp(self):
        self.account = Account.objects.create(
            account_name="Shared Acc",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )

        self.user_a = User.objects.create_user(
            username="idor_user_a",
            email="idor_a@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client_a = APIClient()
        self.client_a.credentials(
            HTTP_AUTHORIZATION=(
                f"Bearer {RefreshToken.for_user(self.user_a).access_token}"
            )
        )
        Member.objects.create(
            name="IDOR User A",
            document_hash="a" * 64,
            phone="11900000010",
            sex="M",
            user=self.user_a,
        )

        self.user_b = User.objects.create_user(
            username="idor_user_b",
            email="idor_b@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client_b = APIClient()
        self.client_b.credentials(
            HTTP_AUTHORIZATION=(
                f"Bearer {RefreshToken.for_user(self.user_b).access_token}"
            )
        )
        Member.objects.create(
            name="IDOR User B",
            document_hash="b" * 64,
            phone="11900000011",
            sex="F",
            user=self.user_b,
        )


class FixedExpenseIdorTest(TwoUserTestCase):
    def setUp(self):
        super().setUp()
        self.fixed_expense = FixedExpense.objects.create(
            description="User A rent",
            default_value=Decimal("1000.00"),
            category="others",
            account=self.account,
            due_day=5,
            is_active=True,
            created_by=self.user_a,
        )
        self.expense = Expense.objects.create(
            description="User A groceries",
            value=Decimal("250.00"),
            date=date.today(),
            horary=time(10, 0),
            category="others",
            account=self.account,
            payed=False,
            created_by=self.user_a,
        )

    def test_user_b_cannot_list_user_as_fixed_expense(self):
        url = reverse("fixed-expense-list-create")
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["results"]]
        self.assertNotIn(self.fixed_expense.id, ids)

    def test_user_b_cannot_retrieve_user_as_fixed_expense(self):
        url = reverse("fixed-expense-detail", args=[self.fixed_expense.id])
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_delete_user_as_fixed_expense(self):
        url = reverse("fixed-expense-detail", args=[self.fixed_expense.id])
        response = self.client_b.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.fixed_expense.refresh_from_db()
        self.assertFalse(self.fixed_expense.is_deleted)

    def test_user_b_cannot_bulk_generate_from_user_as_template(self):
        url = reverse("fixed-expense-generate")
        response = self.client_b.post(
            url,
            {
                "month": "2026-09",
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_expense.id,
                        "value": "1000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(
            Expense.objects.filter(
                fixed_expense_template=self.fixed_expense
            ).exists()
        )

    def test_user_b_cannot_bulk_mark_user_as_expense_paid(self):
        url = reverse("expense-bulk-mark-paid")
        response = self.client_b.post(
            url, {"expense_ids": [self.expense.id]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.expense.refresh_from_db()
        self.assertFalse(self.expense.payed)

    def test_user_b_export_does_not_include_user_as_expense(self):
        url = reverse("expense-export")
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = b"".join(response.streaming_content)
        self.assertNotIn(b"User A groceries", content)


class FixedRevenueIdorTest(TwoUserTestCase):
    def setUp(self):
        super().setUp()
        self.fixed_revenue = FixedRevenue.objects.create(
            description="User A salary",
            default_value=Decimal("5000.00"),
            category="deposit",
            account=self.account,
            due_day=5,
            is_active=True,
            created_by=self.user_a,
        )
        self.revenue = Revenue.objects.create(
            description="User A bonus",
            value=Decimal("300.00"),
            date=date.today(),
            horary=time(10, 0),
            category="salary",
            account=self.account,
            received=False,
            created_by=self.user_a,
        )

    def test_user_b_cannot_list_user_as_fixed_revenue(self):
        url = reverse("fixed-revenue-list-create")
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["results"]]
        self.assertNotIn(self.fixed_revenue.id, ids)

    def test_user_b_cannot_retrieve_user_as_fixed_revenue(self):
        url = reverse("fixed-revenue-detail", args=[self.fixed_revenue.id])
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_delete_user_as_fixed_revenue(self):
        url = reverse("fixed-revenue-detail", args=[self.fixed_revenue.id])
        response = self.client_b.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.fixed_revenue.refresh_from_db()
        self.assertFalse(self.fixed_revenue.is_deleted)

    def test_user_b_cannot_bulk_generate_from_user_as_template(self):
        url = reverse("fixed-revenue-generate")
        response = self.client_b.post(
            url,
            {
                "month": "2026-09",
                "revenue_values": [
                    {
                        "fixed_revenue_id": self.fixed_revenue.id,
                        "value": "5000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(
            Revenue.objects.filter(
                fixed_revenue_template=self.fixed_revenue
            ).exists()
        )

    def test_user_b_export_does_not_include_user_as_revenue(self):
        url = reverse("revenue-export")
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = b"".join(response.streaming_content)
        self.assertNotIn(b"User A bonus", content)
