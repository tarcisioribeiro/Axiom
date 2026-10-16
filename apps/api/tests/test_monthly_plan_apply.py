"""Aplicar Plano respeita a tela do planejador e a prévia mostra o mesmo."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from budgets.models import Budget
from expenses.models import Expense, FixedExpense
from monthly_planning.models import MonthlyPlan
from revenues.models import FixedRevenue, Revenue


class MonthlyPlanApplyTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="planner",
            email="planner@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.account = Account.objects.create(
            account_name="Conta",
            institution_name="Banco",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("10000.00"),
            created_by=self.user,
        )
        common = {
            "account": self.account,
            "is_active": True,
            "created_by": self.user,
            "updated_by": self.user,
        }
        self.salary = FixedRevenue.objects.create(
            description="Salário",
            default_value=Decimal("5000.00"),
            category="salary",
            due_day=5,
            **common,
        )
        self.bonus = FixedRevenue.objects.create(
            description="Bônus",
            default_value=Decimal("800.00"),
            category="salary",
            due_day=10,
            **common,
        )
        self.rent = FixedExpense.objects.create(
            description="Aluguel",
            default_value=Decimal("1500.00"),
            category="house",
            due_day=8,
            **common,
        )
        self.gym = FixedExpense.objects.create(
            description="Academia",
            default_value=Decimal("120.00"),
            category="health and care",
            due_day=8,
            **common,
        )
        self.plan = MonthlyPlan.objects.create(
            month=7,
            year=2026,
            created_by=self.user,
            fixed_revenue_overrides={
                str(self.salary.id): {"enabled": True, "value": "5200.00"},
                str(self.bonus.id): {"enabled": False},
            },
            fixed_expense_overrides={str(self.gym.id): {"enabled": False}},
            budget_overrides={"food and drink": "300", "entertainment": "100"},
            budget_disabled_categories=["entertainment"],
        )

    def _preview(self):
        return self.client.get(
            reverse("monthly-plan-apply-preview", args=[self.plan.pk])
        )

    def _apply(self):
        return self.client.post(
            reverse("monthly-plan-apply", args=[self.plan.pk])
        )

    def test_preview_skips_unchecked_items_and_uses_adjusted_values(self):
        response = self._preview()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        revenues = response.data["revenues"]
        self.assertEqual([r["id"] for r in revenues], [self.salary.id])
        self.assertEqual(revenues[0]["value"], Decimal("5200.00"))
        self.assertEqual(revenues[0]["action"], "create")
        self.assertEqual(
            [e["id"] for e in response.data["expenses"]], [self.rent.id]
        )
        self.assertEqual(
            [b["category"] for b in response.data["budgets"]],
            ["food and drink"],
        )
        self.assertEqual(
            response.data["totals"]["revenues"], Decimal("5200.00")
        )

    def test_apply_launches_exactly_what_the_preview_shows(self):
        self.assertEqual(self._apply().status_code, status.HTTP_200_OK)
        # A conta gera receita de saldo inicial; só contam as de modelo fixo.
        revenues = Revenue.objects.filter(
            is_deleted=False, fixed_revenue_template__isnull=False
        )
        self.assertEqual(
            list(revenues.values_list("fixed_revenue_template", "value")),
            [(self.salary.id, Decimal("5200.00"))],
        )
        self.assertEqual(
            list(
                Expense.objects.filter(is_deleted=False).values_list(
                    "fixed_expense_template", flat=True
                )
            ),
            [self.rent.id],
        )
        self.assertEqual(
            list(Budget.objects.values_list("category", flat=True)),
            ["food and drink"],
        )

    def test_reapply_does_not_change_settled_launches(self):
        self._apply()
        revenue = Revenue.objects.get(fixed_revenue_template=self.salary)
        revenue.received = True
        revenue.save(update_fields=["received"])
        self.plan.refresh_from_db()
        self.plan.fixed_revenue_overrides[str(self.salary.id)][
            "value"
        ] = "9999.00"
        self.plan.save(update_fields=["fixed_revenue_overrides"])

        preview = self._preview().data
        self.assertTrue(preview["is_reapply"])
        self.assertEqual(preview["revenues"][0]["action"], "settled")
        self._apply()
        revenue.refresh_from_db()
        self.assertEqual(revenue.value, Decimal("5200.00"))

    def test_preview_of_another_users_plan_is_not_found(self):
        other = User.objects.create_user(username="other", password="x")
        plan = MonthlyPlan.objects.create(month=7, year=2026, created_by=other)
        response = self.client.get(
            reverse("monthly-plan-apply-preview", args=[plan.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
