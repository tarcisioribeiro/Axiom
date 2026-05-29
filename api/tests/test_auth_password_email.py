"""
Tests for PasswordResetRequestView, PasswordResetConfirmView,
EmailVerificationSendView, and EmailVerificationConfirmView.
"""

import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member


class BaseAuthTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="authtest",
            email="authtest@example.com",
            password="TestPass123!",
            is_superuser=True,
            is_staff=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Auth Test User",
            document_hash="a" * 64,
            phone="11999990001",
            sex="M",
            email="authtest@example.com",
            user=self.user,
        )


# ---------------------------------------------------------------------------
# PasswordResetRequestView
# ---------------------------------------------------------------------------


class PasswordResetRequestViewTest(APITestCase):
    URL = "/api/v1/users/password-reset/"

    def setUp(self):
        self.anon_client = APIClient()
        self.user = User.objects.create_user(
            username="resetuser",
            email="reset@example.com",
            password="TestPass123!",
        )

    def test_no_email_returns_200(self):
        resp = self.anon_client.post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_unknown_email_returns_200(self):
        resp = self.anon_client.post(
            self.URL, {"email": "nobody@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)

    @patch("django.core.mail.send_mail")
    @patch(
        "django.template.loader.render_to_string",
        return_value="<html>reset</html>",
    )
    def test_known_email_returns_200_and_sends_email(
        self, mock_render, mock_send
    ):
        resp = self.anon_client.post(
            self.URL, {"email": "reset@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)
        mock_send.assert_called_once()

    @patch("django.core.mail.send_mail", side_effect=Exception("SMTP error"))
    @patch(
        "django.template.loader.render_to_string",
        return_value="<html>reset</html>",
    )
    def test_email_send_failure_still_returns_200(
        self, mock_render, mock_send
    ):
        resp = self.anon_client.post(
            self.URL, {"email": "reset@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# PasswordResetConfirmView
# ---------------------------------------------------------------------------


class PasswordResetConfirmViewTest(APITestCase):
    URL = "/api/v1/users/password-reset/confirm/"

    def setUp(self):
        self.anon_client = APIClient()
        self.user = User.objects.create_user(
            username="confirmuser",
            email="confirm@example.com",
            password="OldPass123!",
        )
        generator = PasswordResetTokenGenerator()
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = generator.make_token(self.user)

    def test_missing_fields_returns_400(self):
        resp = self.anon_client.post(self.URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_passwords_mismatch_returns_400(self):
        resp = self.anon_client.post(
            self.URL,
            {
                "uid": self.uid,
                "token": self.token,
                "new_password": "NewPass123!",
                "confirm_password": "Different123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_uid_returns_400(self):
        resp = self.anon_client.post(
            self.URL,
            {
                "uid": "invaliduid",
                "token": self.token,
                "new_password": "NewPass123!",
                "confirm_password": "NewPass123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_token_returns_400(self):
        resp = self.anon_client.post(
            self.URL,
            {
                "uid": self.uid,
                "token": "invalid-token",
                "new_password": "NewPass123!",
                "confirm_password": "NewPass123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_weak_password_returns_400(self):
        resp = self.anon_client.post(
            self.URL,
            {
                "uid": self.uid,
                "token": self.token,
                "new_password": "123",
                "confirm_password": "123",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp.data)

    def test_valid_reset_returns_200(self):
        resp = self.anon_client.post(
            self.URL,
            {
                "uid": self.uid,
                "token": self.token,
                "new_password": "NewValidPass456!",
                "confirm_password": "NewValidPass456!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewValidPass456!"))


# ---------------------------------------------------------------------------
# EmailVerificationSendView
# ---------------------------------------------------------------------------


class EmailVerificationSendViewTest(BaseAuthTestCase):
    URL = "/api/v1/users/email-verification/send/"

    def test_unauthenticated_returns_401(self):
        resp = APIClient().post(self.URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("django.core.mail.send_mail")
    @patch(
        "django.template.loader.render_to_string",
        return_value="<html>verify</html>",
    )
    def test_sends_verification_email(self, mock_render, mock_send):
        resp = self.client.post(self.URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.email_verification_token)

    def test_already_verified_returns_200(self):
        self.member.email_verified = True
        self.member.save(update_fields=["email_verified"])
        resp = self.client.post(self.URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)

    def test_no_email_returns_400(self):
        self.member.email = None
        self.member.save(update_fields=["email"])
        self.user.email = ""
        self.user.save(update_fields=["email"])
        resp = self.client.post(self.URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_not_found_returns_404(self):
        self.member.is_deleted = True
        self.member.save(update_fields=["is_deleted"])
        resp = self.client.post(self.URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    @patch("django.core.mail.send_mail", side_effect=Exception("SMTP error"))
    @patch(
        "django.template.loader.render_to_string",
        return_value="<html>verify</html>",
    )
    def test_email_send_failure_still_returns_200(
        self, mock_render, mock_send
    ):
        resp = self.client.post(self.URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# EmailVerificationConfirmView
# ---------------------------------------------------------------------------


class EmailVerificationConfirmViewTest(BaseAuthTestCase):
    URL = "/api/v1/users/email-verification/confirm/"

    def _set_token(self, token=None, sent_at=None):
        token = token or uuid.uuid4()
        self.member.email_verification_token = token
        self.member.email_verification_sent_at = sent_at or timezone.now()
        self.member.email_verified = False
        self.member.save(
            update_fields=[
                "email_verification_token",
                "email_verification_sent_at",
                "email_verified",
            ]
        )
        return token

    def test_no_token_returns_400(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_token_returns_400(self):
        resp = self.client.get(self.URL, {"token": str(uuid.uuid4())})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_token_verifies_email(self):
        token = self._set_token()
        resp = self.client.get(self.URL, {"token": str(token)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)
        self.member.refresh_from_db()
        self.assertTrue(self.member.email_verified)

    def test_already_verified_returns_200(self):
        token = self._set_token()
        self.member.email_verified = True
        self.member.save(update_fields=["email_verified"])
        resp = self.client.get(self.URL, {"token": str(token)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_expired_token_returns_400(self):
        old_time = timezone.now() - timedelta(hours=49)
        token = self._set_token(sent_at=old_time)
        resp = self.client.get(self.URL, {"token": str(token)})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expirado", resp.data["error"])

    def test_none_sent_at_returns_400(self):
        token = self._set_token()
        self.member.email_verification_sent_at = None
        self.member.save(update_fields=["email_verification_sent_at"])
        resp = self.client.get(self.URL, {"token": str(token)})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
