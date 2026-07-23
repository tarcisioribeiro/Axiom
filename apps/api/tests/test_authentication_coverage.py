"""
Coverage-focused tests for authentication/views.py,
authentication/cookie_auth.py and authentication/models.py.

Targets: 2FA setup/activate/verify/disable/status flows, backup code
consumption, ChangePasswordView, cookie-based JWT edge cases (missing
cookie, invalid/expired token, refresh rotation), and TOTPDevice model
helpers.
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

import pyotp
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.models import TOTPDevice
from members.models import Member


class BaseAuthCoverageTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="covauthuser",
            email="covauth@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )


# ---------------------------------------------------------------------------
# ChangePasswordView (views.py 711-746)
# ---------------------------------------------------------------------------


class ChangePasswordViewTest(BaseAuthCoverageTestCase):
    URL = "/api/v1/users/change-password/"

    def test_unauthenticated_returns_401(self):
        resp = APIClient().post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_fields_returns_400(self):
        resp = self.client.post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp.data)

    def test_wrong_current_password_returns_400(self):
        resp = self.client.post(
            self.URL,
            {
                "current_password": "WrongPass!",
                "new_password": "NewValidPass456!",
                "confirm_password": "NewValidPass456!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("incorreta", resp.data["error"])

    def test_passwords_mismatch_returns_400(self):
        resp = self.client.post(
            self.URL,
            {
                "current_password": "TestPass123!",
                "new_password": "NewValidPass456!",
                "confirm_password": "Different789!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("coincidem", resp.data["error"])

    def test_weak_new_password_returns_400(self):
        resp = self.client.post(
            self.URL,
            {
                "current_password": "TestPass123!",
                "new_password": "123",
                "confirm_password": "123",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("details", resp.data)

    def test_valid_change_returns_200(self):
        resp = self.client.post(
            self.URL,
            {
                "current_password": "TestPass123!",
                "new_password": "NewValidPass456!",
                "confirm_password": "NewValidPass456!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewValidPass456!"))


# ---------------------------------------------------------------------------
# TwoFactorSetupView (views.py 765-803)
# ---------------------------------------------------------------------------


class TwoFactorSetupViewTest(BaseAuthCoverageTestCase):
    URL = "/api/v1/users/2fa/setup/"

    def test_unauthenticated_returns_401(self):
        resp = APIClient().get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_setup_creates_pending_device(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("secret", resp.data)
        self.assertIn("qr_code", resp.data)
        self.assertTrue(
            resp.data["qr_code"].startswith("data:image/png;base64,")
        )
        device = TOTPDevice.objects.get(user=self.user)
        self.assertFalse(device.is_active)

    def test_setup_returns_existing_pending_device(self):
        first = self.client.get(self.URL)
        second = self.client.get(self.URL)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["secret"], second.data["secret"])
        self.assertEqual(TOTPDevice.objects.filter(user=self.user).count(), 1)

    def test_setup_rejected_when_already_active(self):
        device = TOTPDevice.objects.create(
            user=self.user, secret=pyotp.random_base32(), is_active=True
        )
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("já está ativado", resp.data["error"])
        device.delete()


# ---------------------------------------------------------------------------
# TwoFactorActivateView (views.py 817-870)
# ---------------------------------------------------------------------------


class TwoFactorActivateViewTest(BaseAuthCoverageTestCase):
    URL = "/api/v1/users/2fa/activate/"

    def test_unauthenticated_returns_401(self):
        resp = APIClient().post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_code_returns_400(self):
        resp = self.client.post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("obrigatório", resp.data["error"])

    def test_no_pending_setup_returns_400(self):
        resp = self.client.post(self.URL, {"code": "123456"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Nenhum setup", resp.data["error"])

    def test_already_active_returns_400(self):
        secret = pyotp.random_base32()
        TOTPDevice.objects.create(
            user=self.user, secret=secret, is_active=True
        )
        code = pyotp.TOTP(secret).now()
        resp = self.client.post(self.URL, {"code": code}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("já está ativado", resp.data["error"])

    def test_invalid_code_returns_400(self):
        secret = pyotp.random_base32()
        TOTPDevice.objects.create(
            user=self.user, secret=secret, is_active=False
        )
        resp = self.client.post(self.URL, {"code": "000000"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inválido", resp.data["error"])

    def test_valid_code_activates_and_returns_backup_codes(self):
        secret = pyotp.random_base32()
        TOTPDevice.objects.create(
            user=self.user, secret=secret, is_active=False
        )
        code = pyotp.TOTP(secret).now()
        resp = self.client.post(self.URL, {"code": code}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("backup_codes", resp.data)
        self.assertEqual(len(resp.data["backup_codes"]), 8)
        device = TOTPDevice.objects.get(user=self.user)
        self.assertTrue(device.is_active)
        self.assertIsNotNone(device.activated_at)
        self.assertEqual(len(device.backup_codes), 8)
        # stored codes are hashed, not plaintext
        self.assertNotIn(resp.data["backup_codes"][0], device.backup_codes)


# ---------------------------------------------------------------------------
# TwoFactorVerifyView (views.py 886-958)
# ---------------------------------------------------------------------------


class TwoFactorVerifyViewTest(BaseAuthCoverageTestCase):
    URL = "/api/v1/users/2fa/verify/"

    def setUp(self):
        super().setUp()
        self.secret = pyotp.random_base32()
        self.plaintext_codes, self.hashed_codes = (
            TOTPDevice.generate_backup_codes()
        )
        self.device = TOTPDevice.objects.create(
            user=self.user,
            secret=self.secret,
            is_active=True,
            backup_codes=self.hashed_codes,
        )

    def _make_temp_token(self):
        import secrets as _secrets

        temp_token = _secrets.token_urlsafe(32)
        cache.set(f"2fa_temp:{temp_token}", self.user.pk, timeout=300)
        return temp_token

    def test_missing_fields_returns_400(self):
        resp = self.client.post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("obrigatórios", resp.data["error"])

    def test_expired_or_unknown_temp_token_returns_400(self):
        resp = self.client.post(
            self.URL,
            {"temp_token": "does-not-exist", "code": "123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expirado", resp.data["error"])

    def test_device_missing_returns_400_and_clears_cache(self):
        temp_token = self._make_temp_token()
        self.device.delete()
        resp = self.client.post(
            self.URL,
            {"temp_token": temp_token, "code": "123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("não encontrado", resp.data["error"])
        # cache key should have been consumed
        self.assertIsNone(cache.get(f"2fa_temp:{temp_token}"))

    def test_invalid_code_returns_400(self):
        temp_token = self._make_temp_token()
        resp = self.client.post(
            self.URL,
            {"temp_token": temp_token, "code": "000000"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inválido", resp.data["error"])

    def test_valid_totp_code_sets_cookies_and_consumes_temp_token(self):
        temp_token = self._make_temp_token()
        code = pyotp.TOTP(self.secret).now()
        resp = self.client.post(
            self.URL, {"temp_token": temp_token, "code": code}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.cookies.get("access_token"))
        self.assertIsNotNone(resp.cookies.get("refresh_token"))
        self.assertEqual(resp.cookies["access_token"]["samesite"], "Strict")
        self.assertIsNone(cache.get(f"2fa_temp:{temp_token}"))

    def test_valid_backup_code_consumes_it_and_sets_cookies(self):
        temp_token = self._make_temp_token()
        backup_code = self.plaintext_codes[0]
        resp = self.client.post(
            self.URL,
            {"temp_token": temp_token, "code": backup_code},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.cookies.get("access_token"))
        self.device.refresh_from_db()
        self.assertEqual(len(self.device.backup_codes), 7)

    def test_reused_backup_code_rejected(self):
        backup_code = self.plaintext_codes[1]
        # First use — should succeed and consume the code.
        temp_token_1 = self._make_temp_token()
        resp1 = self.client.post(
            self.URL,
            {"temp_token": temp_token_1, "code": backup_code},
            format="json",
        )
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)

        # Second use of same backup code with a fresh temp token — rejected.
        temp_token_2 = self._make_temp_token()
        resp2 = self.client.post(
            self.URL,
            {"temp_token": temp_token_2, "code": backup_code},
            format="json",
        )
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inválido", resp2.data["error"])


# ---------------------------------------------------------------------------
# TwoFactorDisableView (views.py 971-987)
# ---------------------------------------------------------------------------


class TwoFactorDisableViewTest(BaseAuthCoverageTestCase):
    URL = "/api/v1/users/2fa/disable/"

    def setUp(self):
        super().setUp()
        self.secret = pyotp.random_base32()
        TOTPDevice.objects.create(
            user=self.user, secret=self.secret, is_active=True
        )

    def test_unauthenticated_returns_401(self):
        resp = APIClient().post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_password_returns_400(self):
        resp = self.client.post(
            self.URL, {"password": "WrongPass!"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("incorreta", resp.data["error"])
        self.assertTrue(TOTPDevice.objects.filter(user=self.user).exists())

    def test_correct_password_disables_2fa(self):
        resp = self.client.post(
            self.URL, {"password": "TestPass123!"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(TOTPDevice.objects.filter(user=self.user).exists())


# ---------------------------------------------------------------------------
# TwoFactorStatusView (views.py 999-1009)
# ---------------------------------------------------------------------------


class TwoFactorStatusViewTest(BaseAuthCoverageTestCase):
    URL = "/api/v1/users/2fa/status/"

    def test_unauthenticated_returns_401(self):
        resp = APIClient().get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_no_device_returns_inactive(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_active"])

    def test_active_device_returns_active(self):
        TOTPDevice.objects.create(
            user=self.user, secret=pyotp.random_base32(), is_active=True
        )
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_active"])

    def test_pending_device_returns_inactive(self):
        TOTPDevice.objects.create(
            user=self.user, secret=pyotp.random_base32(), is_active=False
        )
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_active"])


# ---------------------------------------------------------------------------
# get_current_user / registration edge branches not yet covered
# ---------------------------------------------------------------------------


class CreateUserWithMemberSuccessPathTest(APITestCase):
    """Covers the transaction.atomic() success block (268-371) including
    the members-group-missing warning branch and email-verification token
    generation/send."""

    def test_register_without_members_group_logs_warning(self):
        # Ensure no "members" group exists so the DoesNotExist branch runs.
        from django.contrib.auth.models import Group

        Group.objects.filter(name="members").delete()

        url = "/api/v1/users/register/"
        with (
            patch("django.core.mail.send_mail") as mock_send,
            patch(
                "django.template.loader.render_to_string",
                return_value="<html>verify</html>",
            ),
        ):
            resp = self.client.post(
                url,
                {
                    "username": "regnogroup",
                    "password": "Str0ngPass#2026",
                    "name": "Reg No Group",
                    "document": "529.982.247-25",
                    "phone": "11988887000",
                    "email": "regnogroup@example.com",
                },
            )
        self.assertIn(
            resp.status_code,
            [status.HTTP_201_CREATED, status.HTTP_429_TOO_MANY_REQUESTS],
        )
        if resp.status_code == status.HTTP_201_CREATED:
            member = Member.objects.get(pk=resp.data["member_id"])
            self.assertIsNotNone(member.email_verification_token)
            mock_send.assert_called_once()

    def test_register_duplicate_document_returns_400(self):
        from members.models import compute_document_hash

        User.objects.create_user(
            username="docowner", password="Str0ngPass#2026"
        )
        Member.objects.create(
            name="Doc Owner",
            document_hash=compute_document_hash("52998224725"),
            phone="11999990000",
            sex="M",
        )
        url = "/api/v1/users/register/"
        resp = self.client.post(
            url,
            {
                "username": "newdocuser",
                "password": "Str0ngPass#2026",
                "name": "New Doc User",
                "document": "529.982.247-25",
                "phone": "11988887001",
            },
        )
        self.assertIn(
            resp.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_429_TOO_MANY_REQUESTS],
        )


# ---------------------------------------------------------------------------
# EmailVerificationConfirmView — hasattr short-circuit (views.py 653-657)
# and EmailVerificationSendView hasattr branch (views.py 566-570)
# ---------------------------------------------------------------------------


class EmailVerificationHasattrBranchTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="hasattruser",
            email="hasattr@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Hasattr User",
            document_hash="h" * 64,
            phone="11999990002",
            sex="M",
            email="hasattr@example.com",
            user=self.user,
        )

    def test_send_view_returns_501_when_no_email_verified_attr(self):
        class _BareMember:
            """Stand-in object that deliberately lacks email_verified,
            to exercise the defensive hasattr() branch without touching
            the real Member model or monkeypatching builtins."""

            pk = 1

        with patch(
            "members.models.Member.objects.get",
            return_value=_BareMember(),
        ):
            resp = self.client.post(
                "/api/v1/users/email-verification/send/", format="json"
            )
        self.assertEqual(resp.status_code, status.HTTP_501_NOT_IMPLEMENTED)

    def test_confirm_view_returns_501_when_no_email_verified_attr(self):
        class _BareMember:
            """Stand-in object that deliberately lacks email_verified."""

            pk = 1

        with patch(
            "members.models.Member.objects.get",
            return_value=_BareMember(),
        ):
            resp = self.client.get(
                "/api/v1/users/email-verification/confirm/",
                {"token": "00000000-0000-0000-0000-000000000000"},
            )
        self.assertEqual(resp.status_code, status.HTTP_501_NOT_IMPLEMENTED)


# ---------------------------------------------------------------------------
# cookie_auth.py — CookieTokenObtainPairView (2FA required branch, invalid
# credentials TokenError branch)
# ---------------------------------------------------------------------------


class CookieTokenObtainPairViewCoverageTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="cookieloginuser",
            email="cookielogin@example.com",
            password="TestPass123!",
        )

    def test_invalid_credentials_raises_invalid_token(self):
        resp = self.client.post(
            "/api/v1/authentication/token/",
            {"username": "cookieloginuser", "password": "WrongPass!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_active_2fa_requires_second_factor(self):
        secret = pyotp.random_base32()
        TOTPDevice.objects.create(
            user=self.user, secret=secret, is_active=True
        )
        resp = self.client.post(
            "/api/v1/authentication/token/",
            {"username": "cookieloginuser", "password": "TestPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["requires_2fa"])
        self.assertIn("temp_token", resp.data)
        self.assertIsNone(resp.cookies.get("access_token"))

    def test_login_without_2fa_sets_cookies(self):
        resp = self.client.post(
            "/api/v1/authentication/token/",
            {"username": "cookieloginuser", "password": "TestPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.cookies.get("access_token"))
        self.assertIsNotNone(resp.cookies.get("refresh_token"))


# ---------------------------------------------------------------------------
# cookie_auth.py — CookieTokenRefreshView edge cases (missing/invalid cookie)
# ---------------------------------------------------------------------------


class CookieTokenRefreshViewCoverageTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="cookierefreshuser",
            email="cookierefresh@example.com",
            password="TestPass123!",
        )

    def test_missing_refresh_cookie_returns_401(self):
        resp = self.client.post(
            "/api/v1/authentication/token/refresh/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("não encontrado", resp.data["detail"])

    def test_invalid_refresh_cookie_returns_401(self):
        self.client.cookies["refresh_token"] = "not-a-valid-jwt-token"
        resp = self.client.post(
            "/api/v1/authentication/token/refresh/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("inválido", resp.data["detail"])

    def test_valid_refresh_cookie_rotates_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies["refresh_token"] = str(refresh)
        resp = self.client.post(
            "/api/v1/authentication/token/refresh/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.cookies.get("access_token"))


# ---------------------------------------------------------------------------
# cookie_auth.py — CookieTokenVerifyView (missing/invalid/valid access token)
# ---------------------------------------------------------------------------


class CookieTokenVerifyViewCoverageTest(APITestCase):
    def setUp(self):
        # Avoid AnonRateThrottle (30/minute) bleeding over from other tests
        # that hit anonymous endpoints earlier in the same test run.
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="cookieverifyuser",
            email="cookieverify@example.com",
            password="TestPass123!",
        )

    def tearDown(self):
        cache.clear()

    def test_missing_access_cookie_returns_401(self):
        resp = self.client.post(
            "/api/v1/authentication/token/verify/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("não encontrado", resp.data["detail"])

    def test_invalid_access_cookie_returns_401(self):
        self.client.cookies["access_token"] = "garbage-token"
        resp = self.client.post(
            "/api/v1/authentication/token/verify/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("inválido", resp.data["detail"])

    def test_valid_access_cookie_returns_200(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies["access_token"] = str(refresh.access_token)
        resp = self.client.post(
            "/api/v1/authentication/token/verify/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("válido", resp.data["detail"])


# ---------------------------------------------------------------------------
# cookie_auth.py — logout_view (with/without refresh cookie, invalid token)
# ---------------------------------------------------------------------------


class LogoutViewCoverageTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="logoutuser",
            email="logout@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        self.refresh_token = str(refresh)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}"
        )

    def test_logout_without_refresh_cookie_still_succeeds(self):
        resp = self.client.post(
            "/api/v1/authentication/logout/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_logout_with_invalid_refresh_cookie_still_succeeds(self):
        self.client.cookies["refresh_token"] = "invalid-token-value"
        resp = self.client.post(
            "/api/v1/authentication/logout/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_logout_with_valid_refresh_cookie_blacklists_it(self):
        self.client.cookies["refresh_token"] = self.refresh_token
        resp = self.client.post(
            "/api/v1/authentication/logout/", format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # The access_token cookie should now be expired/cleared (empty value).
        deleted_cookie = resp.cookies.get("access_token")
        self.assertIsNotNone(deleted_cookie)
        self.assertEqual(deleted_cookie.value, "")


# ---------------------------------------------------------------------------
# authentication/models.py — TOTPDevice helpers
# ---------------------------------------------------------------------------


class TOTPDeviceModelTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="totpmodeluser",
            email="totpmodel@example.com",
            password="TestPass123!",
        )
        self.secret = pyotp.random_base32()
        self.device = TOTPDevice.objects.create(
            user=self.user, secret=self.secret
        )

    def test_str_representation(self):
        self.assertEqual(
            str(self.device),
            f"TOTPDevice({self.user.username}, active=False)",
        )

    def test_generate_provisioning_uri_contains_issuer(self):
        from urllib.parse import unquote

        uri = self.device.generate_provisioning_uri()
        self.assertIn("Axiom", uri)
        self.assertIn(self.user.email, unquote(uri))

    def test_verify_token_valid_and_invalid(self):
        valid_code = pyotp.TOTP(self.secret).now()
        self.assertTrue(self.device.verify_token(valid_code))
        self.assertFalse(self.device.verify_token("000000"))

    def test_verify_backup_code_consumes_once(self):
        codes, hashed = TOTPDevice.generate_backup_codes()
        self.device.backup_codes = hashed
        self.device.save(update_fields=["backup_codes"])

        code = codes[0]
        self.assertTrue(self.device.verify_backup_code(code))
        self.device.refresh_from_db()
        self.assertEqual(len(self.device.backup_codes), 7)

        # Second attempt with the same code must fail (single use).
        self.assertFalse(self.device.verify_backup_code(code))

    def test_verify_backup_code_case_insensitive(self):
        codes, hashed = TOTPDevice.generate_backup_codes()
        self.device.backup_codes = hashed
        self.device.save(update_fields=["backup_codes"])

        code = codes[0].lower()
        self.assertTrue(self.device.verify_backup_code(code))

    def test_generate_backup_codes_returns_eight_unique_pairs(self):
        codes, hashed = TOTPDevice.generate_backup_codes()
        self.assertEqual(len(codes), 8)
        self.assertEqual(len(hashed), 8)
        self.assertEqual(len(set(codes)), 8)
        self.assertEqual(len(set(hashed)), 8)
