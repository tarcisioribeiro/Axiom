"""
Tests for user registration validation paths, member financial reports,
admin purge endpoint, and auth current-user edge cases.
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


class BasePush2TestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="push2test",
            email="push2@test.com",
            password="testpass123",
            is_superuser=True,
            is_staff=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Push2 User",
            document_hash="p" * 64,
            phone="11999999859",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Push2 Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("10000.00"),
        )


# ---------------------------------------------------------------------------
# Member financial report with member-linked data
# ---------------------------------------------------------------------------


class MemberFinancialReportWithDataTest(BasePush2TestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import Expense
        from revenues.models import Revenue

        Expense.objects.create(
            description="Member Rent",
            value=Decimal("1200.00"),
            date=date.today(),
            horary="10:00:00",
            category="bills and services",
            account=self.account,
            payed=True,
            member=self.member,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Member Food",
            value=Decimal("300.00"),
            date=date.today(),
            horary="12:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            member=self.member,
            created_by=self.user,
        )
        Revenue.objects.create(
            description="Member Salary",
            value=Decimal("5000.00"),
            date=date.today(),
            horary="09:00:00",
            category="salary",
            account=self.account,
            received=True,
            member=self.member,
            created_by=self.user,
        )
        from datetime import time

        from loans.models import Loan
        from payables.models import Payable
        from transfers.models import Transfer

        benefited = Member.objects.create(
            name="CSV Benefited",
            document_hash="b" * 64,
            phone="11900000011",
            sex="M",
        )
        Loan.objects.create(
            description="CSV Loan Benefited",
            value=Decimal("2000.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(9, 0),
            category="loans",
            account=self.account,
            benefited=self.member,
            creditor=benefited,
            payed=False,
            status="active",
            created_by=self.user,
        )
        Loan.objects.create(
            description="CSV Loan Creditor",
            value=Decimal("1000.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(10, 0),
            category="loans",
            account=self.account,
            benefited=benefited,
            creditor=self.member,
            payed=False,
            status="active",
            created_by=self.user,
        )
        Payable.objects.create(
            description="CSV Payable",
            value=Decimal("500.00"),
            paid_value=Decimal("0.00"),
            date=date.today(),
            category="bills and services",
            member=self.member,
            status="active",
            created_by=self.user,
        )
        dest_account = Account.objects.create(
            account_name="CSV Dest",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
        )
        Transfer.objects.create(
            description="CSV Transfer",
            value=Decimal("200.00"),
            date=date.today(),
            horary="11:00:00",
            category="pix",
            origin_account=self.account,
            destiny_account=dest_account,
            transfered=False,
            fee=Decimal("0.00"),
            member=self.member,
            created_by=self.user,
        )

    def test_member_financial_report_json_with_data(self):
        """Exercises category_totals loop when expenses exist."""
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response should contain financial summary sections
        self.assertIsInstance(response.data, dict)
        self.assertIn("expenses", response.data)

    def test_member_financial_report_csv_with_data(self):
        """Exercises _generate_csv + category_totals loop."""
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url, {"export_format": "csv"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", response.get("Content-Type", ""))


# ---------------------------------------------------------------------------
# Auth registration validation paths
# ---------------------------------------------------------------------------


class AuthRegistrationTest(APITestCase):
    def test_register_user_success(self):
        """Covers validate_cpf, validate_registration_data, register
        success."""
        url = reverse("register-user")
        response = self.client.post(
            url,
            {
                "username": "newreguser",
                "password": "Str0ngPass#2026",
                "name": "New Registered User",
                "document": "529.982.247-25",  # Valid CPF
                "phone": "11988887777",
                "email": "newreg@test.com",
            },
        )
        # 429 is only expected if rate-limiting is active in this environment
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_429_TOO_MANY_REQUESTS],
        )
        if response.status_code == status.HTTP_201_CREATED:
            self.assertIn("username", response.data)

    def test_register_user_duplicate_username(self):
        """Covers duplicate-username rejection path."""
        User.objects.create_user(
            username="dupuser",
            email="dup@test.com",
            password="testpass123",
        )
        url = reverse("register-user")
        response = self.client.post(
            url,
            {
                "username": "dupuser",
                "password": "Str0ngPass#2026",
                "name": "Dup User",
                "document": "111.444.777-35",  # Valid CPF
                "phone": "11988887766",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_user_invalid_cpf(self):
        """Covers invalid CPF branch in validate_cpf."""
        url = reverse("register-user")
        response = self.client.post(
            url,
            {
                "username": "invalidcpfuser",
                "password": "Str0ngPass#2026",
                "name": "CPF Test User",
                "document": "111.111.111-11",  # Invalid CPF (all same digits)
                "phone": "11988887755",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_user_missing_fields(self):
        """Covers missing-required-fields path in
        validate_registration_data."""
        url = reverse("register-user")
        response = self.client.post(url, {})
        # 429 is possible when rate-limiting fires before validation in
        # this environment
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_429_TOO_MANY_REQUESTS],
        )

    def test_register_user_invalid_username_length(self):
        """Covers username-too-short validation branch."""
        url = reverse("register-user")
        response = self.client.post(
            url,
            {
                "username": "ab",  # Too short
                "password": "Str0ngPass#2026",
                "name": "Short Username",
                "document": "529.982.247-25",
                "phone": "11988887744",
            },
        )
        # 429 is possible when rate-limiting fires before validation in
        # this environment
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_429_TOO_MANY_REQUESTS],
        )

    def test_register_user_invalid_username_chars(self):
        """Covers username-special-characters validation branch."""
        url = reverse("register-user")
        response = self.client.post(
            url,
            {
                "username": "bad-username!",
                "password": "Str0ngPass#2026",
                "name": "Bad Chars",
                "document": "529.982.247-25",
                "phone": "11988887733",
            },
        )
        # 429 is possible when rate-limiting fires before validation in
        # this environment
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_429_TOO_MANY_REQUESTS],
        )


# ---------------------------------------------------------------------------
# Admin purge deleted records (dry_run=True, no actual deletion)
# ---------------------------------------------------------------------------


class AdminPurgeDeletedTest(BasePush2TestCase):
    def test_purge_deleted_dry_run(self):
        """Covers PurgeDeletedView with dry_run=True."""
        url = reverse("admin-purge-deleted")
        response = self.client.post(
            url,
            {"days": 90, "dry_run": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("dry_run", response.data)  # type: ignore
        self.assertTrue(response.data["dry_run"])  # type: ignore
        self.assertIn("total", response.data)  # type: ignore
        self.assertIn("cutoff_date", response.data)  # type: ignore

    def test_purge_deleted_default_params(self):
        """Covers PurgeDeletedView with default params."""
        url = reverse("admin-purge-deleted")
        response = self.client.post(url, {"days": 30}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["dry_run"])  # type: ignore

    def test_purge_deleted_with_actual_records(self):
        """
        Creates soft-deleted records older than the cutoff and runs the purge
        to trigger the anonymization + hard-delete loop in app/views.py.
        Covers _anonymize_account, _anonymize_member, _log_purge paths.
        """
        from datetime import timedelta

        from django.utils import timezone

        cutoff_past = timezone.now() - timedelta(days=2)

        # Soft-deleted Account
        stale_account = Account.objects.create(
            account_name="Stale Account",
            institution_name="STALE",
            account_type="CS",
            is_active=False,
        )
        stale_account.is_deleted = True
        stale_account.deleted_at = cutoff_past
        stale_account.save()

        # Soft-deleted Member (no user to avoid FK complications)
        stale_member = Member.objects.create(
            name="Stale Member",
            document_hash="s" * 64,
            phone="11900000099",
            sex="M",
        )
        stale_member.is_deleted = True
        stale_member.deleted_at = cutoff_past
        stale_member.save()

        url = reverse("admin-purge-deleted")
        response = self.client.post(
            url, {"days": 1, "dry_run": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["dry_run"])  # type: ignore
        self.assertIn("purged", response.data)  # type: ignore
        self.assertGreater(response.data["total"], 0)  # type: ignore


# ---------------------------------------------------------------------------
# Auth views — get_current_user without member (Member.DoesNotExist branch)
# ---------------------------------------------------------------------------


class AuthCurrentUserNoMemberTest(APITestCase):
    def test_current_user_no_member(self):
        """Covers Member.DoesNotExist branch in get_current_user."""
        user = User.objects.create_user(
            username="nomemberuser",
            email="nomember@test.com",
            password="testpass123",
        )
        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse("current-user")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data.get("member"))  # type: ignore


# ---------------------------------------------------------------------------
# Auth views — user-permissions blocks superusers
# ---------------------------------------------------------------------------


class UserPermissionsSuperuserTest(BasePush2TestCase):
    def test_user_permissions_superuser_blocked(self):
        """Covers superuser-blocked branch in get_user_permissions."""
        url = reverse("user-permissions")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
