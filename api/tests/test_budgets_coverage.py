"""
Tests for budgets/views.py: BudgetListCreateView, BudgetDetailView,
and BudgetStatusView with various status branches.
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member


class BaseBudgetTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="budgettest",
            email="budget@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Budget User",
            document_hash="b" * 64,
            phone="11988880005",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Budget Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("10000.00"),
        )


# ---------------------------------------------------------------------------
# Budget CRUD — create, list, retrieve, update, delete
# ---------------------------------------------------------------------------


class BudgetCRUDTest(BaseBudgetTestCase):
    def test_create_budget(self):
        """POST /budgets/ creates a budget and invokes perform_create."""
        url = reverse("budget-list-create")
        today = date.today()
        response = self.client.post(
            url,
            {
                "category": "food and drink",
                "limit_amount": "500.00",
                "month": today.month,
                "year": today.year,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["category"], "food and drink")
        self.assertEqual(response.data["month"], today.month)

    def test_list_budgets(self):
        """GET /budgets/ lists budgets."""
        url = reverse("budget-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)

    def test_retrieve_budget(self):
        """GET /budgets/<pk>/ retrieves a budget."""
        from budgets.models import Budget

        budget = Budget.objects.create(
            category="transport",
            limit_amount=Decimal("300.00"),
            month=date.today().month,
            year=date.today().year,
            created_by=self.user,
        )
        url = reverse("budget-detail", args=[budget.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["category"], "transport")

    def test_update_budget(self):
        """PATCH /budgets/<pk>/ updates a budget and invokes perform_update."""
        from budgets.models import Budget

        budget = Budget.objects.create(
            category="bills and services",
            limit_amount=Decimal("800.00"),
            month=date.today().month,
            year=date.today().year,
            created_by=self.user,
        )
        url = reverse("budget-detail", args=[budget.pk])
        response = self.client.patch(url, {"limit_amount": "900.00"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_budget(self):
        """DELETE /budgets/<pk>/ soft-deletes the budget via
        perform_destroy."""
        from budgets.models import Budget

        budget = Budget.objects.create(
            category="health and care",
            limit_amount=Decimal("200.00"),
            month=date.today().month,
            year=date.today().year,
            created_by=self.user,
        )
        url = reverse("budget-detail", args=[budget.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        budget.refresh_from_db()
        self.assertTrue(budget.is_deleted)


# ---------------------------------------------------------------------------
# BudgetStatusView — valid params, invalid params, status branches
# ---------------------------------------------------------------------------


class BudgetStatusViewTest(BaseBudgetTestCase):
    def setUp(self):
        super().setUp()
        today = date.today()
        self.month = today.month
        self.year = today.year
        from budgets.models import Budget
        from expenses.models import Expense

        # Budget for food (OK status — no expenses)
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("1000.00"),
            month=self.month,
            year=self.year,
            created_by=self.user,
        )
        # Budget for transport (exceeded status — add expenses > limit)
        Budget.objects.create(
            category="transport",
            limit_amount=Decimal("100.00"),
            month=self.month,
            year=self.year,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Bus fare",
            value=Decimal("150.00"),
            date=today,
            horary="08:00:00",
            category="transport",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        # Budget for health (warning status — add expense between
        # 80-100% of limit)
        Budget.objects.create(
            category="health and care",
            limit_amount=Decimal("200.00"),
            month=self.month,
            year=self.year,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Medicine",
            value=Decimal("170.00"),
            date=today,
            horary="09:00:00",
            category="health and care",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def test_budget_status_default(self):
        """GET /budgets/status/ returns status for current month."""
        url = reverse("budget-status")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        statuses = [b["status"] for b in response.data]
        # Should contain all three status types
        self.assertIn("ok", statuses)
        self.assertIn("exceeded", statuses)
        self.assertIn("warning", statuses)

    def test_budget_status_with_month_year_params(self):
        """GET /budgets/status/?month=X&year=Y filters by month/year."""
        url = reverse("budget-status")
        response = self.client.get(
            url, {"month": self.month, "year": self.year}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_budget_status_invalid_month_type(self):
        """GET /budgets/status/?month=abc returns 400 for non-integer month."""
        url = reverse("budget-status")
        response = self.client.get(url, {"month": "abc", "year": self.year})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_budget_status_month_out_of_range(self):
        """GET /budgets/status/?month=13 returns 400 for out-of-range month."""
        url = reverse("budget-status")
        response = self.client.get(url, {"month": 13, "year": self.year})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


# ---------------------------------------------------------------------------
# BudgetSerializer validate() — duplicate budget triggers ValidationError
# ---------------------------------------------------------------------------


class BudgetSerializerValidationTest(BaseBudgetTestCase):
    def test_create_duplicate_budget_returns_400(self):
        """
        Creating a budget with duplicate (category, month, year, member)
        triggers the qs.exists() branch in BudgetSerializer.validate().
        Covers budgets/serializers.py lines 31-35.
        """
        from budgets.models import Budget

        today = date.today()
        Budget.objects.create(
            category="supermarket",
            limit_amount=Decimal("400.00"),
            month=today.month,
            year=today.year,
            member=self.member,
            created_by=self.user,
        )
        # Try to create the same budget again via API
        url = reverse("budget-list-create")
        response = self.client.post(
            url,
            {
                "category": "supermarket",
                "limit_amount": "500.00",
                "month": today.month,
                "year": today.year,
                "member": self.member.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# BudgetHistoryView — history endpoint
# ---------------------------------------------------------------------------


class BudgetHistoryViewTest(BaseBudgetTestCase):
    def setUp(self):
        super().setUp()
        from budgets.models import Budget
        from expenses.models import Expense

        today = date.today()
        self.month = today.month
        self.year = today.year

        # Budget for current month
        self.budget = Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("1000.00"),
            month=self.month,
            year=self.year,
            created_by=self.user,
        )
        # Paid expense for the same category/month
        Expense.objects.create(
            description="Groceries",
            value=Decimal("400.00"),
            date=today,
            horary="10:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def test_history_returns_months_list(self):
        """GET /budgets/history/?category=food+and+drink returns N data
        points."""
        url = reverse("budget-history")
        response = self.client.get(
            url, {"category": "food and drink", "months": 6}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 6)

    def test_history_contains_correct_fields(self):
        """Each history item has month, year, limit_amount, actual_spent,
        percentage."""
        url = reverse("budget-history")
        response = self.client.get(
            url, {"category": "food and drink", "months": 3}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = response.data[-1]  # most recent month
        self.assertIn("month", item)
        self.assertIn("year", item)
        self.assertIn("actual_spent", item)
        self.assertIn("percentage", item)

    def test_history_current_month_has_expense(self):
        """The current month entry shows the paid expense total."""
        url = reverse("budget-history")
        response = self.client.get(
            url, {"category": "food and drink", "months": 1}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        item = response.data[0]
        self.assertEqual(item["month"], self.month)
        self.assertEqual(item["year"], self.year)
        self.assertEqual(Decimal(item["actual_spent"]), Decimal("400.00"))
        self.assertEqual(Decimal(item["limit_amount"]), Decimal("1000.00"))
        self.assertAlmostEqual(item["percentage"], 40.0, places=1)

    def test_history_missing_category_returns_400(self):
        """GET /budgets/history/ without category returns 400."""
        url = reverse("budget-history")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_history_invalid_months_returns_400(self):
        """GET /budgets/history/?months=abc returns 400."""
        url = reverse("budget-history")
        response = self.client.get(
            url, {"category": "food and drink", "months": "abc"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_history_months_clamped_to_max(self):
        """months > 24 is clamped to 24."""
        url = reverse("budget-history")
        response = self.client.get(
            url, {"category": "food and drink", "months": 100}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 24)

    def test_history_null_limit_when_no_budget(self):
        """Months without a budget have limit_amount=null."""
        url = reverse("budget-history")
        response = self.client.get(
            url, {"category": "food and drink", "months": 3}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # First two months should have no budget (only current month has one)
        older_months = [
            item
            for item in response.data
            if not (item["month"] == self.month and item["year"] == self.year)
        ]
        for item in older_months:
            self.assertIsNone(item["limit_amount"])
            self.assertEqual(item["percentage"], 0.0)


# ---------------------------------------------------------------------------
# AccountSerializer — create/update with account_number field
# ---------------------------------------------------------------------------


class AccountSerializerCoverageTest(BaseBudgetTestCase):
    def test_create_account_with_account_number(self):
        """
        Creating an account with account_number covers
        accounts/serializers.py lines 49-51 (encrypt + save).
        """
        url = reverse("account-create-list")
        response = self.client.post(
            url,
            {
                "account_name": "Number Account",
                "institution": "NUB",
                "account_type": "CS",
                "is_active": True,
                "current_balance": "1000.00",
                "account_number": "123456789",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_update_account_with_account_number(self):
        """
        Updating an account with account_number covers
        accounts/serializers.py lines 57-59 (encrypt + save).
        """
        create_url = reverse("account-create-list")
        create_resp = self.client.post(
            create_url,
            {
                "account_name": "Update Num Account",
                "institution": "NUB",
                "account_type": "CS",
                "is_active": True,
                "current_balance": "2000.00",
            },
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        pk = create_resp.data["id"]
        update_url = reverse("account-detail-view", args=[pk])
        response = self.client.patch(
            update_url, {"account_number": "987654321"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
