"""
Targeted tests to close coverage gaps in:
  - accounts/views.py  (AccountProjectedBalanceView)
  - budgets/views.py   (BudgetSuggestView)
  - webhooks/views.py  (deliveries, events, test)
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from expenses.models import Expense
from webhooks.models import Webhook


class BaseCoverageTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="covuser",
            email="cov@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.account = Account.objects.create(
            account_name="CovBank",
            account_type="CA",
            institution_name="CovBank",
            is_active=True,
            created_by=self.user,
        )


class AccountProjectedBalanceViewTest(BaseCoverageTestCase):
    def _url(self):
        return reverse(
            "account-projected-balance", kwargs={"pk": self.account.pk}
        )

    def test_missing_date_param_returns_400(self):
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_date_format_returns_400(self):
        response = self.client.get(self._url(), {"date": "not-a-date"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_account_returns_404(self):
        url = reverse("account-projected-balance", kwargs={"pk": 99999999})
        response = self.client.get(url, {"date": "2026-01-01"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_valid_request_returns_200(self):
        future = (timezone.now() + timedelta(days=30)).date().isoformat()
        response = self.client.get(self._url(), {"date": future})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("projected_balance", response.data)
        self.assertIn("current_balance", response.data)


class BudgetSuggestViewTest(BaseCoverageTestCase):
    URL = "budget-suggest"

    def _post(self, **body):
        return self.client.post(reverse(self.URL), body, format="json")

    def test_no_expense_history_returns_422(self):
        response = self._post()
        self.assertEqual(
            response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    def test_with_expense_history_returns_suggestions(self):
        recent = (timezone.now() - timedelta(days=30)).date()
        Expense.objects.create(
            description="Mercado",
            value=Decimal("300.00"),
            category="supermarket",
            date=recent,
            payed=True,
            account=self.account,
            created_by=self.user,
        )
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("suggestions", response.data)
        self.assertGreater(len(response.data["suggestions"]), 0)

    def test_include_llm_reasoning_skips_llm_on_exception(self):
        """When LLM raises, suggestions still return (LLM is optional)."""
        recent = (timezone.now() - timedelta(days=30)).date()
        Expense.objects.create(
            description="Aluguel",
            value=Decimal("1000.00"),
            category="house",
            date=recent,
            payed=True,
            account=self.account,
            created_by=self.user,
        )
        with patch(
            "agents.core.llm_client.LLMClient.chat",
            side_effect=Exception("offline"),
        ):
            response = self._post(include_llm_reasoning=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("suggestions", response.data)


class WebhookViewsTest(BaseCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.webhook = Webhook.objects.create(
            name="Test Webhook",
            url="http://example.com/hook",
            secret="mysecret",
            events=["expense.created"],
            is_active=True,
            created_by=self.user,
        )

    def test_list_webhook_deliveries_empty(self):
        url = reverse("webhook-deliveries", kwargs={"pk": self.webhook.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_list_webhook_deliveries_not_found(self):
        url = reverse("webhook-deliveries", kwargs={"pk": 99999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_webhook_event_choices_returns_list(self):
        url = reverse("webhook-events")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(len(response.data) > 0)
        self.assertIn("value", response.data[0])
        self.assertIn("label", response.data[0])

    def test_webhook_test_not_found(self):
        url = reverse("webhook-test", kwargs={"pk": 99999999})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("webhooks.tasks.deliver_webhook.delay")
    def test_webhook_test_enqueues_delivery(self, mock_delay):
        url = reverse("webhook-test", kwargs={"pk": self.webhook.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("delivery_id", response.data)
        mock_delay.assert_called_once()
