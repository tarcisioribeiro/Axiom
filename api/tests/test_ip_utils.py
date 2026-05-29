from django.test import RequestFactory, TestCase, override_settings

from app.ip_utils import get_client_ip


class GetClientIpTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _make_request(self, remote_addr="10.0.0.1", xff=None):
        request = self.factory.get("/")
        request.META["REMOTE_ADDR"] = remote_addr
        if xff is not None:
            request.META["HTTP_X_FORWARDED_FOR"] = xff
        return request

    # --- NUM_PROXIES = 0 (direct, no proxy) ---

    @override_settings(NUM_PROXIES=0)
    def test_no_proxy_uses_remote_addr(self):
        request = self._make_request(remote_addr="1.2.3.4")
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    @override_settings(NUM_PROXIES=0)
    def test_no_proxy_ignores_xff(self):
        """
        Even with a spoofed XFF header, REMOTE_ADDR wins when
        NUM_PROXIES=0.
        """
        request = self._make_request(remote_addr="1.2.3.4", xff="127.0.0.1")
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    # --- NUM_PROXIES = 1 (single nginx / load-balancer) ---

    @override_settings(NUM_PROXIES=1)
    def test_single_proxy_takes_rightmost_xff(self):
        """The rightmost XFF entry (added by nginx) is the real client IP."""
        request = self._make_request(remote_addr="10.0.0.2", xff="1.2.3.4")
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    @override_settings(NUM_PROXIES=1)
    def test_single_proxy_ignores_spoofed_left_entries(self):
        """
        An attacker prepends 127.0.0.1; we take the rightmost entry
        instead.
        """
        request = self._make_request(
            remote_addr="10.0.0.2", xff="127.0.0.1, 1.2.3.4"
        )
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    @override_settings(NUM_PROXIES=1)
    def test_single_proxy_fallback_when_xff_absent(self):
        request = self._make_request(remote_addr="1.2.3.4")
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    @override_settings(NUM_PROXIES=1)
    def test_single_proxy_fallback_when_xff_too_short(self):
        """XFF is present but empty — fall back to REMOTE_ADDR."""
        request = self._make_request(remote_addr="1.2.3.4", xff="")
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    # --- NUM_PROXIES = 2 (two-layer proxy, e.g., CDN + nginx) ---

    @override_settings(NUM_PROXIES=2)
    def test_two_proxies_takes_second_from_right(self):
        """
        Chain: <client_ip>, <lb_ip> — nginx (second proxy) saw <client_ip>
        as the connecting client, lb (first proxy) forwarded it.
        """
        request = self._make_request(
            remote_addr="10.0.0.3", xff="1.2.3.4, 10.0.0.2"
        )
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    @override_settings(NUM_PROXIES=2)
    def test_two_proxies_spoofed_entries_ignored(self):
        request = self._make_request(
            remote_addr="10.0.0.3", xff="127.0.0.1, 1.2.3.4, 10.0.0.2"
        )
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    @override_settings(NUM_PROXIES=2)
    def test_two_proxies_fallback_when_chain_too_short(self):
        """
        If the proxy chain is shorter than NUM_PROXIES (e.g., direct connection
        during local dev), fall back to REMOTE_ADDR rather than crashing.
        """
        request = self._make_request(remote_addr="1.2.3.4", xff="10.0.0.2")
        self.assertEqual(get_client_ip(request), "1.2.3.4")

    # --- default (no explicit setting — should behave as NUM_PROXIES=1) ---

    def test_default_num_proxies_is_1(self):
        request = self._make_request(
            remote_addr="10.0.0.2", xff="127.0.0.1, 5.6.7.8"
        )
        # default NUM_PROXIES=1 → takes rightmost: 5.6.7.8
        self.assertEqual(get_client_ip(request), "5.6.7.8")
