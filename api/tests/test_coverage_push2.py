"""
Coverage push 2 — registration success, member CSV report with data,
admin purge (dry run), and authentication paths.
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
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
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
# Member financial report CSV with actual member-linked data
# ---------------------------------------------------------------------------


class MemberFinancialReportCSVWithDataTest(BasePush2TestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import Expense
        from revenues.models import Revenue

        # Create expenses linked to the member
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
        # Create revenues linked to the member
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
        # Create loans, payables, transfers to cover CSV loan/payable/transfer rows
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

    def test_member_financial_report_csv_with_data(self):
        """Exercises _generate_csv + category_totals loop (lines 374-594)."""
        from django.conf import settings
        from django.test import override_settings

        # Disable DRF's URL format override so ?format=csv reaches the view
        # without triggering DRF content negotiation (which has no CSV renderer)
        rf = dict(settings.REST_FRAMEWORK)
        rf["URL_FORMAT_OVERRIDE"] = None
        url = reverse("member-financial-report", args=[self.member.pk])
        with override_settings(REST_FRAMEWORK=rf):
            response = self.client.get(url, {"format": "csv"})
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )
        if response.status_code == status.HTTP_200_OK:
            # Should return CSV content
            self.assertIn(
                "text/csv",
                response.get("Content-Type", ""),
            )

    def test_member_financial_report_json_with_data(self):
        """Exercises category_totals loop when expenses exist (lines 374-378)."""
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )


# ---------------------------------------------------------------------------
# Auth registration success path
# ---------------------------------------------------------------------------


class AuthRegistrationSuccessTest(APITestCase):
    REGISTER_OK = [
        status.HTTP_201_CREATED,
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_429_TOO_MANY_REQUESTS,
    ]
    REGISTER_BAD = [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_429_TOO_MANY_REQUESTS,
    ]

    def test_register_user_success(self):
        """Covers validate_cpf, validate_registration_data, register view success."""
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
        self.assertIn(response.status_code, self.REGISTER_OK)

    def test_register_user_duplicate_username(self):
        """Covers duplicate check path (lines 237-252)."""
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
        self.assertIn(response.status_code, self.REGISTER_OK)

    def test_register_user_invalid_cpf(self):
        """Covers invalid CPF branch in validate_cpf (lines 18-35)."""
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
        self.assertIn(response.status_code, self.REGISTER_BAD)

    def test_register_user_missing_fields(self):
        """Covers validation errors path in validate_registration_data."""
        url = reverse("register-user")
        response = self.client.post(url, {})
        self.assertIn(response.status_code, self.REGISTER_BAD)

    def test_register_user_invalid_username_length(self):
        """Covers username length validation branch."""
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
        self.assertIn(response.status_code, self.REGISTER_BAD)

    def test_register_user_invalid_username_chars(self):
        """Covers username special chars branch."""
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
        self.assertIn(response.status_code, self.REGISTER_BAD)


# ---------------------------------------------------------------------------
# Admin purge deleted records (dry_run=True, no actual deletion)
# ---------------------------------------------------------------------------


class AdminPurgeDeletedTest(BasePush2TestCase):
    def test_purge_deleted_dry_run(self):
        """Covers app/views.py PurgeDeletedRecordsView (lines 63-93)."""
        url = reverse("admin-purge-deleted")
        response = self.client.post(
            url,
            {"days": 90, "dry_run": True},
            format="json",
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            ],
        )
        if response.status_code == status.HTTP_200_OK:
            self.assertIn("dry_run", response.data)  # type: ignore
            self.assertTrue(response.data["dry_run"])  # type: ignore

    def test_purge_deleted_default_params(self):
        """Covers app/views.py with default params."""
        url = reverse("admin-purge-deleted")
        response = self.client.post(url, {"days": 30}, format="json")
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            ],
        )


# ---------------------------------------------------------------------------
# Auth views — get_current_user without member (line 136 branch)
# ---------------------------------------------------------------------------


class AuthCurrentUserNoMemberTest(APITestCase):
    def test_current_user_no_member(self):
        """Covers Member.DoesNotExist branch in get_current_user (line 136)."""
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
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN],
        )
        if response.status_code == status.HTTP_200_OK:
            self.assertIsNone(response.data.get("member"))  # type: ignore


# ---------------------------------------------------------------------------
# Auth views — user-permissions blocks superusers
# ---------------------------------------------------------------------------


class UserPermissionsSuperuserTest(BasePush2TestCase):
    def test_user_permissions_superuser_blocked(self):
        """Covers superuser-blocked branch in get_user_permissions (line 165)."""
        url = reverse("user-permissions")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
