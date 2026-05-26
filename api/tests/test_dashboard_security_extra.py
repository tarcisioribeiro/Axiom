"""
Additional dashboard and security tests for coverage boost.
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


class BaseExtraTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="extratest",
            email="extra@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Extra User",
            document_hash="e" * 64,
            phone="11999999929",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Extra Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("10000.00"),
        )


# ---------------------------------------------------------------------------
# Dashboard additional endpoints
# ---------------------------------------------------------------------------


class DashboardExtraViewTest(BaseExtraTestCase):
    def test_monthly_statement(self):
        url = reverse("monthly-statement")
        response = self.client.get(url, {"year": 2026, "month": 3})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_monthly_statement_default(self):
        url = reverse("monthly-statement")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cash_flow_forecast(self):
        url = reverse("cash-flow-forecast")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_financial_alerts(self):
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Security — Password health with actual data
# ---------------------------------------------------------------------------


class SecurityHealthViewTest(BaseExtraTestCase):
    def setUp(self):
        super().setUp()
        # Create a password so health report actually analyzes data
        create_url = reverse("password-list-create")
        self.client.post(
            create_url,
            {
                "title": "Gmail",
                "site": "https://gmail.com",
                "username": "test@gmail.com",
                "password": "short",  # weak password
                "category": "email",
                "owner": self.member.pk,
            },
        )
        self.client.post(
            create_url,
            {
                "title": "GitHub",
                "site": "https://github.com",
                "username": "testuser",
                "password": "short",  # duplicate weak password
                "category": "work",
                "owner": self.member.pk,
            },
        )

    def test_password_health_with_data(self):
        url = reverse("password-health-report")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_import_preview_no_file(self):
        url = reverse("password-import-preview")
        response = self.client.post(url, {"format": "bitwarden_json"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_import_preview_bad_format(self):
        from io import BytesIO

        url = reverse("password-import-preview")
        fake_file = BytesIO(b"some content")
        fake_file.name = "passwords.csv"
        response = self.client.post(
            url, {"file": fake_file, "format": "unsupported_format"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Security — Stored card reveal
# ---------------------------------------------------------------------------


class StoredCardRevealViewTest(BaseExtraTestCase):
    def test_reveal_stored_card(self):
        create_url = reverse("stored-card-list-create")
        resp = self.client.post(
            create_url,
            {
                "name": "Reveal Test",
                "cardholder_name": "Test User",
                "expiration_month": 6,
                "expiration_year": 2029,
                "flag": "MSC",
                "card_number": "5555555555554444",
                "security_code": "456",
                "owner": self.member.pk,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-card-reveal", args=[pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Vault transaction update
# ---------------------------------------------------------------------------


class VaultTransactionViewTest(BaseExtraTestCase):
    def setUp(self):
        super().setUp()
        # Create vault and deposit to generate a transaction
        create_url = reverse("vault-list-create")
        vault_resp = self.client.post(
            create_url,
            {
                "description": "TX Test",
                "account": self.account.pk,
                "yield_rate": "0.009",
                "annual_yield_rate": "0.1100",
                "is_active": True,
            },
        )
        self.vault_pk = vault_resp.data["id"]  # type: ignore
        deposit_url = reverse("vault-deposit", args=[self.vault_pk])
        self.client.post(
            deposit_url, {"amount": "1000.00", "description": "Init"}
        )

    def test_vault_transaction_list(self):
        url = reverse("vault-transactions", args=[self.vault_pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vault_all_transactions(self):
        url = reverse("all-vault-transactions")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Personal Planning - existing goal operations
# ---------------------------------------------------------------------------


class PersonalPlanningExtraTest(BaseExtraTestCase):
    def setUp(self):
        super().setUp()
        from personal_planning.models import Goal, RoutineTask

        self.task = RoutineTask.objects.create(
            name="PP Extra Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        self.goal = Goal.objects.create(
            title="PP Extra Goal",
            goal_type="total_days",
            target_value=30,
            start_date=date.today(),
            status="active",
            owner=self.member,
        )

    def test_delete_goal(self):
        url = reverse("goal-detail", args=[self.goal.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_instances_for_date(self):
        url = reverse("instances-for-date")
        response = self.client.get(url, {"date": str(date.today())})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_personal_planning_dashboard_stats_with_data(self):
        from personal_planning.models import TaskInstance

        TaskInstance.objects.create(
            template=self.task,
            task_name=self.task.name,
            category="health",
            scheduled_date=date.today(),
            status="completed",
            owner=self.member,
        )
        url = reverse("personal-planning-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
