"""
Política de dispositivo da versão Web (authentication/device_policy.py).

O que é confiável aqui: o roteamento da política (quais requisições entram
no escopo Web e quais ficam fora). A detecção em si depende de User-Agent e
Client Hints, que o cliente declara e pode falsificar — os testes só provam
que o servidor reage corretamente aos sinais recebidos.
"""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

UA_DESKTOP_CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
UA_MAC_SAFARI = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Safari/605.1.15"
)
UA_ELECTRON = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "axiom-desktop/1.0.0 Chrome/130.0 Electron/33.0.0 Safari/537.36"
)
UA_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 "
    "Safari/604.1"
)
UA_ANDROID_PHONE = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
)
UA_ANDROID_TABLET = (  # sem "Mobile": tablet Android
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
UA_IPAD_LEGACY = (
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1"
)
UA_REACT_NATIVE = "okhttp/4.12.0"

LOGIN_URL = "/api/v1/authentication/token/"
WEB_ROUTE = "/api/v1/me/"
BLOCK_CODE = "web_device_not_allowed"


class WebDevicePolicyTests(APITestCase):
    def setUp(self):
        cache.clear()  # LoginRateThrottle
        self.user = User.objects.create_user(
            username="deviceuser", password="TestPass123!"
        )
        self.client = APIClient()
        self.access = str(RefreshToken.for_user(self.user).access_token)

    def _login(self, ua=None, **extra):
        if ua is not None:
            extra["HTTP_USER_AGENT"] = ua
        return self.client.post(
            LOGIN_URL,
            {"username": "deviceuser", "password": "TestPass123!"},
            format="json",
            **extra,
        )

    def _cookie_get(self, ua, **extra):
        self.client.cookies["access_token"] = self.access
        return self.client.get(WEB_ROUTE, HTTP_USER_AGENT=ua, **extra)

    def _assert_blocked(self, response):
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], BLOCK_CODE)

    # --- Login Web --------------------------------------------------------
    def test_login_allowed_from_desktop_browsers(self):
        for ua in (UA_DESKTOP_CHROME, UA_MAC_SAFARI, UA_ELECTRON):
            with self.subTest(ua=ua):
                response = self._login(ua)
                self.assertEqual(response.status_code, 200)
                self.assertIn("access_token", response.cookies)

    def test_login_blocked_from_mobile_and_tablets(self):
        for ua in (
            UA_IPHONE,
            UA_ANDROID_PHONE,
            UA_ANDROID_TABLET,
            UA_IPAD_LEGACY,
        ):
            with self.subTest(ua=ua):
                response = self._login(ua)
                self._assert_blocked(response)
                self.assertNotIn("access_token", response.cookies)

    def test_login_blocked_by_client_hint_even_with_desktop_ua(self):
        self._assert_blocked(
            self._login(UA_DESKTOP_CHROME, HTTP_SEC_CH_UA_MOBILE="?1")
        )

    def test_login_without_user_agent_is_allowed(self):
        # Política escolhida: sem UA não há sinal de móvel; bloquear não
        # traria segurança (o UA é falsificável) e quebraria integrações.
        self.assertEqual(self._login().status_code, 200)

    def test_bad_credentials_still_401_on_desktop(self):
        response = self.client.post(
            LOGIN_URL,
            {"username": "deviceuser", "password": "errada"},
            format="json",
            HTTP_USER_AGENT=UA_DESKTOP_CHROME,
        )
        self.assertEqual(response.status_code, 401)

    def test_2fa_verify_and_refresh_blocked_on_mobile(self):
        for url in (
            "/api/v1/users/2fa/verify/",
            "/api/v1/authentication/token/refresh/",
        ):
            with self.subTest(url=url):
                self._assert_blocked(
                    self.client.post(url, {}, HTTP_USER_AGENT=UA_IPHONE)
                )

    # --- Sessão Web (cookie) ----------------------------------------------
    def test_cookie_session_allowed_on_desktop(self):
        response = self._cookie_get(UA_DESKTOP_CHROME)
        self.assertEqual(response.status_code, 200)

    def test_cookie_session_blocked_on_mobile(self):
        self._assert_blocked(self._cookie_get(UA_ANDROID_TABLET))

    def test_logout_stays_available_on_mobile(self):
        self.client.cookies["access_token"] = self.access
        response = self.client.post(
            "/api/v1/authentication/logout/", HTTP_USER_AGENT=UA_IPHONE
        )
        self.assertEqual(response.status_code, 200)

    # --- Clientes da API compartilhada (React Native / Electron) ----------
    def test_bearer_client_on_mobile_is_not_affected(self):
        response = self.client.get(
            WEB_ROUTE,
            HTTP_USER_AGENT=UA_REACT_NATIVE,
            HTTP_AUTHORIZATION=f"Bearer {self.access}",
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.get(
            WEB_ROUTE,
            HTTP_USER_AGENT=UA_IPHONE,
            HTTP_AUTHORIZATION=f"Bearer {self.access}",
        )
        self.assertEqual(response.status_code, 200)

    def test_bearer_without_token_still_requires_auth(self):
        response = self.client.get(WEB_ROUTE, HTTP_USER_AGENT=UA_IPHONE)
        self.assertEqual(response.status_code, 401)

    def test_public_endpoints_unaffected_on_mobile(self):
        response = self.client.get(
            "/api/v1/users/registration-status/", HTTP_USER_AGENT=UA_IPHONE
        )
        self.assertNotEqual(response.status_code, 403)
        response = self.client.get("/live/", HTTP_USER_AGENT=UA_IPHONE)
        self.assertNotEqual(response.status_code, 403)

    @override_settings(WEB_BLOCK_MOBILE_DEVICES=False)
    def test_policy_can_be_disabled(self):
        self.assertEqual(self._login(UA_IPHONE).status_code, 200)
