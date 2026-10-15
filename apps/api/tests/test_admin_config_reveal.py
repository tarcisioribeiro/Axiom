from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from admin_panel.models import SystemConfig


class SystemConfigRevealTest(APITestCase):
    def setUp(self) -> None:
        config, _ = SystemConfig.objects.get_or_create(
            key="TEST_SECRET",
            defaults={"category": "llm", "label": "Test", "is_secret": True},
        )
        config.is_secret = True
        config.set_value("s3cr3t")
        config.save()
        self.url = reverse("admin-config-reveal", args=["TEST_SECRET"])

    def test_admin_sees_decrypted_value(self) -> None:
        admin = User.objects.create_superuser("adm", "a@a.com", "pw")
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["value"], "s3cr3t")

    def test_regular_user_is_forbidden(self) -> None:
        user = User.objects.create_user("usr", "u@u.com", "pw")
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_staff_is_forbidden(self) -> None:
        staff = User.objects.create_user("stf", "s@s.com", "pw", is_staff=True)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get(self.url).status_code, 403)
