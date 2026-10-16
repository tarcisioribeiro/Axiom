"""Força da senha de login (zxcvbn 0-4) em Member.password_strength."""

from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member


class LoginPasswordStrengthTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="strengthuser", password="TestPass123!"
        )
        self.member = Member.objects.create(
            name="Strength User",
            document_hash="s" * 64,
            phone="11999990003",
            sex="M",
            user=self.user,
        )

    def _login(self, password):
        return APIClient().post(
            "/api/v1/authentication/token/",
            {"username": "strengthuser", "password": password},
            format="json",
        )

    def test_login_fills_missing_score_only(self):
        self._login("TestPass123!")
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.password_strength)

        Member.objects.filter(pk=self.member.pk).update(password_strength=4)
        self._login("TestPass123!")
        self.member.refresh_from_db()
        self.assertEqual(self.member.password_strength, 4)

    def test_change_password_updates_score(self):
        Member.objects.filter(pk=self.member.pk).update(password_strength=0)
        client = APIClient()
        token = RefreshToken.for_user(self.user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        new = "correct horse battery staple 9!"
        resp = client.post(
            "/api/v1/users/change-password/",
            {
                "current_password": "TestPass123!",
                "new_password": new,
                "confirm_password": new,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.password_strength, 4)
