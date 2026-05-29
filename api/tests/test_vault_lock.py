"""
Tests for vault lock/unlock behavior, member permissions, loan operations,
notification endpoints, and vault change-password flow.
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
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
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
# Security locked vault path (VaultLockedMixin with VaultConfig)
# ---------------------------------------------------------------------------


class VaultLockedSecurityViewTest(BaseFinalPushTestCase):
    def setUp(self):
        super().setUp()
        from security.models import VaultConfig

        VaultConfig.objects.create(
            owner=self.member,
            salt="a" * 32,
            encrypted_vault_key="encrypted_vault_key_value",
        )

    def test_password_list_locked_returns_423(self):
        """
        With VaultConfig configured but no key in cache → vault is locked.
        """
        url = reverse("password-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)

    def test_password_share_token_list_locked_returns_423(self):
        """Share-token endpoint also requires vault to be unlocked."""
        # Use a placeholder pk; the vault-lock check fires before any DB
        # lookup.
        url = reverse("password-share-token-list-create", args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)


# ---------------------------------------------------------------------------
# Member permissions
# ---------------------------------------------------------------------------


class MemberPermissionsViewTest(BaseFinalPushTestCase):
    def test_member_permissions_update(self):
        url = reverse("member-permissions-update", args=[self.member.pk])
        response = self.client.put(
            url, {"permission_codenames": []}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)  # type: ignore
        self.assertIn("permissions", response.data)  # type: ignore

    def test_available_permissions(self):
        url = reverse("available-permissions")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response is a dict keyed by app name
        self.assertIsInstance(response.data, dict)
        self.assertIn("accounts", response.data)  # type: ignore


# ---------------------------------------------------------------------------
# Member Financial Report CSV export
# ---------------------------------------------------------------------------


class MemberReportViewTest(BaseFinalPushTestCase):
    def test_member_financial_report_json(self):
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)


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
        self.assertEqual(response.data["description"], "Updated Loan")

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
        self.assertIn("unread_count", response.data)  # type: ignore
        self.assertIsInstance(response.data["unread_count"], int)  # type: ignore  # noqa: E501

    def test_mark_all_notifications_read(self):
        url = reverse("notification-mark-all-read")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("marked_read", response.data)  # type: ignore
        self.assertIsInstance(response.data["marked_read"], int)  # type: ignore  # noqa: E501


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
# Dashboard current date (public utility endpoint)
# ---------------------------------------------------------------------------


class DashboardCurrentDateViewTest(BaseFinalPushTestCase):
    def test_dashboard_stats_current_date(self):
        url = reverse("current-date")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("date", response.data)  # type: ignore
        # Value should be a parseable date string (YYYY-MM-DD)
        from datetime import datetime

        parsed = datetime.strptime(response.data["date"], "%Y-%m-%d")
        self.assertIsNotNone(parsed)


# ---------------------------------------------------------------------------
# Vault change password — no VaultConfig → 400
# ---------------------------------------------------------------------------


class VaultChangePasswordViewTest(BaseFinalPushTestCase):
    def test_vault_change_password_no_vault_config(self):
        """When no VaultConfig exists the view returns 400."""
        url = reverse("vault-change-password")
        response = self.client.post(
            url,
            {
                "current_master_password": "oldpass",
                "new_master_password": "newpass1234",
                "confirm_new_master_password": "newpass1234",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)  # type: ignore
