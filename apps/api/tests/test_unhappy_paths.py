"""
Unhappy-path tests for all primary view modules.

Covers for accounts, expenses, revenues, loans, credit_cards, transfers:
  - GET /resource/<nonexistent-id>/ → 404
  - POST with missing required fields → 400 with validation errors
  - DELETE a soft-deleted resource → 404

For security/passwords:
  - Attempt to read another user's password → 404
  - Create password with vault locked → 423
"""

from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member

# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------


class BaseUnhappyTestCase(APITestCase):
    """Superuser + JWT + Member + Account fixtures."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="unhappy_user",
            email="unhappy@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

        self.member = Member.objects.create(
            name="Unhappy User",
            document_hash="a" * 64,
            phone="11900000001",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Test Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )


# ---------------------------------------------------------------------------
# Accounts — unhappy paths
# ---------------------------------------------------------------------------


class AccountUnhappyTest(BaseUnhappyTestCase):
    def test_get_nonexistent_account_returns_404(self):
        url = reverse("account-detail-view", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_account_missing_required_fields_returns_400(self):
        url = reverse("account-create-list")
        # account_type is required (no default in the choices field)
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("account_type", response.data)  # type: ignore

    def test_get_soft_deleted_account_returns_404(self):
        self.account.is_deleted = True
        self.account.save()
        url = reverse("account-detail-view", kwargs={"pk": self.account.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Expenses — unhappy paths
# ---------------------------------------------------------------------------


class ExpenseUnhappyTest(BaseUnhappyTestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import Expense

        self.expense = Expense.objects.create(
            description="Test Expense",
            value=Decimal("50.00"),
            date=date.today(),
            horary=time(10, 0),
            category="others",
            account=self.account,
            payed=False,
            created_by=self.user,
        )

    def test_get_nonexistent_expense_returns_404(self):
        url = reverse("expense-detail-view", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_expense_missing_required_fields_returns_400(self):
        url = reverse("expense-create-list")
        # Only send date — description, value, category, account, horary are
        # missing
        response = self.client.post(url, {"date": date.today().isoformat()})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", response.data)  # type: ignore

    def test_get_soft_deleted_expense_returns_404(self):
        self.expense.is_deleted = True
        self.expense.save()
        url = reverse("expense-detail-view", kwargs={"pk": self.expense.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Revenues — unhappy paths
# ---------------------------------------------------------------------------


class RevenueUnhappyTest(BaseUnhappyTestCase):
    def setUp(self):
        super().setUp()
        from revenues.models import Revenue

        self.revenue = Revenue.objects.create(
            description="Test Revenue",
            value=Decimal("1000.00"),
            date=date.today(),
            horary=time(9, 0),
            category="salary",
            account=self.account,
            received=True,
            created_by=self.user,
        )

    def test_get_nonexistent_revenue_returns_404(self):
        url = reverse("revenue-detail-view", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_revenue_missing_required_fields_returns_400(self):
        url = reverse("revenue-create-list")
        response = self.client.post(url, {"date": date.today().isoformat()})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", response.data)  # type: ignore

    def test_get_soft_deleted_revenue_returns_404(self):
        self.revenue.is_deleted = True
        self.revenue.save()
        url = reverse("revenue-detail-view", kwargs={"pk": self.revenue.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Loans — unhappy paths
# ---------------------------------------------------------------------------


class LoanUnhappyTest(BaseUnhappyTestCase):
    def setUp(self):
        super().setUp()
        from loans.models import Loan

        self.benefited = Member.objects.create(
            name="Benefited",
            document_hash="b" * 64,
            phone="11900000002",
            sex="M",
        )
        self.creditor = Member.objects.create(
            name="Creditor",
            document_hash="c" * 64,
            phone="11900000003",
            sex="F",
        )
        self.loan = Loan.objects.create(
            description="Test Loan",
            value=Decimal("500.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(11, 0),
            category="others",
            account=self.account,
            benefited=self.benefited,
            creditor=self.creditor,
            payed=False,
            created_by=self.user,
        )

    def test_get_nonexistent_loan_returns_404(self):
        url = reverse("loan-detail-view", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_loan_missing_required_fields_returns_400(self):
        url = reverse("loan-create-list")
        # description is required; omit it along with many other required
        # fields
        response = self.client.post(url, {"value": "100.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", response.data)  # type: ignore

    def test_get_soft_deleted_loan_returns_404(self):
        self.loan.is_deleted = True
        self.loan.save()
        url = reverse("loan-detail-view", kwargs={"pk": self.loan.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Credit Cards — unhappy paths
# ---------------------------------------------------------------------------


class CreditCardUnhappyTest(BaseUnhappyTestCase):
    def setUp(self):
        super().setUp()
        from app.encryption import FieldEncryption
        from credit_cards.models import CreditCard

        self.card = CreditCard(
            name="Test Card",
            on_card_name="TEST USER",
            flag="VSA",
            validation_date=date(2028, 12, 31),
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            associated_account=self.account,
            created_by=self.user,
        )
        self.card._security_code = FieldEncryption.encrypt_data("123")
        self.card._card_number = FieldEncryption.encrypt_data(
            "4111111111111111"
        )
        self.card.save()

    def test_get_nonexistent_credit_card_returns_404(self):
        url = reverse("credit-card-detail-view", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_credit_card_missing_required_fields_returns_400(self):
        url = reverse("credit_card-create-list")
        # Only send name — flag, validation_date, credit_limit, etc. are
        # missing
        response = self.client.post(url, {"name": "Incomplete Card"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("flag", response.data)  # type: ignore

    def test_get_soft_deleted_credit_card_returns_404(self):
        self.card.is_deleted = True
        self.card.save()
        url = reverse("credit-card-detail-view", kwargs={"pk": self.card.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Transfers — unhappy paths
# ---------------------------------------------------------------------------


class TransferUnhappyTest(BaseUnhappyTestCase):
    def setUp(self):
        super().setUp()
        from transfers.models import Transfer

        self.dest_account = Account.objects.create(
            account_name="Dest Account",
            institution_name="SIC",
            account_type="CS",
            is_active=True,
        )
        self.transfer = Transfer.objects.create(
            description="Test Transfer",
            value=Decimal("200.00"),
            date=date.today(),
            horary=time(12, 0),
            category="pix",
            origin_account=self.account,
            destiny_account=self.dest_account,
            created_by=self.user,
        )

    def test_get_nonexistent_transfer_returns_404(self):
        url = reverse("transfer-detail-view", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_transfer_missing_required_fields_returns_400(self):
        url = reverse("transfer-create-list")
        # description is required; omit it and other required fields
        response = self.client.post(url, {"value": "50.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", response.data)  # type: ignore

    def test_get_soft_deleted_transfer_returns_404(self):
        self.transfer.is_deleted = True
        self.transfer.save()
        url = reverse("transfer-detail-view", kwargs={"pk": self.transfer.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Security / Passwords — unhappy paths
# ---------------------------------------------------------------------------


class PasswordUnhappyTest(APITestCase):
    """Tests for cross-user isolation and vault-locked access."""

    def setUp(self):
        # User A — owns a password
        self.user_a = User.objects.create_user(
            username="pw_user_a",
            email="pw_a@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client_a = APIClient()
        refresh_a = RefreshToken.for_user(self.user_a)
        self.client_a.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh_a.access_token}"
        )
        self.member_a = Member.objects.create(
            name="User A",
            document_hash="d" * 64,
            phone="11900000004",
            sex="M",
            user=self.user_a,
        )

        # User B — unrelated user
        self.user_b = User.objects.create_user(
            username="pw_user_b",
            email="pw_b@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client_b = APIClient()
        refresh_b = RefreshToken.for_user(self.user_b)
        self.client_b.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh_b.access_token}"
        )
        Member.objects.create(
            name="User B",
            document_hash="e" * 64,
            phone="11900000005",
            sex="F",
            user=self.user_b,
        )

        # Create a password belonging to User A (no VaultConfig → app-key mode)
        create_url = reverse("password-list-create")
        resp = self.client_a.post(
            create_url,
            {
                "title": "User A Gmail",
                "site": "https://gmail.com",
                "username": "usera@gmail.com",
                "password": "secret123",
                "category": "email",
                "owner": self.member_a.pk,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.password_pk = resp.data["id"]  # type: ignore

    def test_read_other_users_password_returns_404(self):
        """
        User B cannot access User A's password — queryset filters by owner.
        """
        url = reverse("password-detail", args=[self.password_pk])
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_password_with_vault_locked_returns_423(self):
        """When VaultConfig is configured but vault is locked, POST → 423."""
        from security.models import VaultConfig

        # Configure vault for user_a without unlocking (no key in Redis cache)
        VaultConfig.objects.create(
            owner=self.member_a,
            salt="f" * 32,
            encrypted_vault_key="placeholder_encrypted_key",
        )

        url = reverse("password-list-create")
        response = self.client_a.post(
            url,
            {
                "title": "Locked Vault Test",
                "username": "user@example.com",
                "password": "secret",
                "owner": self.member_a.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)
