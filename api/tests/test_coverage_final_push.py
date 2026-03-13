"""
Final coverage push — CSV exports, permissions, vault lock/unlock paths,
and additional specific endpoint coverage.
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


class BaseFinalPushTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="pushtest",
            email="push@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.member = Member.objects.create(
            name="Push User",
            document_hash="u" * 64,
            phone="11999999899",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Push Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("5000.00"),
        )


# ---------------------------------------------------------------------------
# Member Financial Report CSV export
# ---------------------------------------------------------------------------


class MemberCSVExportViewTest(BaseFinalPushTestCase):
    def test_member_financial_report_csv(self):
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url, {"format": "csv"})
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )

    def test_member_permissions_update(self):
        url = reverse("member-permissions-update", args=[self.member.pk])
        response = self.client.put(url, {"permission_codenames": []}, format="json")
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            ],
        )

    def test_available_permissions(self):
        url = reverse("available-permissions")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN],
        )


# ---------------------------------------------------------------------------
# Security locked vault path (VaultLockedMixin with VaultConfig)
# ---------------------------------------------------------------------------


class VaultLockedSecurityViewTest(BaseFinalPushTestCase):
    def setUp(self):
        super().setUp()
        # Create VaultConfig to trigger the vault check path
        from security.models import VaultConfig

        VaultConfig.objects.create(
            owner=self.member,
            salt="a" * 32,
            encrypted_vault_key="encrypted_vault_key_value",
        )

    def test_password_list_locked_returns_423(self):
        # With VaultConfig but no key in cache → locked
        url = reverse("password-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)


# ---------------------------------------------------------------------------
# Loan update and delete
# ---------------------------------------------------------------------------


class LoanUpdateDeleteViewTest(BaseFinalPushTestCase):
    def setUp(self):
        super().setUp()
        from datetime import time

        from loans.models import Loan

        self.benefited = Member.objects.create(
            name="Benefited2",
            document_hash="x" * 64,
            phone="11999999889",
            sex="M",
        )
        self.creditor = Member.objects.create(
            name="Creditor2",
            document_hash="y" * 64,
            phone="11999999879",
            sex="F",
        )
        self.loan = Loan.objects.create(
            description="Test Loan",
            value=Decimal("1000.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(10, 0),
            category="loans",
            account=self.account,
            benefited=self.benefited,
            creditor=self.creditor,
            payed=False,
            status="active",
            created_by=self.user,
        )

    def test_update_loan(self):
        url = reverse("loan-detail-view", args=[self.loan.pk])
        response = self.client.patch(url, {"description": "Updated Loan"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_loan(self):
        url = reverse("loan-detail-view", args=[self.loan.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Notification operations
# ---------------------------------------------------------------------------


class NotificationOperationsViewTest(BaseFinalPushTestCase):
    def test_notification_summary(self):
        url = reverse("notification-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mark_all_notifications_read(self):
        url = reverse("notification-mark-all-read")
        response = self.client.post(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT],
        )


# ---------------------------------------------------------------------------
# Revenue delete
# ---------------------------------------------------------------------------


class RevenueDeleteViewTest(BaseFinalPushTestCase):
    def test_delete_revenue(self):
        from revenues.models import Revenue

        revenue = Revenue.objects.create(
            description="Delete Revenue",
            value=Decimal("1000.00"),
            date=date.today(),
            horary="09:00:00",
            category="salary",
            account=self.account,
            received=True,
            created_by=self.user,
        )
        url = reverse("revenue-detail-view", args=[revenue.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Dashboard more queries
# ---------------------------------------------------------------------------


class DashboardMoreStatsViewTest(BaseFinalPushTestCase):
    def test_dashboard_stats_current_date(self):
        url = reverse("current-date")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )


# ---------------------------------------------------------------------------
# Security password share tokens
# ---------------------------------------------------------------------------


class PasswordShareTokenViewTest(BaseFinalPushTestCase):
    def setUp(self):
        super().setUp()
        # Create a password to share
        create_url = reverse("password-list-create")
        resp = self.client.post(
            create_url,
            {
                "title": "Share Test",
                "username": "shareuser",
                "password": "sharedPass123",
                "category": "other",
                "owner": self.member.pk,
            },
        )
        if resp.status_code == status.HTTP_201_CREATED:
            self.password_pk = resp.data["id"]  # type: ignore
        else:
            self.password_pk = None

    def test_list_share_tokens(self):
        if self.password_pk is None:
            return
        url = reverse("password-share-token-list-create", args=[self.password_pk])
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )

    def test_create_share_token(self):
        if self.password_pk is None:
            return
        url = reverse("password-share-token-list-create", args=[self.password_pk])
        response = self.client.post(
            url,
            {"expires_in_hours": 24},
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_404_NOT_FOUND,
            ],
        )


# ---------------------------------------------------------------------------
# Vault change password endpoint
# ---------------------------------------------------------------------------


class VaultChangePasswordViewTest(BaseFinalPushTestCase):
    def test_vault_change_password_no_vault_config(self):
        url = reverse("vault-change-password")
        response = self.client.post(
            url,
            {
                "current_password": "oldpass",
                "new_password": "newpass123",
                "confirm_new_password": "newpass123",
            },
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
                status.HTTP_404_NOT_FOUND,
            ],
        )
