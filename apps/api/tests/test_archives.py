"""
Tests for security archives CRUD, vault yield/goal operations,
dashboard stats, and expense service endpoints.
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member


class BaseCoverageTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="covboost",
            email="cov@boost.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Cov User",
            document_hash="c" * 64,
            phone="11999999939",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Coverage Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("100000.00"),
        )


# ---------------------------------------------------------------------------
# Security — Archives
# ---------------------------------------------------------------------------


class ArchiveViewTest(BaseCoverageTestCase):
    def test_list_archives(self):
        url = reverse("archive-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data["results"], list)
        self.assertIsInstance(response.data["count"], int)

    def test_create_archive_text(self):
        url = reverse("archive-list-create")
        response = self.client.post(
            url,
            {
                "title": "My Notes",
                "category": "personal",
                "archive_type": "text",
                "text_content": "This is a note.",
                "owner": self.member.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "My Notes")
        self.assertEqual(response.data["category"], "personal")

    def test_retrieve_archive(self):
        from security.models import Archive

        archive = Archive.objects.create(
            title="Test Archive",
            category="personal",
            archive_type="text",
            owner=self.member,
            created_by=self.user,
        )
        url = reverse("archive-detail", args=[archive.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Test Archive")
        self.assertEqual(response.data["category"], "personal")

    def test_update_archive(self):
        from security.models import Archive

        archive = Archive.objects.create(
            title="Old Title",
            category="personal",
            archive_type="text",
            owner=self.member,
            created_by=self.user,
        )
        url = reverse("archive-detail", args=[archive.pk])
        response = self.client.patch(url, {"title": "New Title"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "New Title")

    def test_delete_archive(self):
        from security.models import Archive

        archive = Archive.objects.create(
            title="To Delete",
            category="personal",
            archive_type="text",
            owner=self.member,
            created_by=self.user,
        )
        url = reverse("archive-detail", args=[archive.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Vault Yield & Contribution Operations
# ---------------------------------------------------------------------------


class VaultYieldOperationsViewTest(BaseCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.vault_pk = self._create_vault()

    def _create_vault(self):
        url = reverse("vault-list-create")
        resp = self.client.post(
            url,
            {
                "description": "Yield Test Vault",
                "account": self.account.pk,
                "yield_rate": "0.009",
                "annual_yield_rate": "0.1100",
                "is_active": True,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.data["id"]  # type: ignore

    def test_vault_apply_yield(self):
        # No contributions yet — may succeed (no-op) or return 400 if
        # validation requires prior contributions; both are legitimate
        # outcomes.
        url = reverse("vault-apply-yield", args=[self.vault_pk])
        response = self.client.post(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_vault_update_yield(self):
        url = reverse("vault-update-yield", args=[self.vault_pk])
        response = self.client.post(
            url, {"yield_rate": "0.010", "annual_yield_rate": "0.1200"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vault_contribution_history(self):
        url = reverse("vault-contribution-history", args=[self.vault_pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data["results"], list)

    def test_vault_generate_contributions(self):
        url = reverse("vault-generate-contributions")
        response = self.client.post(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_financial_goal_check_completion(self):
        from vaults.models import FinancialGoal

        goal = FinancialGoal.objects.create(
            description="Check Goal",
            category="savings",
            target_value=Decimal("1000.00"),
            target_date=date(2030, 12, 31),
            created_by=self.user,
        )
        url = reverse("financial-goal-check-completion", args=[goal.pk])
        response = self.client.post(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_financial_goal_update(self):
        from vaults.models import FinancialGoal

        goal = FinancialGoal.objects.create(
            description="Update Goal",
            category="savings",
            target_value=Decimal("5000.00"),
            target_date=date(2030, 12, 31),
            created_by=self.user,
        )
        url = reverse("financial-goal-detail", args=[goal.pk])
        response = self.client.patch(url, {"description": "Updated Goal"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["description"], "Updated Goal")

    def test_financial_goal_delete(self):
        from vaults.models import FinancialGoal

        goal = FinancialGoal.objects.create(
            description="Delete Goal",
            category="savings",
            target_value=Decimal("2000.00"),
            target_date=date(2030, 12, 31),
            created_by=self.user,
        )
        url = reverse("financial-goal-detail", args=[goal.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Dashboard additional stats
# ---------------------------------------------------------------------------


class DashboardStatsViewTest(BaseCoverageTestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import Expense
        from revenues.models import Revenue

        Revenue.objects.create(
            description="Test Revenue",
            value=Decimal("5000.00"),
            date=date.today(),
            horary="09:00:00",
            category="salary",
            account=self.account,
            received=True,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Test Expense",
            value=Decimal("200.00"),
            date=date.today(),
            horary="12:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def test_dashboard_stats_with_data(self):
        url = reverse("dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in (
            "total_revenues",
            "total_expenses",
            "total_balance",
            "accounts_count",
        ):
            self.assertIn(key, response.data)
        self.assertGreater(response.data["total_revenues"], 0)

    def test_balance_forecast_with_data(self):
        url = reverse("balance-forecast")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in (
            "forecast_balance",
            "pending_expenses",
            "pending_revenues",
        ):
            self.assertIn(key, response.data)


# ---------------------------------------------------------------------------
# Expense services/views additional coverage
# ---------------------------------------------------------------------------


class ExpenseServiceViewTest(BaseCoverageTestCase):
    def test_expense_export(self):
        url = reverse("expense-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_expense_export_pdf(self):
        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", response.get("Content-Type", ""))

    def test_revenue_export(self):
        url = reverse("revenue-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_revenue_export_pdf(self):
        url = reverse("revenue-export")
        response = self.client.get(url, {"export_format": "pdf"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", response.get("Content-Type", ""))

    def test_fixed_expense_generate(self):
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url, {"month": date.today().month, "year": date.today().year}
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
            ],
        )

    def test_categorization_rule_detail(self):
        from expenses.models import CategorizationRule

        rule = CategorizationRule.objects.create(
            merchant_contains="test",
            category="food and drink",
            is_active=True,
            owner=self.user,
            created_by=self.user,
        )
        url = reverse("categorization-rule-detail", args=[rule.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["merchant_contains"], "test")
        self.assertEqual(response.data["category"], "food and drink")

    def test_categorization_rule_update(self):
        from expenses.models import CategorizationRule

        rule = CategorizationRule.objects.create(
            merchant_contains="update",
            category="transport",
            is_active=True,
            owner=self.user,
            created_by=self.user,
        )
        url = reverse("categorization-rule-detail", args=[rule.pk])
        response = self.client.patch(url, {"merchant_contains": "updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["merchant_contains"], "updated")

    def test_categorization_rule_apply(self):
        url = reverse("categorization-rule-apply")
        response = self.client.post(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )
