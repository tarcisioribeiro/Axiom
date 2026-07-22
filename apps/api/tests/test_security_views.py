"""
Security view tests — passwords, stored cards/accounts, archives, activity
logs,
security dashboard, and vault views.

The VaultLockedMixin falls back to app-key mode when no VaultConfig exists for
the
user, so tests that don't set up a VaultConfig will work without vault
unlocking.
"""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member

# ---------------------------------------------------------------------------
# Base test case
# ---------------------------------------------------------------------------


class BaseSecurityTestCase(APITestCase):
    """
    Superuser + JWT + Member linked to user (no VaultConfig → app-key
    mode).
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="sectest",
            email="sec@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Sec User",
            document_hash="s" * 64,
            phone="11999999990",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Security Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )


# ---------------------------------------------------------------------------
# Password CRUD
# ---------------------------------------------------------------------------


class PasswordViewTest(BaseSecurityTestCase):
    def _pw_data(self, title="Gmail"):
        return {
            "title": title,
            "site": "https://gmail.com",
            "username": "user@gmail.com",
            "password": "myS3cr3t!",
            "category": "email",
            "owner": self.member.pk,
        }

    def test_list_passwords(self):
        url = reverse("password-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_password(self):
        url = reverse("password-list-create")
        response = self.client.post(url, self._pw_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Gmail")  # type: ignore

    def test_retrieve_password(self):
        # Create via API so _password is properly encrypted
        create_url = reverse("password-list-create")
        resp = self.client.post(create_url, self._pw_data("LinkedIn"))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        pk = resp.data["id"]  # type: ignore
        url = reverse("password-detail", args=[pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_password(self):
        create_url = reverse("password-list-create")
        resp = self.client.post(create_url, self._pw_data("GitHub"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("password-detail", args=[pk])
        response = self.client.patch(url, {"title": "GitHub (updated)"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_password(self):
        create_url = reverse("password-list-create")
        resp = self.client.post(create_url, self._pw_data("Dropbox"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("password-detail", args=[pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_reveal_password(self):
        create_url = reverse("password-list-create")
        resp = self.client.post(create_url, self._pw_data("Twitter"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("password-reveal", args=[pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_generate_password(self):
        url = reverse("password-generate")
        response = self.client.post(
            url, {"length": 16, "include_symbols": True}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_health_report(self):
        url = reverse("password-health-report")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Stored Credit Cards
# ---------------------------------------------------------------------------


class StoredCreditCardViewTest(BaseSecurityTestCase):
    def _card_data(self, name="My Visa"):
        return {
            "name": name,
            "cardholder_name": "Test User",
            "expiration_month": 12,
            "expiration_year": 2030,
            "flag": "VSA",
            "card_number": "4111111111111111",
            "security_code": "123",
            "owner": self.member.pk,
        }

    def test_list_stored_cards(self):
        url = reverse("stored-card-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_stored_card(self):
        url = reverse("stored-card-list-create")
        response = self.client.post(url, self._card_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_stored_card(self):
        create_url = reverse("stored-card-list-create")
        resp = self.client.post(create_url, self._card_data("My Mastercard"))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-card-detail", args=[pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_stored_card(self):
        create_url = reverse("stored-card-list-create")
        resp = self.client.post(create_url, self._card_data("My Amex"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-card-detail", args=[pk])
        response = self.client.patch(url, {"name": "My Amex Gold"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_stored_card(self):
        create_url = reverse("stored-card-list-create")
        resp = self.client.post(create_url, self._card_data("Old Card"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-card-detail", args=[pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Stored Bank Accounts
# ---------------------------------------------------------------------------


class StoredBankAccountViewTest(BaseSecurityTestCase):
    def _account_data(self, name="Nubank"):
        return {
            "name": name,
            "institution_name": "Nubank",
            "account_type": "CC",
            "account_number": "123456789",
            "agency": "0001",
            "owner": self.member.pk,
        }

    def test_list_stored_accounts(self):
        url = reverse("stored-account-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_stored_account(self):
        url = reverse("stored-account-list-create")
        response = self.client.post(url, self._account_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_stored_account(self):
        create_url = reverse("stored-account-list-create")
        resp = self.client.post(create_url, self._account_data("Itau"))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-account-detail", args=[pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_stored_account(self):
        create_url = reverse("stored-account-list-create")
        resp = self.client.post(create_url, self._account_data("Bradesco"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-account-detail", args=[pk])
        response = self.client.patch(url, {"name": "Bradesco Updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_stored_account(self):
        create_url = reverse("stored-account-list-create")
        resp = self.client.post(create_url, self._account_data("Old Bank"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-account-detail", args=[pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_reveal_stored_account(self):
        create_url = reverse("stored-account-list-create")
        resp = self.client.post(create_url, self._account_data("Santander"))
        pk = resp.data["id"]  # type: ignore
        url = reverse("stored-account-reveal", args=[pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Activity Logs
# ---------------------------------------------------------------------------


class ActivityLogViewTest(BaseSecurityTestCase):
    def test_list_activity_logs(self):
        url = reverse("activity-log-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Security Dashboard
# ---------------------------------------------------------------------------


class SecurityDashboardViewTest(BaseSecurityTestCase):
    def test_security_dashboard_stats(self):
        url = reverse("security-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
