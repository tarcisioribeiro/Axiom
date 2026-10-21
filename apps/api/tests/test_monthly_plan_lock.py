"""Edição de mês futuro e relançamento de mês passado já aplicado."""

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from monthly_planning.models import MonthlyPlan


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    index = (year * 12 + (month - 1)) + delta
    return index // 12, index % 12 + 1


class MonthlyPlanLockTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="planner-lock",
            email="planner-lock@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        today = timezone.localdate()
        self.current_year, self.current_month = today.year, today.month
        self.future_year, self.future_month = _shift_month(
            self.current_year, self.current_month, 1
        )
        self.past_year, self.past_month = _shift_month(
            self.current_year, self.current_month, -1
        )

    def _patch(self, plan: MonthlyPlan):
        return self.client.patch(
            reverse("monthly-plan-detail", args=[plan.pk]),
            {"extra_revenues": [{"description": "x", "value": "1"}]},
            format="json",
        )

    def test_current_month_is_editable(self):
        plan = MonthlyPlan.objects.create(
            month=self.current_month,
            year=self.current_year,
            created_by=self.user,
        )
        self.assertEqual(self._patch(plan).status_code, status.HTTP_200_OK)

    def test_future_month_cannot_be_edited(self):
        plan = MonthlyPlan.objects.create(
            month=self.future_month,
            year=self.future_year,
            created_by=self.user,
        )
        self.assertEqual(
            self._patch(plan).status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_future_month_cannot_be_applied(self):
        plan = MonthlyPlan.objects.create(
            month=self.future_month,
            year=self.future_year,
            created_by=self.user,
        )
        response = self.client.post(
            reverse("monthly-plan-apply", args=[plan.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_past_month_not_yet_applied_is_editable(self):
        plan = MonthlyPlan.objects.create(
            month=self.past_month, year=self.past_year, created_by=self.user
        )
        self.assertEqual(self._patch(plan).status_code, status.HTTP_200_OK)

    def test_past_month_already_applied_cannot_be_edited(self):
        plan = MonthlyPlan.objects.create(
            month=self.past_month,
            year=self.past_year,
            created_by=self.user,
            applied_at=timezone.now(),
        )
        self.assertEqual(
            self._patch(plan).status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_past_month_already_applied_can_still_be_reapplied(self):
        """Relançar um mês passado permanece liberado — é a forma de corrigir
        itens ainda não liquidados; cada item já se protege via "settled"."""
        plan = MonthlyPlan.objects.create(
            month=self.past_month,
            year=self.past_year,
            created_by=self.user,
            applied_at=timezone.now(),
        )
        response = self.client.post(
            reverse("monthly-plan-apply", args=[plan.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_summary_reports_lock_reason(self):
        response = self.client.get(
            reverse("monthly-plan-summary"),
            {"month": self.future_month, "year": self.future_year},
        )
        self.assertEqual(response.data["lock_reason"], "future")
