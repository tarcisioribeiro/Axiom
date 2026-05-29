"""
Tests for budget enforcement at expense creation/update time.

Covers:
- No budget configured → expense created without restriction (pass)
- Soft mode, expense would exceed budget → 201 + budget_warning in response
- Hard mode, expense would exceed budget → 400 Bad Request
- Update within limit → 200, no budget_warning
- Update that exceeds limit (soft) → 200 + budget_warning
- Unpaid expense skips budget check entirely
"""

from datetime import date
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from budgets.models import Budget
from expenses.models import Expense


class BaseBudgetEnforcementTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="enftest",
            email="enf@test.com",
            password="testpass123",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {
                refresh.access_token}"
        )
        self.account = Account.objects.create(
            account_name="Test Account",
            institution_name="Bank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("50000.00"),
        )
        self.today = date.today()
        self.expense_url = reverse("expense-create-list")

    def _expense_payload(
        self, value="100.00", payed=True, category="food and drink"
    ):
        return {
            "description": "Test expense",
            "value": value,
            "date": self.today.isoformat(),
            "horary": "12:00:00",
            "category": category,
            "account": self.account.pk,
            "payed": payed,
        }


# ---------------------------------------------------------------------------
# No budget configured → pass through silently
# ---------------------------------------------------------------------------


class NoBudgetTest(BaseBudgetEnforcementTest):
    def test_expense_created_without_budget(self):
        """When no budget exists for the category, expense is created
        normally."""
        response = self.client.post(
            self.expense_url, self._expense_payload(value="9999.00")
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("budget_warning", response.data)


# ---------------------------------------------------------------------------
# Soft mode (default) — 201 + budget_warning when limit exceeded
# ---------------------------------------------------------------------------


class SoftModeTest(BaseBudgetEnforcementTest):
    def setUp(self):
        super().setUp()
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("200.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )

    def test_soft_overage_returns_201_with_warning(self):
        """Soft mode: expense that exceeds budget returns 201 with
        budget_warning."""
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "soft"
        ):
            # First expense: R$150 (within limit)
            Expense.objects.create(
                description="Prior expense",
                value=Decimal("150.00"),
                date=self.today,
                horary="08:00:00",
                category="food and drink",
                account=self.account,
                payed=True,
                created_by=self.user,
            )
            # Second expense: R$100 → projects total to R$250, exceeding
            # R$200 limit
            response = self.client.post(
                self.expense_url, self._expense_payload(value="100.00")
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("budget_warning", response.data)
        warning = response.data["budget_warning"]
        self.assertEqual(warning["category"], "food and drink")
        self.assertIn("overage", warning)
        self.assertIn("limit_amount", warning)

    def test_soft_within_limit_no_warning(self):
        """Soft mode: expense within budget limit returns 201 without
        budget_warning."""
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "soft"
        ):
            response = self.client.post(
                self.expense_url, self._expense_payload(value="50.00")
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("budget_warning", response.data)

    def test_unpaid_expense_skips_budget_check(self):
        """Unpaid expenses do not trigger budget enforcement."""
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "soft"
        ):
            response = self.client.post(
                self.expense_url,
                self._expense_payload(value="9999.00", payed=False),
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("budget_warning", response.data)


# ---------------------------------------------------------------------------
# Hard mode — 400 when limit would be exceeded
# ---------------------------------------------------------------------------


class HardModeTest(BaseBudgetEnforcementTest):
    def setUp(self):
        super().setUp()
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("200.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )

    def test_hard_overage_returns_400(self):
        """Hard mode: expense that would exceed budget is rejected with 400."""
        with mock.patch("budgets.services.cfg", return_value="hard"):
            Expense.objects.create(
                description="Prior expense",
                value=Decimal("150.00"),
                date=self.today,
                horary="08:00:00",
                category="food and drink",
                account=self.account,
                payed=True,
                created_by=self.user,
            )
            response = self.client.post(
                self.expense_url, self._expense_payload(value="100.00")
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("budget", response.data)

    def test_hard_within_limit_returns_201(self):
        """Hard mode: expense within limit is allowed normally."""
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "hard"
        ):
            response = self.client.post(
                self.expense_url, self._expense_payload(value="50.00")
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_hard_unpaid_skips_check(self):
        """Hard mode: unpaid expense is never blocked."""
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "hard"
        ):
            response = self.client.post(
                self.expense_url,
                self._expense_payload(value="9999.00", payed=False),
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Update scenarios
# ---------------------------------------------------------------------------


class UpdateEnforcementTest(BaseBudgetEnforcementTest):
    def setUp(self):
        super().setUp()
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("200.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )
        self.expense = Expense.objects.create(
            description="Existing expense",
            value=Decimal("100.00"),
            date=self.today,
            horary="10:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        self.detail_url = reverse(
            "expense-detail-view", args=[self.expense.pk]
        )

    def test_update_within_limit_no_warning(self):
        """PATCH that keeps total within limit returns 200 without
        budget_warning."""
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "soft"
        ):
            response = self.client.patch(self.detail_url, {"value": "150.00"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("budget_warning", response.data)

    def test_update_exceeds_limit_soft_warning(self):
        """PATCH (soft) that pushes total over limit returns 200 +"""
        """budget_warning."""
        # Add another expense so we're already at R$180, excluding the one
        # being updated
        Expense.objects.create(
            description="Other expense",
            value=Decimal("180.00"),
            date=self.today,
            horary="11:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        with mock.patch(
            "django.conf.settings.BUDGET_ENFORCEMENT_MODE", "soft"
        ):
            # R$50 update — other R$180 + R$50 = R$230 > R$200 limit
            response = self.client.patch(self.detail_url, {"value": "50.00"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("budget_warning", response.data)

    def test_update_exceeds_limit_hard_block(self):
        """PATCH (hard) that pushes total over limit returns 400."""
        Expense.objects.create(
            description="Other expense",
            value=Decimal("180.00"),
            date=self.today,
            horary="11:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        with mock.patch("budgets.services.cfg", return_value="hard"):
            response = self.client.patch(self.detail_url, {"value": "50.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Off mode — enforcement disabled entirely
# ---------------------------------------------------------------------------


class OffModeTest(BaseBudgetEnforcementTest):
    def setUp(self):
        super().setUp()
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("10.00"),  # Very low limit
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )

    def test_off_mode_ignores_budget(self):
        """Off mode: expense that far exceeds budget is created without any
        warning."""
        with mock.patch("budgets.services.cfg", return_value="off"):
            response = self.client.post(
                self.expense_url, self._expense_payload(value="9999.00")
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("budget_warning", response.data)
