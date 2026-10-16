from django.contrib.auth.models import User
from django.urls import URLPattern, URLResolver, get_resolver, reverse
from rest_framework.test import APITestCase

from admin_panel import screens
from admin_panel.models import UserScreenAccess

DENIED = "Você não tem acesso a esta funcionalidade."


def _api_routes() -> dict[str, str]:
    """{url_name: rota sem o prefixo api/v1/}"""

    def walk(patterns, prefix=""):
        for p in patterns:
            if isinstance(p, URLResolver):
                yield from walk(p.url_patterns, prefix + str(p.pattern))
            elif isinstance(p, URLPattern) and p.name:
                yield p.name, prefix + str(p.pattern)

    return {
        name: route[len("api/v1/") :]
        for name, route in walk(get_resolver().url_patterns)
        if route.startswith("api/v1/")
    }


class ScreenRegistryTest(APITestCase):
    def test_every_module_route_is_registered(self):
        missing = [
            f"{name} ({route})"
            for name, route in _api_routes().items()
            if route.startswith(screens.GUARDED_PREFIXES)
            and not screens.is_registered(name)
            and name not in screens.UNGUARDED_ROUTES
        ]
        self.assertEqual(
            missing, [], "Rotas de módulo fora do registro de telas"
        )

    def test_registry_names_exist(self):
        routes = _api_routes()
        unknown = [n for n in screens.ROUTE_INDEX if n not in routes]
        unknown += [n for n in screens.BASE_ROUTES if n not in routes]
        self.assertEqual(unknown, [])

    def test_route_actions_are_declared_by_their_screen(self):
        methods = ("GET", "POST", "PUT", "PATCH", "DELETE")
        for key, screen in screens.SCREENS.items():
            for name, kind in screen["routes"].items():
                for method in methods:
                    action = screens.required_action(kind, method)
                    if action and kind not in ("crud", "read"):
                        self.assertIn(
                            action, screen["actions"], f"{key}:{name}"
                        )

    def test_effective_actions(self):
        result = screens.effective_actions(
            {
                "security.archives": ["view", "reveal", "bogus"],
                "finance.accounts": ["add"],  # sem view: ignorada
                "unknown.screen": ["view"],
            }
        )
        self.assertEqual(
            result,
            {
                "security.archives": {"view", "reveal"},
                "security.vault": {"view"},
            },
        )


class ScreenAccessMiddlewareTest(APITestCase):
    def setUp(self):
        # O signal aplica os padrões semeados pela migração (checklist)
        self.user = User.objects.create_user("comum", "c@c.com", "pw")
        self.client.force_authenticate(self.user)

    def _denied(self, response) -> bool:
        return (
            response.status_code == 403
            and response.json().get("detail") == DENIED
        )

    def test_new_user_receives_defaults(self):
        self.assertTrue(
            UserScreenAccess.objects.filter(
                user=self.user, screen="finance.accounts"
            ).exists()
        )
        self.assertFalse(
            UserScreenAccess.objects.filter(
                user=self.user, screen="planning.journey"
            ).exists()
        )

    def test_granted_view_passes(self):
        self.assertFalse(
            self._denied(self.client.get(reverse("dashboard-stats")))
        )

    def test_missing_action_is_denied(self):
        self.assertTrue(self._denied(self.client.get(reverse("ir-report"))))
        self.assertTrue(
            self._denied(
                self.client.post(reverse("ai-routine-suggestion"), {})
            )
        )

    def test_removed_screen_is_denied(self):
        UserScreenAccess.objects.filter(
            user=self.user, screen__startswith="finance."
        ).delete()
        self.assertTrue(
            self._denied(self.client.get(reverse("dashboard-stats")))
        )
        self.assertTrue(
            self._denied(self.client.get(reverse("account-create-list")))
        )

    def test_base_routes_ignore_screens(self):
        UserScreenAccess.objects.filter(user=self.user).delete()
        self.assertFalse(
            self._denied(self.client.get(reverse("member-create-list")))
        )
        self.assertTrue(
            self._denied(self.client.post(reverse("member-create-list"), {}))
        )

    def test_any_security_screen_can_set_up_the_vault(self):
        UserScreenAccess.objects.filter(user=self.user).delete()
        UserScreenAccess.objects.create(
            user=self.user, screen="security.passwords", actions=["view"]
        )
        self.assertFalse(
            self._denied(self.client.post(reverse("vault-setup"), {}))
        )
        self.assertTrue(
            self._denied(
                self.client.post(reverse("vault-change-password"), {})
            )
        )

    def test_staff_bypasses(self):
        staff = User.objects.create_user("stf", "s@s.com", "pw", is_staff=True)
        self.client.force_authenticate(staff)
        self.assertFalse(UserScreenAccess.objects.filter(user=staff).exists())
        self.assertFalse(self._denied(self.client.get(reverse("ir-report"))))

    def test_me_lists_screens(self):
        data = self.client.get(reverse("current-user")).json()
        self.assertIn("security.vault", data["screens"])
        self.assertIn("export", data["screens"]["finance.transactions"])
        self.assertNotIn("planning.journey", data["screens"])
