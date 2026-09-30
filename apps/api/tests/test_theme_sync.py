from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from authentication.models import ThemePreference


class ThemeSyncTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="themeuser", password="testpass123"
        )
        out = StringIO()
        call_command("issue_theme_sync_token", "themeuser", stdout=out)
        self.token = out.getvalue().strip()
        self.anon = APIClient()

    def _sync(self, theme, token=None):
        return self.anon.put(
            "/api/v1/theme-sync/",
            {"theme": theme},
            format="json",
            HTTP_AUTHORIZATION=f"ThemeSync {token or self.token}",
        )

    def test_sync_then_read_own_theme(self):
        self.assertEqual(self._sync("tokyo-night").status_code, 200)

        client = APIClient()
        access = RefreshToken.for_user(self.user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = client.get("/api/v1/me/theme/")
        self.assertEqual(resp.json(), {"theme": "tokyo-night"})

    def test_rejects_bad_token_and_unknown_theme(self):
        self.assertEqual(
            self._sync("dracula", token="x" * 64).status_code, 401
        )
        self.assertEqual(self._sync("not-a-theme").status_code, 400)

    def test_reissue_invalidates_old_token_and_hash_only_is_stored(self):
        old = self.token
        call_command("issue_theme_sync_token", "themeuser", stdout=StringIO())
        self.assertEqual(self._sync("dracula", token=old).status_code, 401)
        pref = ThemePreference.objects.get(user=self.user)
        self.assertNotIn(old, pref.sync_token_hash)

    def test_sync_token_does_not_authenticate_rest_of_api(self):
        resp = self.anon.get(
            "/api/v1/me/", HTTP_AUTHORIZATION=f"ThemeSync {self.token}"
        )
        self.assertEqual(resp.status_code, 401)

    def test_me_theme_is_null_without_preference(self):
        other = User.objects.create_user(username="other", password="x")
        client = APIClient()
        access = RefreshToken.for_user(other).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(
            client.get("/api/v1/me/theme/").json(), {"theme": None}
        )
