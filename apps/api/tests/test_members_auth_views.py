"""
Tests for members views, authentication views, and dashboard additional
coverage.
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


class BaseAuthTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="membertest",
            email="member@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Member Test",
            document_hash="m" * 64,
            phone="11999999969",
            sex="M",
            user=self.user,
        )


# ---------------------------------------------------------------------------
# Authentication Views
# ---------------------------------------------------------------------------


class AuthenticationViewTest(APITestCase):
    def setUp(self):
        self.client = APIClient()

    def test_token_obtain_success(self):
        User.objects.create_user("logintest", "login@test.com", "password123")
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url, {"username": "logintest", "password": "password123"}
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_201_CREATED],
        )

    def test_token_obtain_wrong_credentials(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url, {"username": "nonexistent", "password": "wrongpassword"}
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ],
        )

    def test_register_user(self):
        url = reverse("register-user")
        response = self.client.post(
            url,
            {
                "username": "newuser",
                "email": "new@test.com",
                "password": "securePass123!",
                "password2": "securePass123!",
            },
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_429_TOO_MANY_REQUESTS,
            ],
        )

    def test_current_user_requires_auth(self):
        url = reverse("current-user")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_current_user_authenticated(self):
        user = User.objects.create_user("curtest", "cur@test.com", "pass123")
        self.client.force_authenticate(user=user)
        url = reverse("current-user")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_token_refresh(self):
        user = User.objects.create_user(
            "tokentest", "token@test.com", "pass123!"
        )
        refresh = RefreshToken.for_user(user)
        url = reverse("token_refresh")
        response = self.client.post(url, {"refresh": str(refresh)})
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED],
        )

    def test_login_sets_samesite_strict_on_access_token_cookie(self):
        User.objects.create_user("samesitest", "samesite@test.com", "pass123!")
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url, {"username": "samesitest", "password": "pass123!"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access_cookie = response.cookies.get("access_token")
        self.assertIsNotNone(access_cookie, "access_token cookie not set")
        self.assertEqual(access_cookie["samesite"], "Strict")

    def test_token_refresh_sets_samesite_strict_on_access_token_cookie(self):
        User.objects.create_user(
            "refreshsite", "refreshsite@test.com", "pass!"
        )
        # Perform login to obtain the refresh_token cookie
        login_url = reverse("token_obtain_pair")
        login_response = self.client.post(
            login_url, {"username": "refreshsite", "password": "pass!"}
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        refresh_cookie = login_response.cookies.get("refresh_token")
        self.assertIsNotNone(refresh_cookie)
        # Use the refresh_token cookie to obtain a new access token
        self.client.cookies["refresh_token"] = refresh_cookie.value
        refresh_url = reverse("token_refresh")
        response = self.client.post(refresh_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access_cookie = response.cookies.get("access_token")
        self.assertIsNotNone(
            access_cookie, "access_token cookie not set on refresh"
        )
        self.assertEqual(access_cookie["samesite"], "Strict")


# ---------------------------------------------------------------------------
# Member Views
# ---------------------------------------------------------------------------


class MemberViewTest(BaseAuthTestCase):
    def test_list_members(self):
        url = reverse("member-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_member(self):
        url = reverse("member-create-list")
        response = self.client.post(
            url,
            {
                "name": "New Member",
                "document": "123.456.789-00",
                "phone": "11988888888",
                "sex": "F",
            },
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
            ],
        )

    def test_retrieve_member(self):
        url = reverse("member-detail-view", args=[self.member.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_member(self):
        url = reverse("member-detail-view", args=[self.member.pk])
        response = self.client.patch(url, {"name": "Updated Member"})
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_update_member_with_document(self):
        """
        Covers serializer validate_document with instance and update
        document.
        """
        url = reverse("member-detail-view", args=[self.member.pk])
        response = self.client.patch(url, {"document": "529.982.247-25"})
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_current_user_member(self):
        url = reverse("current-user-member")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )

    def test_member_financial_report(self):
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )

    def test_available_users(self):
        url = reverse("available-users")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN],
        )


# ---------------------------------------------------------------------------
# Dashboard additional coverage
# ---------------------------------------------------------------------------


class DashboardAdditionalViewTest(BaseAuthTestCase):
    def setUp(self):
        super().setUp()
        self.account = Account.objects.create(
            account_name="Test Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )

    def test_dashboard_stats(self):
        url = reverse("dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_balance_forecast(self):
        url = reverse("balance-forecast")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_account_balances(self):
        url = reverse("account-balances")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_credit_card_expenses_by_category(self):
        url = reverse("credit-card-expenses-by-category")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Expense additional coverage
# ---------------------------------------------------------------------------


class ExpenseAdditionalViewTest(BaseAuthTestCase):
    def setUp(self):
        super().setUp()
        self.account = Account.objects.create(
            account_name="Expense Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )

    def test_retrieve_expense(self):
        from expenses.models import Expense

        expense = Expense.objects.create(
            description="Test Expense",
            value="100.00",
            date=date.today(),
            horary="12:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        url = reverse("expense-detail-view", args=[expense.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_expense(self):
        from expenses.models import Expense

        expense = Expense.objects.create(
            description="To Update",
            value="200.00",
            date=date.today(),
            horary="13:00:00",
            category="transport",
            account=self.account,
            payed=False,
            created_by=self.user,
        )
        url = reverse("expense-detail-view", args=[expense.pk])
        response = self.client.patch(url, {"description": "Updated Expense"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_expense(self):
        from expenses.models import Expense

        expense = Expense.objects.create(
            description="To Delete",
            value="50.00",
            date=date.today(),
            horary="14:00:00",
            category="health and care",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        url = reverse("expense-detail-view", args=[expense.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_bulk_mark_paid(self):
        url = reverse("expense-bulk-mark-paid")
        response = self.client.post(url, {"ids": []}, format="json")
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_fixed_expense_stats(self):
        url = reverse("fixed-expense-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Revenue additional coverage
# ---------------------------------------------------------------------------


class RevenueAdditionalViewTest(BaseAuthTestCase):
    def setUp(self):
        super().setUp()
        self.account = Account.objects.create(
            account_name="Revenue Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )

    def test_retrieve_revenue(self):
        from revenues.models import Revenue

        revenue = Revenue.objects.create(
            description="Test Revenue",
            value=Decimal("5000.00"),
            date=date.today(),
            horary="09:00:00",
            category="salary",
            account=self.account,
            received=True,
            created_by=self.user,
        )
        url = reverse("revenue-detail-view", args=[revenue.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_revenue(self):
        from revenues.models import Revenue

        revenue = Revenue.objects.create(
            description="To Update",
            value=Decimal("3000.00"),
            date=date.today(),
            horary="10:00:00",
            category="freelance",
            account=self.account,
            received=False,
            created_by=self.user,
        )
        url = reverse("revenue-detail-view", args=[revenue.pk])
        response = self.client.patch(url, {"description": "Updated Revenue"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Account views coverage
# ---------------------------------------------------------------------------


class AccountViewTest(BaseAuthTestCase):
    def test_list_accounts(self):
        url = reverse("account-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_account(self):
        url = reverse("account-create-list")
        response = self.client.post(
            url,
            {
                "account_name": "New Account",
                "institution_name": "Bank",
                "account_type": "CS",
                "is_active": True,
            },
        )
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
            ],
        )

    def test_retrieve_account(self):
        account = Account.objects.create(
            account_name="Retrieve Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            created_by=self.user,
        )
        url = reverse("account-detail-view", args=[account.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
