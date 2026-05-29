"""
CI tests for Content-Security-Policy response headers.

Guards against regressions that would reintroduce 'unsafe-inline' into
security-critical CSP directives.  The tests hit the /health/ endpoint
because it is always available without authentication and returns a JSON
response that triggers SecurityHeadersMiddleware.
"""

import re

from django.test import TestCase, override_settings
from django.urls import reverse


class CSPHeaderTest(TestCase):
    """Verify that SecurityHeadersMiddleware emits a safe CSP header."""

    def _get_csp(self) -> str:
        url = reverse("health-check")
        # Override CACHES so the health check succeeds without Redis.
        locmem_caches = {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "test-csp",
            }
        }
        from unittest.mock import patch

        with patch(
            "app.health.check_storage",
            return_value={"status": "healthy", "message": "ok"},
        ):
            with override_settings(CACHES=locmem_caches):
                response = self.client.get(url)
        self.assertIn(
            response.status_code,
            (200, 503),
            "Health endpoint must return a response so we can inspect headers",
        )
        return response.get("Content-Security-Policy", "")

    # ------------------------------------------------------------------
    # Core guard: 'unsafe-inline' must never appear in style-src
    # ------------------------------------------------------------------

    def test_style_src_has_no_unsafe_inline(self):
        csp = self._get_csp()
        self.assertNotEqual(
            csp, "", "Content-Security-Policy header must be present"
        )
        # Extract the style-src directive value
        match = re.search(r"style-src\s+([^;]+)", csp)
        self.assertIsNotNone(
            match, "style-src directive must be present in CSP"
        )
        style_src = match.group(1)
        self.assertNotIn(
            "'unsafe-inline'",
            style_src,
            f"'unsafe-inline' must not appear in style-src;"
            f" got: {style_src!r}",
        )

    def test_script_src_has_no_unsafe_inline(self):
        csp = self._get_csp()
        match = re.search(r"script-src\s+([^;]+)", csp)
        self.assertIsNotNone(
            match, "script-src directive must be present in CSP"
        )
        script_src = match.group(1)
        self.assertNotIn(
            "'unsafe-inline'",
            script_src,
            f"'unsafe-inline' must not appear in script-src;"
            f" got: {script_src!r}",
        )

    # ------------------------------------------------------------------
    # Nonce sanity checks
    # ------------------------------------------------------------------

    def test_csp_nonce_present_in_style_src(self):
        csp = self._get_csp()
        match = re.search(r"style-src\s+([^;]+)", csp)
        self.assertIsNotNone(match)
        style_src = match.group(1)
        self.assertRegex(
            style_src,
            r"'nonce-[A-Za-z0-9+/=]+'",
            f"A per-request nonce must appear in style-src;"
            f" got: {style_src!r}",
        )

    def test_csp_nonce_present_in_script_src(self):
        csp = self._get_csp()
        match = re.search(r"script-src\s+([^;]+)", csp)
        self.assertIsNotNone(match)
        script_src = match.group(1)
        self.assertRegex(
            script_src,
            r"'nonce-[A-Za-z0-9+/=]+'",
            f"A per-request nonce must appear in script-src;"
            f" got: {script_src!r}",
        )

    def test_nonce_differs_across_requests(self):
        """
        Each request must receive a unique nonce (no static/reused nonce).
        """
        nonces = set()
        for _ in range(3):
            csp = self._get_csp()
            match = re.search(r"'nonce-([A-Za-z0-9+/=]+)'", csp)
            self.assertIsNotNone(match, "Nonce must be present in CSP header")
            nonces.add(match.group(1))
        self.assertEqual(
            len(nonces),
            3,
            "Each request must generate a distinct nonce; static nonce defeats the purpose",  # noqa: E501
        )

    # ------------------------------------------------------------------
    # Frame-ancestors (clickjacking)
    # ------------------------------------------------------------------

    def test_frame_ancestors_none(self):
        csp = self._get_csp()
        self.assertIn("frame-ancestors 'none'", csp)

    # ------------------------------------------------------------------
    # Header presence
    # ------------------------------------------------------------------

    def test_csp_header_present_on_json_response(self):
        csp = self._get_csp()
        self.assertNotEqual(
            csp, "", "Content-Security-Policy header must be set"
        )

    def test_x_content_type_options_nosniff(self):
        url = reverse("health-check")
        locmem_caches = {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "test-csp-xcto",
            }
        }
        from unittest.mock import patch

        with patch(
            "app.health.check_storage",
            return_value={"status": "healthy", "message": "ok"},
        ):
            with override_settings(CACHES=locmem_caches):
                response = self.client.get(url)
        self.assertEqual(response.get("X-Content-Type-Options"), "nosniff")
