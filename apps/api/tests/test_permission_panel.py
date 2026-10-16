from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import ScreenDefault, UserScreenAccess


class PermissionPanelTest(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            "stf", "stf@test.com", "pw", is_staff=True
        )
        self.user = User.objects.create_user("comum", "c@test.com", "pw")
        self.client.force_authenticate(self.staff)
        self.detail = reverse(
            "admin-permissions-user-detail", args=[self.user.pk]
        )

    def test_common_user_is_forbidden(self):
        self.client.force_authenticate(self.user)
        for name in ("admin-permissions-screens", "admin-permissions-users"):
            self.assertEqual(
                self.client.get(reverse(name)).status_code,
                status.HTTP_403_FORBIDDEN,
            )

    def test_catalog_lists_modules_and_screens(self):
        data = self.client.get(reverse("admin-permissions-screens")).data
        self.assertEqual(
            [m["key"] for m in data],
            ["planning", "finance", "security", "intellect"],
        )
        screens = {s["key"]: s for m in data for s in m["screens"]}
        self.assertIn("reveal", screens["security.passwords"]["actions"])

    def test_lists_only_common_users(self):
        data = self.client.get(reverse("admin-permissions-users")).data
        self.assertEqual([u["username"] for u in data], ["comum"])
        found = self.client.get(
            reverse("admin-permissions-users"), {"q": "zzz"}
        ).data
        self.assertEqual(found, [])

    def test_replace_grants(self):
        payload = {
            "screens": {
                "security.passwords": ["view", "reveal"],
                "finance.accounts": ["add"],  # sem view: descartada
            }
        }
        response = self.client.put(self.detail, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        grants = dict(
            UserScreenAccess.objects.filter(user=self.user).values_list(
                "screen", "actions"
            )
        )
        self.assertEqual(grants, {"security.passwords": ["view", "reveal"]})

    def test_rejects_unknown_screen_or_action(self):
        for screens in ({"nope": ["view"]}, {"security.passwords": ["fly"]}):
            response = self.client.put(
                self.detail, {"screens": screens}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_staff_and_superuser_are_not_targets(self):
        other_staff = User.objects.create_user(
            "stf2", "stf2@test.com", "pw", is_staff=True
        )
        for target in (self.staff, other_staff):
            url = reverse("admin-permissions-user-detail", args=[target.pk])
            response = self.client.patch(
                url, {"is_active": False}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.is_active)

    def test_toggle_common_user(self):
        response = self.client.patch(
            self.detail, {"is_active": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_defaults_roundtrip(self):
        url = reverse("admin-permissions-defaults")
        payload = {"screens": {"intellect.books": ["view", "add"]}}
        self.assertEqual(
            self.client.put(url, payload, format="json").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            dict(ScreenDefault.objects.values_list("screen", "actions")),
            {"intellect.books": ["view", "add"]},
        )
        new_user = User.objects.create_user("novo", "n@test.com", "pw")
        self.assertEqual(
            list(
                UserScreenAccess.objects.filter(user=new_user).values_list(
                    "screen", flat=True
                )
            ),
            ["intellect.books"],
        )
