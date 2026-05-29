"""
Tests for security/vault_config.py: VaultStatusView, VaultSetupView,
VaultUnlockView, VaultLockView, VaultChangePasswordView.
Drives coverage of the vault lifecycle and master-password management.
"""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member


class BaseVaultConfigTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="vaultcfgtest",
            email="vaultcfg@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Vault Config User",
            document_hash="v" * 64,
            phone="11988880009",
            sex="M",
            user=self.user,
        )


# ---------------------------------------------------------------------------
# VaultStatusView — no vault configured
# ---------------------------------------------------------------------------


class VaultStatusViewTest(BaseVaultConfigTestCase):
    def test_vault_status_not_configured(self):
        """
        GET /vault/status/ returns is_configured=False when no VaultConfig.
        """
        url = reverse("vault-status")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("is_configured", response.data)
        self.assertIn("is_unlocked", response.data)
        self.assertFalse(response.data["is_configured"])
        self.assertFalse(response.data["is_unlocked"])

    def test_vault_status_no_member(self):
        """
        GET /vault/status/ returns is_configured=False when user has no
        Member.
        """
        user2 = User.objects.create_user(
            username="nomembervc",
            email="nomembervc@test.com",
            password="testpass123",
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("vault-status")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_configured"])


# ---------------------------------------------------------------------------
# VaultSetupView — setup, duplicate, no member
# ---------------------------------------------------------------------------


class VaultSetupViewTest(BaseVaultConfigTestCase):
    def test_vault_setup_success(self):
        """POST /vault/setup/ configures vault and returns 201."""
        url = reverse("vault-setup")
        response = self.client.post(
            url,
            {
                "master_password": "StrongPass1!",
                "confirm_master_password": "StrongPass1!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("message", response.data)

    def test_vault_setup_already_configured(self):
        """Second setup call returns 400."""
        url = reverse("vault-setup")
        payload = {
            "master_password": "StrongPass1!",
            "confirm_master_password": "StrongPass1!",
        }
        self.client.post(url, payload)
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_vault_setup_password_mismatch(self):
        """Mismatched passwords return 400."""
        url = reverse("vault-setup")
        response = self.client.post(
            url,
            {
                "master_password": "StrongPass1!",
                "confirm_master_password": "DifferentPass1!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vault_setup_no_member(self):
        """Setup without a member profile returns 400."""
        user2 = User.objects.create_user(
            username="setupnomember",
            email="setupnomember@test.com",
            password="testpass123",
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("vault-setup")
        response = client2.post(
            url,
            {
                "master_password": "StrongPass1!",
                "confirm_master_password": "StrongPass1!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


# ---------------------------------------------------------------------------
# VaultUnlockView — success, wrong password, no config
# ---------------------------------------------------------------------------


class VaultUnlockViewTest(BaseVaultConfigTestCase):
    MASTER_PASSWORD = "StrongPass1!"

    def setUp(self):
        super().setUp()
        # Set up the vault first
        self.client.post(
            reverse("vault-setup"),
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )
        # Lock it so we can test unlock
        self.client.post(reverse("vault-lock"))

    def test_vault_unlock_success(self):
        """Correct master password unlocks the vault."""
        url = reverse("vault-unlock")
        response = self.client.post(
            url, {"master_password": self.MASTER_PASSWORD}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertIn("expires_in", response.data)

    def test_vault_unlock_wrong_password(self):
        """Wrong master password returns 400."""
        url = reverse("vault-unlock")
        response = self.client.post(
            url, {"master_password": "WrongPassword1!"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_vault_unlock_no_config(self):
        """Unlock without a VaultConfig returns 400."""
        user2 = User.objects.create_user(
            username="unlocknomember",
            email="unlocknomember@test.com",
            password="testpass123",
        )
        Member.objects.create(
            name="Unlock No Config",
            document_hash="w" * 64,
            phone="11988880008",
            sex="M",
            user=user2,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("vault-unlock")
        response = client2.post(url, {"master_password": "anypassword"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_vault_unlock_no_member(self):
        """Unlock with a user that has no Member profile returns 400."""
        user_nm = User.objects.create_user(
            username="unlocknoMember2",
            email="unlocknomember2@test.com",
            password="testpass123",
        )
        client_nm = APIClient()
        refresh = RefreshToken.for_user(user_nm)
        client_nm.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("vault-unlock")
        response = client_nm.post(url, {"master_password": "anypassword"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


# ---------------------------------------------------------------------------
# VaultLockView
# ---------------------------------------------------------------------------


class VaultLockViewTest(BaseVaultConfigTestCase):
    def test_vault_lock(self):
        """POST /vault/lock/ always returns 200."""
        url = reverse("vault-lock")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)


# ---------------------------------------------------------------------------
# VaultStatusView — configured and locked/unlocked states
# ---------------------------------------------------------------------------


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "vault-status-test-unique",
        }
    }
)
class VaultStatusAfterSetupTest(BaseVaultConfigTestCase):
    MASTER_PASSWORD = "StrongPass2!"

    def setUp(self):
        super().setUp()
        cache.clear()

    def test_vault_status_configured_and_unlocked(self):
        """After setup, vault is configured and unlocked."""
        self.client.post(
            reverse("vault-setup"),
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )
        url = reverse("vault-status")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_configured"])
        self.assertTrue(response.data["is_unlocked"])

    def test_vault_status_configured_and_locked(self):
        """After lock, vault is configured but locked."""
        self.client.post(
            reverse("vault-setup"),
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )
        self.client.post(reverse("vault-lock"))
        url = reverse("vault-status")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_configured"])
        self.assertFalse(response.data["is_unlocked"])


# ---------------------------------------------------------------------------
# VaultChangePasswordView — with a configured vault
# ---------------------------------------------------------------------------


class VaultChangePasswordWithConfigTest(BaseVaultConfigTestCase):
    MASTER_PASSWORD = "OriginalPass1!"
    NEW_PASSWORD = "NewStrongPass1!"

    def setUp(self):
        super().setUp()
        self.client.post(
            reverse("vault-setup"),
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )

    def test_vault_change_password_success(self):
        """Correct current password changes the master password."""
        url = reverse("vault-change-password")
        response = self.client.post(
            url,
            {
                "current_master_password": self.MASTER_PASSWORD,
                "new_master_password": self.NEW_PASSWORD,
                "confirm_new_master_password": self.NEW_PASSWORD,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

    def test_vault_change_password_wrong_current(self):
        """Wrong current password returns 400."""
        url = reverse("vault-change-password")
        response = self.client.post(
            url,
            {
                "current_master_password": "WrongPassword1!",
                "new_master_password": self.NEW_PASSWORD,
                "confirm_new_master_password": self.NEW_PASSWORD,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_vault_change_password_mismatch(self):
        """Mismatched new passwords return 400."""
        url = reverse("vault-change-password")
        response = self.client.post(
            url,
            {
                "current_master_password": self.MASTER_PASSWORD,
                "new_master_password": self.NEW_PASSWORD,
                "confirm_new_master_password": "DifferentNew1!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vault_change_password_no_member(self):
        """
        Change password with a user that has no Member profile returns 400.
        """
        user_nm = User.objects.create_user(
            username="changepwnomember",
            email="changepwnomember@test.com",
            password="testpass123",
        )
        client_nm = APIClient()
        refresh = RefreshToken.for_user(user_nm)
        client_nm.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("vault-change-password")
        response = client_nm.post(
            url,
            {
                "current_master_password": self.MASTER_PASSWORD,
                "new_master_password": self.NEW_PASSWORD,
                "confirm_new_master_password": self.NEW_PASSWORD,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


# ---------------------------------------------------------------------------
# VaultSetupView — re-encrypt existing items (_re_encrypt_all_items path)
# ---------------------------------------------------------------------------


class VaultSetupReEncryptTest(APITestCase):
    """
    Tests _re_encrypt_all_items() by creating security items (Password) before
    vault setup so the re-encryption loop actually executes.
    """

    MASTER_PASSWORD = "ReEncryptPass1!"

    def setUp(self):
        self.user = User.objects.create_user(
            username="reencryptuser",
            email="reencrypt@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="ReEncrypt User",
            document_hash="r" * 64,
            phone="11988880006",
            sex="M",
            user=self.user,
        )

    def test_vault_setup_with_existing_password_items(self):
        """
        Vault setup re-encrypts existing Password items.
        Covers _re_encrypt_all_items() lines 90-98 in vault_config.py.
        """
        # Without vault config, VaultLockedMixin passes through → create
        # password
        pwd_url = reverse("password-list-create")
        pwd_resp = self.client.post(
            pwd_url,
            {
                "title": "My Gmail",
                "site": "https://gmail.com",
                "username": "user@gmail.com",
                "password": "mysecretpwd",
                "category": "social",
                "owner": self.member.pk,
            },
        )
        self.assertEqual(pwd_resp.status_code, status.HTTP_201_CREATED)

        # Now set up the vault — this triggers _re_encrypt_all_items()
        setup_url = reverse("vault-setup")
        response = self.client.post(
            setup_url,
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("message", response.data)

    def test_vault_locked_mixin_with_unlocked_vault(self):
        """
        After vault setup + unlock, accessing password-list-create
        (VaultLockedMixin) covers vault_config.py line 208
        (set_vault_key called when vault is unlocked).
        """
        # Setup vault
        self.client.post(
            reverse("vault-setup"),
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )
        # Vault is now unlocked (auto-unlocked on setup)
        # Access a VaultLockedMixin-protected endpoint
        url = reverse("password-list-create")
        response = self.client.get(url)
        self.assertIn(response.status_code, [200, 423])

    def test_vault_unlock_after_setup_with_items(self):
        """Unlock works correctly after setup with items re-encrypted."""
        # Create password item
        self.client.post(
            reverse("password-list-create"),
            {
                "title": "Bank Account",
                "site": "https://bank.com",
                "username": "myuser",
                "password": "bankpassword",
                "category": "banking",
                "owner": self.member.pk,
            },
        )
        # Setup vault
        self.client.post(
            reverse("vault-setup"),
            {
                "master_password": self.MASTER_PASSWORD,
                "confirm_master_password": self.MASTER_PASSWORD,
            },
        )
        # Lock
        self.client.post(reverse("vault-lock"))
        # Unlock
        response = self.client.post(
            reverse("vault-unlock"), {"master_password": self.MASTER_PASSWORD}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("expires_in", response.data)
