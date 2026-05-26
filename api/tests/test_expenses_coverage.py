"""
Tests for expenses/services.py: bulk_generate_fixed_expenses and
get_or_create_bill. Drives coverage of the service layer business logic.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from expenses.models import FixedExpense
from members.models import Member


class BaseExpenseServiceTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="expsvc",
            email="expsvc@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Expense Svc User",
            document_hash="e" * 64,
            phone="11988880001",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Expense Svc Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("50000.00"),
        )


# ---------------------------------------------------------------------------
# bulk_generate_fixed_expenses via API — account-linked fixed expense path
# ---------------------------------------------------------------------------


class BulkGenerateFixedExpensesAccountTest(BaseExpenseServiceTestCase):
    """Exercises expenses/services.py bulk_generate_fixed_expenses
    (account path)."""

    def setUp(self):
        super().setUp()
        self.fixed_expense = FixedExpense.objects.create(
            description="Monthly Rent",
            default_value=Decimal("1500.00"),
            category="bills and services",
            account=self.account,
            due_day=15,
            is_active=True,
            created_by=self.user,
        )

    def test_bulk_generate_creates_expense(self):
        """Covers bulk_generate_fixed_expenses account-path (lines 149-180)."""
        today = timezone.now()
        month_str = today.strftime("%Y-%m")
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url,
            {
                "month": month_str,
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_expense.pk,
                        "value": "1500.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("created_count", response.data)  # type: ignore
        self.assertEqual(response.data["month"], month_str)  # type: ignore

    def test_bulk_generate_idempotent(self):
        """Second generate for same month is a no-op (already-exists
        branch)."""
        today = timezone.now()
        month_str = today.strftime("%Y-%m")
        url = reverse("fixed-expense-generate")
        payload = {
            "month": month_str,
            "expense_values": [
                {"fixed_expense_id": self.fixed_expense.pk, "value": "1500.00"}
            ],
        }
        self.client.post(url, payload, format="json")
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Second run creates 0 new expenses
        self.assertEqual(response.data["created_count"], 0)  # type: ignore

    def test_bulk_generate_invalid_fixed_expense_id(self):
        """Covers FixedExpense.DoesNotExist branch → 404."""
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url,
            {
                "month": timezone.now().strftime("%Y-%m"),
                "expense_values": [
                    {"fixed_expense_id": 99999, "value": "100.00"}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# bulk_generate_fixed_expenses — credit-card path (get_or_create_bill)
# ---------------------------------------------------------------------------


class BulkGenerateFixedExpensesCreditCardTest(BaseExpenseServiceTestCase):
    """
    Exercises get_or_create_bill (lines 15-73) and the credit-card branch
    of bulk_generate_fixed_expenses (lines 111-148).
    """

    def setUp(self):
        super().setUp()
        from datetime import date, timedelta

        # Create credit card via API to trigger full_clean correctly
        cc_resp = self.client.post(
            reverse("credit_card-create-list"),
            {
                "name": "Test CC",
                "on_card_name": "TEST USER",
                "flag": "MSC",
                "validation_date": (
                    date.today() + timedelta(days=365)
                ).isoformat(),
                "security_code": "123",
                "credit_limit": "10000.00",
                "max_limit": "15000.00",
                "associated_account": self.account.pk,
                "closing_day": 20,
                "due_day": 5,
                "owner": self.member.pk,
            },
        )
        self.assertEqual(cc_resp.status_code, status.HTTP_201_CREATED)
        from credit_cards.models import CreditCard

        self.credit_card = CreditCard.objects.get(pk=cc_resp.data["id"])
        self.fixed_expense_cc = FixedExpense.objects.create(
            description="Streaming Service",
            default_value=Decimal("50.00"),
            category="entertainment",
            credit_card=self.credit_card,
            due_day=5,
            is_active=True,
            created_by=self.user,
        )

    def test_bulk_generate_credit_card_path(self):
        """Covers get_or_create_bill + CreditCardInstallment creation."""
        today = timezone.now()
        month_str = today.strftime("%Y-%m")
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url,
            {
                "month": month_str,
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_expense_cc.pk,
                        "value": "50.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_bulk_generate_credit_card_idempotent(self):
        """get_or_create_bill returns existing bill on second call."""
        today = timezone.now()
        month_str = today.strftime("%Y-%m")
        url = reverse("fixed-expense-generate")
        payload = {
            "month": month_str,
            "expense_values": [
                {
                    "fixed_expense_id": self.fixed_expense_cc.pk,
                    "value": "50.00",
                }
            ],
        }
        self.client.post(url, payload, format="json")
        # Second call: bill already exists, installment already exists → skip
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Fixed expense stats endpoint
# ---------------------------------------------------------------------------


class FixedExpenseStatsTest(BaseExpenseServiceTestCase):
    def test_fixed_expense_stats_endpoint(self):
        url = reverse("fixed-expense-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("active_templates", response.data)  # type: ignore
        self.assertIn("current_month", response.data)  # type: ignore
        self.assertIn("previous_month", response.data)  # type: ignore
