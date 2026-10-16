"""Regressions found by the usage tests: requests that returned 500."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member


class Api500RegressionsTest(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_superuser(
            username="reg500", email="r@test.com", password="pass"
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.member = Member.objects.create(
            name="Reg",
            document_hash="r" * 64,
            phone="11999999990",
            sex="M",
            user=self.user,
        )

    def test_goal_without_start_date_defaults_to_local_today(self) -> None:
        r = self.client.post(
            reverse("goal-list-create"),
            {
                "title": "Ler",
                "goal_type": "custom",
                "target_value": 10,
                "owner": self.member.pk,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(
            r.data["start_date"], timezone.localdate().isoformat()
        )

    def test_model_validation_error_returns_400(self) -> None:
        account = Account.objects.create(
            account_name="A",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("100"),
            created_by=self.user,
        )
        r = self.client.post(
            reverse("transfer-create-list"),
            {
                "description": "x",
                "value": "10.00",
                "date": timezone.localdate().isoformat(),
                "horary": "10:00",
                "category": "doc",
                "origin_account": account.pk,
                "destiny_account": account.pk,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("destiny_account", r.data)

    def test_webhook_edit_with_blank_secret_keeps_current(self) -> None:
        payload = {"name": "W", "url": "https://example.com", "events": []}
        r = self.client.post(
            reverse("webhook-list-create"), payload, format="json"
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("secret", r.data)
        r = self.client.post(
            reverse("webhook-list-create"),
            {**payload, "secret": "s3cret"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        detail = reverse("webhook-detail", args=[r.data["id"]])
        r = self.client.patch(
            detail, {"name": "W2", "secret": ""}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        from webhooks.models import Webhook

        self.assertEqual(Webhook.objects.get(name="W2").secret, "s3cret")
