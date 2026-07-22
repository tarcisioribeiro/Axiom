"""
Integration tests for GlobalDefaultPermission using non-superuser accounts.

These tests exercise the full HTTP stack
(URL routing → view → permission check)
to verify that GlobalDefaultPermission correctly enforces Django model
permissions
for regular (non-superuser) users.  They complement the unit tests in
test_permissions.py, which use mock objects and bypass URL routing.

Acceptance criteria addressed:
- PermissionDeniedTestCase base class with a non-superuser user
- 403 without permission / 200|201 with permission for accounts, expenses,
  and security/passwords endpoints
- Unknown HTTP methods are blocked by GlobalDefaultPermission (403)
"""

from datetime import date

from django.contrib.auth.models import Permission, User
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from expenses.models import Expense
from members.models import Member
from security.models import Password

# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------


class PermissionDeniedTestCase(APITestCase):
    """
    Base class for non-superuser permission integration tests.

    Creates a regular user (is_superuser=False) with no model permissions so
    that GlobalDefaultPermission denies all requests by default.  Individual
    tests grant specific permissions via _add_perm() and verify the expected
    HTTP status changes from 403 → 200/201.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="regular_user",
            email="regular@test.com",
            password="testpass123",
            # is_superuser defaults to False — must NOT be overridden here
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _add_perm(self, model_class, codename):
        """Grant a Django model permission to self.user.

        The permission is added directly to the user (not via a group) so it
        takes effect immediately on the next request processed by DRF's JWT
        authenticator, which fetches a fresh User object from the DB for each
        request and therefore has no stale permission cache.
        """
        ct = ContentType.objects.get_for_model(model_class)
        perm = Permission.objects.get(codename=codename, content_type=ct)
        self.user.user_permissions.add(perm)


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------


class AccountPermissionIntegrationTest(PermissionDeniedTestCase):
    """Full-stack permission tests for the /api/v1/accounts/ endpoints."""

    def setUp(self):
        super().setUp()
        self.list_url = reverse("account-create-list")
        # Account owned by the test user (get_queryset filters by created_by)
        self.account = Account.objects.create(
            account_name="Test Account",
            account_type="CS",
            institution_name="TestBank",
            is_active=True,
            created_by=self.user,
        )
        self.detail_url = reverse(
            "account-detail-view", args=[self.account.pk]
        )

    def _account_payload(self):
        return {
            "account_name": "New Account",
            "account_type": "CS",
            "institution": "NewBank",
            "is_active": True,
        }

    # --- LIST ---

    def test_list_without_permission_returns_403(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_view_permission_returns_200(self):
        self._add_perm(Account, "view_account")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- CREATE ---

    def test_create_without_permission_returns_403(self):
        response = self.client.post(self.list_url, self._account_payload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_add_permission_returns_201(self):
        self._add_perm(Account, "add_account")
        response = self.client.post(self.list_url, self._account_payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # --- RETRIEVE ---

    def test_retrieve_without_permission_returns_403(self):
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_with_view_permission_returns_200(self):
        self._add_perm(Account, "view_account")
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- UPDATE ---

    def test_update_without_permission_returns_403(self):
        response = self.client.patch(
            self.detail_url, {"account_name": "Renamed"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_with_change_permission_returns_200(self):
        self._add_perm(Account, "change_account")
        response = self.client.patch(
            self.detail_url, {"account_name": "Renamed"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- DELETE ---

    def test_delete_without_permission_returns_403(self):
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_with_delete_permission_returns_204(self):
        self._add_perm(Account, "delete_account")
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------


class ExpensePermissionIntegrationTest(PermissionDeniedTestCase):
    """Full-stack permission tests for the /api/v1/expenses/ endpoints."""

    def setUp(self):
        super().setUp()
        self.list_url = reverse("expense-create-list")
        # Account needed as FK for Expense (ownership not checked by expenses)
        self.account = Account.objects.create(
            account_name="Expense Account",
            account_type="CS",
            institution_name="TestBank",
            is_active=True,
            created_by=self.user,
        )
        # Expense owned by the test user (get_queryset filters by created_by)
        self.expense = Expense.objects.create(
            description="Test Expense",
            value="100.00",
            date=date.today(),
            horary="10:00:00",
            category="food and drink",
            account=self.account,
            payed=False,
            created_by=self.user,
        )
        self.detail_url = reverse(
            "expense-detail-view", args=[self.expense.pk]
        )

    def _expense_payload(self):
        return {
            "description": "New Expense",
            "value": "50.00",
            "date": date.today().isoformat(),
            "horary": "12:00:00",
            "category": "food and drink",
            "account": self.account.pk,
            "payed": False,
        }

    # --- LIST ---

    def test_list_without_permission_returns_403(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_view_permission_returns_200(self):
        self._add_perm(Expense, "view_expense")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- CREATE ---

    def test_create_without_permission_returns_403(self):
        response = self.client.post(self.list_url, self._expense_payload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_add_permission_returns_201(self):
        self._add_perm(Expense, "add_expense")
        response = self.client.post(self.list_url, self._expense_payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # --- RETRIEVE ---

    def test_retrieve_without_permission_returns_403(self):
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_with_view_permission_returns_200(self):
        self._add_perm(Expense, "view_expense")
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- UPDATE ---

    def test_update_without_permission_returns_403(self):
        response = self.client.patch(
            self.detail_url, {"description": "Updated"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_with_change_permission_returns_200(self):
        self._add_perm(Expense, "change_expense")
        response = self.client.patch(
            self.detail_url, {"description": "Updated"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- DELETE ---

    def test_delete_without_permission_returns_403(self):
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_with_delete_permission_returns_204(self):
        self._add_perm(Expense, "delete_expense")
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Security — Passwords
# ---------------------------------------------------------------------------


class PasswordPermissionIntegrationTest(PermissionDeniedTestCase):
    """Full-stack permission tests for the
    /api/v1/security/passwords/ endpoints.

    The VaultLockedMixin falls back to app-key mode when no VaultConfig exists,
    so tests operate without vault unlocking.  The Member object is required
    because Password.owner is a ForeignKey to Member.
    """

    def setUp(self):
        super().setUp()
        self.list_url = reverse("password-list-create")
        self.member = Member.objects.create(
            name="Test Member",
            document_hash="t" * 64,
            phone="11999999999",
            sex="M",
            user=self.user,
        )
        # Password owned by the test user's member (get_queryset filters by
        # owner__user)
        self.password_obj = Password.objects.create(
            title="Test Password",
            site="https://example.com",
            username="user@example.com",
            # raw encrypted field — not accessed in list
            _password="placeholder",
            category="other",
            owner=self.member,
            created_by=self.user,
        )
        self.detail_url = reverse(
            "password-detail", args=[self.password_obj.pk]
        )

    def _password_payload(self):
        return {
            "title": "New Password",
            "site": "https://newsite.com",
            "username": "newuser@example.com",
            "password": "S3cr3tP@ss!",
            "category": "email",
            "owner": self.member.pk,
        }

    # --- LIST ---

    def test_list_without_permission_returns_403(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_view_permission_returns_200(self):
        self._add_perm(Password, "view_password")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- CREATE ---

    def test_create_without_permission_returns_403(self):
        response = self.client.post(self.list_url, self._password_payload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_add_permission_returns_201(self):
        self._add_perm(Password, "add_password")
        response = self.client.post(self.list_url, self._password_payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # --- RETRIEVE ---

    def test_retrieve_without_permission_returns_403(self):
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_with_view_permission_returns_200(self):
        self._add_perm(Password, "view_password")
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- UPDATE ---

    def test_update_without_permission_returns_403(self):
        response = self.client.patch(self.detail_url, {"title": "Updated"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_with_change_permission_returns_200(self):
        self._add_perm(Password, "change_password")
        response = self.client.patch(self.detail_url, {"title": "Updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- DELETE ---

    def test_delete_without_permission_returns_403(self):
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_with_delete_permission_returns_204(self):
        self._add_perm(Password, "delete_password")
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Unknown HTTP method
# ---------------------------------------------------------------------------


class UnknownMethodPermissionTest(PermissionDeniedTestCase):
    """GlobalDefaultPermission must block HTTP methods it does not recognise.

    _get_action_suffix() returns "" for unknown methods, which produces an
    invalid permission codename that no user (other than a superuser) can
    hold.  The test uses a non-superuser who explicitly holds the view_account
    permission to prove that the block is caused by the unknown method rather
    than a missing permission.
    """

    def setUp(self):
        super().setUp()
        self.url = reverse("account-create-list")

    def test_unknown_method_returns_403_even_with_valid_user(self):
        # Grant a real permission so the user is not blocked by a missing perm
        self._add_perm(Account, "view_account")
        # Send a custom HTTP method that GlobalDefaultPermission does not map
        response = self.client.generic("FOOBAR", self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
