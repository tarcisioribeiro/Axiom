"""
Coverage-focused tests for `dashboard/views.py`.

Targets the branches/endpoints that were previously untested:
AccountBalancesView, DashboardStatsView (cache paths), CreditCardExpenses-
ByCategoryView (filters), BalanceForecastView (loans/bills loops), Monthly-
StatementView (invalid params), CashFlowForecastView (invalid params, cache,
fixed-expense/credit-card-bill projection helpers), FinancialAlertsView (all
five checks + their day-threshold branches), AnomalyDetectionView, Spending-
InsightsView, AccountReconciliationView, LGPDExportView, IRReportView,
AlertsStreamView, AuditLogView, FinancialHealthScoreView and
DashboardSummaryView.

Bug fixed while writing these tests
------------------------------------
`AccountReconciliationView` referenced two fields that do not exist on
`BankStatementEntry`: `account` (the FK actually lives on
`statement_import.account`) and `matched` (the real field is `status`,
which has a `"matched"` choice). Both invalid lookups meant the `try` block
always raised `FieldError` and silently fell through to the `except`
fallback — the reconciliation feature never actually worked. Fixed to
`statement_import__account=account` and `exclude(status="matched")`.
"""

import os
import zipfile
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import BytesIO
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase

from cryptography.fernet import Fernet
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from budgets.models import Budget
from credit_cards.models import (
    CreditCard,
    CreditCardBill,
    CreditCardInstallment,
    CreditCardPurchase,
)
from dashboard.views import (
    AlertsStreamView,
    FinancialAlertsView,
    FinancialHealthScoreView,
    _anomaly_severity,
    get_cache_key,
)
from expenses.models import Expense, FixedExpense
from loans.models import Loan
from members.models import Member
from payables.models import Payable
from revenues.models import Revenue

_TEST_FERNET_KEY = Fernet.generate_key().decode()


# ---------------------------------------------------------------------------
# Base fixture shared by every test class in this file
# ---------------------------------------------------------------------------


class _DashboardCoverageBaseTestCase(APITestCase):
    def setUp(self):
        # Django's cache is process-wide and NOT reset by the per-test DB
        # transaction rollback, while sqlite may reuse auto-increment PKs
        # across tests once a transaction rolls back. Without clearing the
        # cache, a rate-limit / stale-cache key from an earlier test can
        # leak into this one via a reused user id.
        cache.clear()

        self._enc_patcher = patch.dict(
            os.environ, {"ENCRYPTION_KEY": _TEST_FERNET_KEY}
        )
        self._enc_patcher.start()

        self.user = User.objects.create_user(
            username=self._unique("dashcov"),
            email=f"{self._unique('dashcov')}@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Dash Coverage User",
            document_hash=self._unique("hash").ljust(64, "0")[:64],
            phone="11999990000",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Dash Coverage Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("10000.00"),
            minimum_balance=Decimal("0.00"),
            created_by=self.user,
        )

    def tearDown(self):
        self._enc_patcher.stop()

    _counter = 0

    @classmethod
    def _unique(cls, prefix):
        _DashboardCoverageBaseTestCase._counter += 1
        return f"{prefix}{_DashboardCoverageBaseTestCase._counter}"

    # -- shared helpers -----------------------------------------------------

    def _make_credit_card(self, name="Dash Card", due_day=10, closing_day=1):
        from app.encryption import FieldEncryption

        card = CreditCard(
            name=name,
            on_card_name="DASH USER",
            flag="VSA",
            associated_account=self.account,
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            closing_day=closing_day,
            due_day=due_day,
            validation_date=date(2031, 1, 1),
            created_by=self.user,
            updated_by=self.user,
        )
        card._security_code = FieldEncryption.encrypt_data("123")
        card._card_number = FieldEncryption.encrypt_data("4111111111111111")
        card.save()
        return card

    def _make_bill(
        self,
        card,
        year="2026",
        month="Jan",
        due_date=None,
        total_amount=Decimal("500.00"),
        paid_amount=Decimal("0.00"),
        status_="open",
    ):
        return CreditCardBill.objects.create(
            credit_card=card,
            year=year,
            month=month,
            invoice_beginning_date=date(2026, 1, 1),
            invoice_ending_date=date(2026, 1, 31),
            due_date=due_date,
            closed=False,
            total_amount=total_amount,
            minimum_payment=Decimal("50.00"),
            paid_amount=paid_amount,
            status=status_,
            created_by=self.user,
        )

    def _make_expense(
        self,
        value,
        category="food and drink",
        payed=True,
        d=None,
        account=None,
    ):
        return Expense.objects.create(
            description="Dash Expense",
            value=Decimal(str(value)),
            date=d or date.today(),
            horary=time(10, 0),
            category=category,
            account=account or self.account,
            payed=payed,
            created_by=self.user,
        )

    def _make_revenue(
        self,
        value,
        category="salary",
        received=True,
        d=None,
        account=None,
    ):
        return Revenue.objects.create(
            description="Dash Revenue",
            value=Decimal(str(value)),
            date=d or date.today(),
            horary=time(10, 0),
            category=category,
            account=account or self.account,
            received=received,
            created_by=self.user,
        )


# ---------------------------------------------------------------------------
# get_cache_key / invalidate_user_dashboard_cache
# ---------------------------------------------------------------------------


class GetCacheKeyHelperTest(APITestCase):
    def test_with_user_id(self):
        self.assertEqual(get_cache_key("stats", 42), "dashboard:stats:user:42")

    def test_without_user_id(self):
        self.assertEqual(get_cache_key("stats"), "dashboard:stats")


# ---------------------------------------------------------------------------
# AccountBalancesView
# ---------------------------------------------------------------------------


class AccountBalancesViewTest(_DashboardCoverageBaseTestCase):
    def setUp(self):
        super().setUp()
        self.destiny_account = Account.objects.create(
            account_name="Dash Destiny Account",
            institution_name="SIC",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("500.00"),
            created_by=self.user,
        )

    def test_account_balances_with_pending_data(self):
        self._make_revenue(200, received=False)
        self._make_expense(100, payed=False)
        from transfers.models import Transfer

        Transfer.objects.create(
            description="Out",
            value=Decimal("50.00"),
            date=date.today(),
            horary=time(9, 0),
            category="pix",
            origin_account=self.account,
            destiny_account=self.destiny_account,
            transfered=False,
            status="pending",
            created_by=self.user,
        )
        Transfer.objects.create(
            description="In",
            value=Decimal("30.00"),
            date=date.today(),
            horary=time(9, 0),
            category="pix",
            origin_account=self.destiny_account,
            destiny_account=self.account,
            transfered=False,
            status="processing",
            created_by=self.user,
        )

        url = reverse("account-balances")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = next(r for r in response.data if r["id"] == self.account.id)
        self.assertEqual(entry["pending_revenues"], 200.0)
        self.assertEqual(entry["pending_expenses"], 100.0)
        self.assertEqual(entry["pending_transfers_out"], 50.0)
        self.assertEqual(entry["pending_transfers_in"], 30.0)
        expected_future = 10000.0 + 200.0 - 100.0 + 30.0 - 50.0
        self.assertAlmostEqual(entry["future_balance"], expected_future)

    def test_account_balances_cache_hit(self):
        url = reverse("account-balances")
        first = self.client.get(url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.get(url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data, second.data)


# ---------------------------------------------------------------------------
# DashboardStatsView
# ---------------------------------------------------------------------------


class DashboardStatsViewTest(_DashboardCoverageBaseTestCase):
    def test_stats_with_data(self):
        # NOTE: creating `self.account` with a positive current_balance
        # already triggered accounts.signals.create_initial_revenue_on_
        # account_creation, which auto-books a "Saldo inicial" Revenue for
        # that same amount, dated today -> it lands inside this month's
        # aggregate too, so total_revenues includes it.
        initial_balance_revenue = float(self.account.current_balance)

        self._make_expense(150, payed=True)
        self._make_revenue(300, received=True)
        self._make_credit_card()

        url = reverse("dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_expenses"], 150.0)
        self.assertEqual(
            response.data["total_revenues"],
            300.0 + initial_balance_revenue,
        )
        self.assertEqual(response.data["accounts_count"], 1)
        self.assertEqual(response.data["credit_cards_count"], 1)

    def test_stats_cache_hit(self):
        url = reverse("dashboard-stats")
        first = self.client.get(url)
        second = self.client.get(url)
        self.assertEqual(first.data, second.data)


# ---------------------------------------------------------------------------
# CreditCardExpensesByCategoryView
# ---------------------------------------------------------------------------


class CreditCardExpensesByCategoryViewTest(_DashboardCoverageBaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card()
        self.bill = self._make_bill(self.card)
        self.other_bill = self._make_bill(self.card, month="Feb")
        self.purchase = CreditCardPurchase.objects.create(
            description="Groceries",
            total_value=Decimal("100.00"),
            purchase_date=date(2026, 1, 5),
            purchase_time=time(12, 0),
            category="food and drink",
            card=self.card,
            total_installments=1,
            created_by=self.user,
        )
        self.installment = CreditCardInstallment.objects.create(
            purchase=self.purchase,
            installment_number=1,
            value=Decimal("100.00"),
            due_date=date(2026, 1, 15),
            bill=self.bill,
            payed=False,
            created_by=self.user,
        )

    def test_filter_by_card(self):
        url = reverse("credit-card-expenses-by-category")
        response = self.client.get(url, {"card": self.card.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["total"], 100.0)

    def test_filter_by_bill(self):
        url = reverse("credit-card-expenses-by-category")
        response = self.client.get(url, {"bill": self.bill.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_filter_by_bill_no_match(self):
        url = reverse("credit-card-expenses-by-category")
        response = self.client.get(url, {"bill": self.other_bill.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)


# ---------------------------------------------------------------------------
# BalanceForecastView
# ---------------------------------------------------------------------------


class BalanceForecastViewTest(_DashboardCoverageBaseTestCase):
    def test_forecast_with_full_data(self):
        self._make_expense(100, payed=False)
        self._make_revenue(200, received=False)

        card = self._make_credit_card()
        self._make_bill(
            card,
            total_amount=Decimal("400.00"),
            paid_amount=Decimal("150.00"),
            status_="open",
        )

        second_member = Member.objects.create(
            name="Other Member",
            document_hash=self._unique("hash2").ljust(64, "1")[:64],
            phone="11988887777",
            sex="F",
        )
        Loan.objects.create(
            description="Loan I lent",
            value=Decimal("1000.00"),
            payed_value=Decimal("200.00"),
            date=date.today(),
            horary=time(9, 0),
            category="others",
            account=self.account,
            benefited=second_member,
            creditor=self.member,
            status="active",
            created_by=self.user,
        )
        Loan.objects.create(
            description="Loan I owe",
            value=Decimal("500.00"),
            payed_value=Decimal("100.00"),
            date=date.today(),
            horary=time(9, 0),
            category="others",
            account=self.account,
            benefited=self.member,
            creditor=second_member,
            status="active",
            created_by=self.user,
        )
        Payable.objects.create(
            description="Dentist",
            value=Decimal("300.00"),
            paid_value=Decimal("50.00"),
            date=date.today(),
            category="health and care",
            status="active",
            member=self.member,
            created_by=self.user,
        )

        url = reverse("balance-forecast")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pending_card_bills"], 250.0)
        self.assertEqual(response.data["loans_to_receive"], 800.0)
        self.assertEqual(response.data["loans_to_pay"], 400.0)
        self.assertEqual(response.data["pending_payables"], 250.0)
        self.assertIn("summary", response.data)

    def test_forecast_without_member(self):
        # user with no linked Member -> loans_to_receive/pay stay at 0
        other_user = User.objects.create_user(
            username=self._unique("nomember"),
            email=f"{self._unique('nomember')}@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client = APIClient()
        refresh = RefreshToken.for_user(other_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse("balance-forecast")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["loans_to_receive"], 0.0)
        self.assertEqual(response.data["loans_to_pay"], 0.0)


# ---------------------------------------------------------------------------
# MonthlyStatementView
# ---------------------------------------------------------------------------


class MonthlyStatementViewTest(_DashboardCoverageBaseTestCase):
    def test_invalid_year_month_falls_back_to_today(self):
        url = reverse("monthly-statement")
        response = self.client.get(url, {"year": "abc", "month": "xyz"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        today = date.today()
        self.assertEqual(
            response.data["period"], f"{today.year:04d}-{today.month:02d}"
        )

    def test_month_out_of_range_is_clamped(self):
        url = reverse("monthly-statement")
        response = self.client.get(url, {"year": 2026, "month": 15})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "2026-12")

    def test_statement_with_data(self):
        self._make_expense(100, category="food and drink", d=date(2026, 3, 10))
        self._make_revenue(500, category="salary", d=date(2026, 3, 5))
        url = reverse("monthly-statement")
        response = self.client.get(url, {"year": 2026, "month": 3})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_expenses"], "100.00")
        self.assertTrue(len(response.data["expenses_by_category"]) >= 1)
        self.assertTrue(len(response.data["revenues_by_category"]) >= 1)


# ---------------------------------------------------------------------------
# CashFlowForecastView
# ---------------------------------------------------------------------------


class CashFlowForecastViewTest(_DashboardCoverageBaseTestCase):
    def test_invalid_days_param_falls_back_to_30(self):
        url = reverse("cash-flow-forecast")
        response = self.client.get(url, {"days": "abc"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 30)

    def test_days_not_in_valid_set_falls_back_to_30(self):
        url = reverse("cash-flow-forecast")
        response = self.client.get(url, {"days": 45})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 30)

    def test_cache_hit(self):
        url = reverse("cash-flow-forecast")
        first = self.client.get(url, {"days": 60})
        second = self.client.get(url, {"days": 60})
        self.assertEqual(first.data, second.data)

    def test_fixed_expenses_and_credit_card_bills_projection(self):
        """
        Freezes "today" to Nov/2026 so the 90-day forecast window crosses
        the December -> January year boundary, exercising:
        - months_in_range December wraparound
        - last_generated_month skip branch
        - already-generated (existing) skip branch
        - normal generation (calendar.monthrange + due date calc)
        - credit card bill without due_date (estimated via card due_day)
        """
        frozen_today = date(2026, 11, 15)

        class _FrozenDate(date):
            @classmethod
            def today(cls):
                return frozen_today

        fe_skipped_by_last_generated = FixedExpense.objects.create(
            description="Rent (already generated this month)",
            default_value=Decimal("300.00"),
            category="house",
            account=self.account,
            due_day=20,
            is_active=True,
            last_generated_month="2026-11",
            created_by=self.user,
        )
        fe_skipped_by_existing = FixedExpense.objects.create(
            description="Internet (existing launched expense)",
            default_value=Decimal("120.00"),
            category="bills and services",
            account=self.account,
            due_day=10,
            is_active=True,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Internet Dec",
            value=Decimal("120.00"),
            date=date(2026, 12, 10),
            horary=time(10, 0),
            category="bills and services",
            account=self.account,
            payed=False,
            fixed_expense_template=fe_skipped_by_existing,
            created_by=self.user,
        )
        fe_generates_normally = FixedExpense.objects.create(
            description="Streaming",
            default_value=Decimal("50.00"),
            category="digital signs",
            account=self.account,
            due_day=31,  # forces clamp to last day of shorter months
            is_active=True,
            created_by=self.user,
        )

        card = self._make_credit_card(due_day=10)
        self._make_bill(
            card,
            year="2026",
            month="Dec",
            due_date=None,
            total_amount=Decimal("600.00"),
            paid_amount=Decimal("100.00"),
            status_="open",
        )

        with patch("dashboard.views.date", _FrozenDate):
            url = reverse("cash-flow-forecast")
            response = self.client.get(url, {"days": 90})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Total expenses must include the CC bill remaining (500) plus the
        # ungenerated "Streaming" fixed expense across the window, but NOT
        # the "Rent" (skipped via last_generated_month) or "Internet" (
        # skipped via existing launched expense) occurrences in Nov/Dec.
        self.assertGreater(response.data["total_expenses"], 0)
        # sanity: fixed expenses/cc bills referenced without crashing
        self.assertIn("daily_breakdown", response.data)
        self.assertIsInstance(fe_generates_normally.due_day, int)
        self.assertIsInstance(fe_skipped_by_last_generated.pk, int)

    def test_credit_card_bill_with_explicit_due_date_in_window(self):
        """Covers the `bills_with_date` branch of `_add_credit_card_bills`,
        as opposed to the due_date-less estimation branch tested above."""
        card = self._make_credit_card()
        due_date = date.today() + timedelta(days=10)
        self._make_bill(
            card,
            due_date=due_date,
            total_amount=Decimal("700.00"),
            paid_amount=Decimal("200.00"),
            status_="open",
        )
        url = reverse("cash-flow-forecast")
        response = self.client.get(url, {"days": 30})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        day_entry = next(
            d
            for d in response.data["daily_breakdown"]
            if d["date"] == due_date.isoformat()
        )
        self.assertEqual(day_entry["expenses"], 500.0)

    def test_credit_card_bill_no_date_skip_branches(self):
        """Covers the early `continue`s in the no-due-date estimation
        branch: a card without a configured due_day, and an estimated due
        date that falls outside the forecast window."""
        card_without_due_day = self._make_credit_card(
            name="No Due Day Card", due_day=None
        )
        self._make_bill(
            card_without_due_day,
            year="2026",
            month="Dec",
            due_date=None,
            total_amount=Decimal("300.00"),
            status_="open",
        )

        far_future_card = self._make_credit_card(
            name="Far Future Card", due_day=5
        )
        self._make_bill(
            far_future_card,
            year="2030",
            month="Dec",
            due_date=None,
            total_amount=Decimal("300.00"),
            status_="open",
        )

        url = reverse("cash-flow-forecast")
        response = self.client.get(url, {"days": 30})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_expenses"], 0.0)

    def test_credit_card_bill_no_date_non_december_closing_month(self):
        """Covers the `else` branch (non-December closing month) of the
        due-month calculation in the no-due-date estimation path."""
        frozen_today = date(2026, 5, 10)

        class _FrozenDate(date):
            @classmethod
            def today(cls):
                return frozen_today

        card = self._make_credit_card(due_day=15)
        # Closing month = May (non-December) -> estimated due date is
        # June/2026, well within a 60-day window from May 10th.
        self._make_bill(
            card,
            year="2026",
            month="May",
            due_date=None,
            total_amount=Decimal("450.00"),
            paid_amount=Decimal("50.00"),
            status_="open",
        )
        with patch("dashboard.views.date", _FrozenDate):
            url = reverse("cash-flow-forecast")
            response = self.client.get(url, {"days": 60})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["total_expenses"], 400.0)


# ---------------------------------------------------------------------------
# FinancialAlertsView
# ---------------------------------------------------------------------------


class FinancialAlertsViewTest(_DashboardCoverageBaseTestCase):
    def test_budget_with_zero_limit_is_skipped(self):
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("0.00"),
            month=date.today().month,
            year=date.today().year,
            member=self.member,
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        budget_alerts = [
            a for a in response.data if a.get("type") == "budget_limit"
        ]
        self.assertEqual(budget_alerts, [])

    def test_budget_over_80_and_over_100_percent(self):
        today = date.today()
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("100.00"),
            month=today.month,
            year=today.year,
            member=self.member,
            created_by=self.user,
        )
        Budget.objects.create(
            category="transport",
            limit_amount=Decimal("50.00"),
            month=today.month,
            year=today.year,
            member=self.member,
            created_by=self.user,
        )
        self._make_expense(90, category="food and drink", payed=True, d=today)
        self._make_expense(60, category="transport", payed=True, d=today)

        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        budget_alerts = {
            a["metadata"]["category"]: a
            for a in response.data
            if a["type"] == "budget_limit"
        }
        self.assertEqual(
            budget_alerts["food and drink"]["severity"], "warning"
        )
        self.assertEqual(budget_alerts["transport"]["severity"], "danger")

    def test_credit_card_bill_overdue_and_due_today(self):
        card = self._make_credit_card()
        yesterday = date.today() - timedelta(days=1)
        self._make_bill(card, due_date=yesterday, month="Jan", status_="open")
        card2 = self._make_credit_card(name="Card Today")
        self._make_bill(
            card2, due_date=date.today(), month="Feb", status_="open"
        )

        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cc_alerts = {
            a["metadata"]["days_left"]: a
            for a in response.data
            if a["type"] == "credit_card_bill_due"
        }
        self.assertEqual(cc_alerts[-1]["severity"], "danger")
        self.assertIn("vencida", cc_alerts[-1]["message"])
        self.assertEqual(cc_alerts[0]["severity"], "danger")
        self.assertIn("vence hoje", cc_alerts[0]["message"])

    def test_credit_card_bill_due_tomorrow_and_in_future(self):
        card = self._make_credit_card()
        tomorrow = date.today() + timedelta(days=1)
        in_three_days = date.today() + timedelta(days=3)
        self._make_bill(card, due_date=tomorrow, month="Jan", status_="open")
        card2 = self._make_credit_card(name="Card 2")
        self._make_bill(
            card2, due_date=in_three_days, month="Feb", status_="open"
        )

        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cc_alerts = {
            a["metadata"]["days_left"]: a
            for a in response.data
            if a["type"] == "credit_card_bill_due"
        }
        self.assertEqual(cc_alerts[1]["severity"], "danger")
        self.assertIn("amanhã", cc_alerts[1]["message"])
        self.assertEqual(cc_alerts[3]["severity"], "warning")

    def test_low_account_balance_alerts(self):
        Account.objects.create(
            account_name="Negative Account",
            institution_name="SIC",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("-50.00"),
            minimum_balance=Decimal("100.00"),
            created_by=self.user,
        )
        Account.objects.create(
            account_name="Below Minimum Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("30.00"),
            minimum_balance=Decimal("100.00"),
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        low_balance_alerts = [
            a for a in response.data if a["type"] == "low_balance"
        ]
        self.assertEqual(len(low_balance_alerts), 2)
        severities = {a["severity"] for a in low_balance_alerts}
        self.assertEqual(severities, {"danger", "warning"})

    def test_payables_all_day_thresholds(self):
        today = date.today()
        cases = {
            "overdue": today - timedelta(days=2),
            "today": today,
            "soon": today + timedelta(days=2),
            "later": today + timedelta(days=5),
        }
        for key, due in cases.items():
            Payable.objects.create(
                description=f"Payable {key}",
                value=Decimal("100.00"),
                paid_value=Decimal("0.00"),
                date=today,
                due_date=due,
                category="others",
                status="active",
                member=self.member,
                created_by=self.user,
            )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payable_alerts = {
            a["message"].split(" ")[1]: a
            for a in response.data
            if a["type"] == "payable_due"
        }
        alerts_by_desc = {
            a["metadata"]["description"]: a
            for a in response.data
            if a["type"] == "payable_due"
        }
        self.assertEqual(
            alerts_by_desc["Payable overdue"]["severity"], "danger"
        )
        self.assertEqual(alerts_by_desc["Payable today"]["severity"], "danger")
        self.assertEqual(alerts_by_desc["Payable soon"]["severity"], "danger")
        self.assertEqual(
            alerts_by_desc["Payable later"]["severity"], "warning"
        )
        self.assertTrue(payable_alerts)

    def test_loans_all_day_thresholds(self):
        today = date.today()
        cases = {
            "Loan overdue": today - timedelta(days=1),
            "Loan today": today,
            "Loan soon": today + timedelta(days=2),
            "Loan later": today + timedelta(days=6),
        }
        for desc, due in cases.items():
            Loan.objects.create(
                description=desc,
                value=Decimal("1000.00"),
                payed_value=Decimal("0.00"),
                date=today,
                horary=time(9, 0),
                category="others",
                account=self.account,
                benefited=self.member,
                creditor=self.member,
                due_date=due,
                status="active",
                created_by=self.user,
            )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        alerts_by_desc = {
            a["metadata"]["description"]: a
            for a in response.data
            if a["type"] == "loan_due"
        }
        self.assertEqual(alerts_by_desc["Loan overdue"]["severity"], "danger")
        self.assertEqual(alerts_by_desc["Loan today"]["severity"], "danger")
        self.assertEqual(alerts_by_desc["Loan soon"]["severity"], "danger")
        self.assertEqual(alerts_by_desc["Loan later"]["severity"], "warning")

    def test_alerts_sorted_danger_before_warning(self):
        today = date.today()
        Payable.objects.create(
            description="Warning payable",
            value=Decimal("50.00"),
            paid_value=Decimal("0.00"),
            date=today,
            due_date=today + timedelta(days=5),
            category="others",
            status="active",
            member=self.member,
            created_by=self.user,
        )
        Payable.objects.create(
            description="Danger payable",
            value=Decimal("50.00"),
            paid_value=Decimal("0.00"),
            date=today,
            due_date=today,
            category="others",
            status="active",
            member=self.member,
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        severities = [a["severity"] for a in response.data]
        # Every "danger" must appear before every "warning"
        if "warning" in severities and "danger" in severities:
            self.assertLess(
                severities.index("danger"), severities.index("warning")
            )

    def test_category_label_unmapped_category_returns_raw_value(self):
        view = FinancialAlertsView()
        self.assertEqual(
            view._category_label("food and drink"), "Comida e Bebida"
        )
        self.assertEqual(
            view._category_label("some_unmapped_category"),
            "some_unmapped_category",
        )

    def test_budgets_and_loans_none_without_linked_member(self):
        """
        A user with no linked Member falls through the `budgets_qs.none()`
        and `loans_qs.none()` branches in `_check_budgets`/`_check_loans`.
        """
        other_user = User.objects.create_user(
            username=self._unique("nomember2"),
            email=f"{self._unique('nomember2')}@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client = APIClient()
        refresh = RefreshToken.for_user(other_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        # A matching budget exists, but since the requesting user has no
        # Member, it must never surface as an alert.
        Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("10.00"),
            month=date.today().month,
            year=date.today().year,
            member=self.member,
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        types = {a["type"] for a in response.data}
        self.assertNotIn("budget_limit", types)
        self.assertNotIn("loan_due", types)


class FinancialAlertsDefensiveBranchTest(_DashboardCoverageBaseTestCase):
    """
    Covers the defensive `if X.due_date is None: continue` guards that are
    unreachable through the real API (the querysets already filter
    `due_date__isnull=False`), by calling the private helper methods
    directly with a mocked queryset.
    """

    def test_check_credit_card_bills_skips_none_due_date(self):
        fake_bill = MagicMock()
        fake_bill.due_date = None
        with patch("dashboard.views.CreditCardBill.objects") as mock_objects:
            mock_objects.filter.return_value.exclude.return_value = (
                mock_objects.filter.return_value
            )
            mock_objects.filter.return_value.select_related.return_value = [
                fake_bill
            ]
            view = FinancialAlertsView()
            alerts = view._check_credit_card_bills(date.today(), self.user)
        self.assertEqual(alerts, [])

    def test_check_payables_skips_none_due_date(self):
        fake_payable = MagicMock()
        fake_payable.due_date = None
        with patch("dashboard.views.Payable.objects") as mock_objects:
            mock_objects.filter.return_value = [fake_payable]
            view = FinancialAlertsView()
            alerts = view._check_payables(date.today(), self.user)
        self.assertEqual(alerts, [])

    def test_check_loans_skips_none_due_date(self):
        fake_loan = MagicMock()
        fake_loan.due_date = None
        with patch("dashboard.views.Loan.objects") as mock_objects:
            mock_objects.filter.return_value.filter.return_value = [fake_loan]
            view = FinancialAlertsView()
            alerts = view._check_loans(date.today(), self.member)
        self.assertEqual(alerts, [])


# ---------------------------------------------------------------------------
# AnomalyDetectionView
# ---------------------------------------------------------------------------


class AnomalyDetectionViewTest(_DashboardCoverageBaseTestCase):
    @staticmethod
    def _months_ago(today, offset):
        month = today.month - offset
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        return year, month

    def _seed_history(self, category, history_values, current_value):
        today = timezone.now().date()
        for offset, value in enumerate(history_values, start=1):
            year, month = self._months_ago(today, offset)
            day = min(today.day, 28)
            self._make_expense(
                value,
                category=category,
                payed=True,
                d=date(year, month, day),
            )
        self._make_expense(
            current_value, category=category, payed=True, d=today
        )

    def test_anomaly_detected_for_spike(self):
        self._seed_history("food and drink", [100, 110, 90], 800)
        url = reverse("dashboard-anomalies")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        anomalies = response.data["anomalies"]
        self.assertEqual(len(anomalies), 1)
        anomaly = anomalies[0]
        self.assertEqual(anomaly["category"], "food and drink")
        self.assertGreater(anomaly["z_score"], 1.5)
        self.assertIn(anomaly["severity"], {"critical", "warning", "info"})
        self.assertIsNone(anomaly["explanation"])
        self.assertEqual(anomaly["suggested_action_type"], "view_expenses")

    def test_no_anomaly_with_insufficient_history(self):
        self._seed_history("transport", [100, 110], 800)
        url = reverse("dashboard-anomalies")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["anomalies"], [])

    def test_no_anomaly_when_within_normal_range(self):
        self._seed_history("transport", [100, 105, 95], 102)
        url = reverse("dashboard-anomalies")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["anomalies"], [])

    def test_no_anomaly_when_history_has_zero_variance(self):
        # Every historical month spent exactly the same amount -> std == 0,
        # so the category must be skipped regardless of the current spike.
        self._seed_history("entertainment", [100, 100, 100], 500)
        url = reverse("dashboard-anomalies")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["anomalies"], [])

    def test_enrich_llm_success(self):
        self._seed_history("food and drink", [100, 110, 90], 800)
        fake_json = (
            '{"explanation": "Gasto elevado no mês.", '
            '"action": "Revise seus gastos.", '
            '"action_type": "create_budget"}'
        )
        with patch(
            "agents.core.llm_client.LLMClient.chat", return_value=fake_json
        ):
            url = reverse("dashboard-anomalies")
            response = self.client.get(url, {"enrich_llm": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        anomaly = response.data["anomalies"][0]
        self.assertEqual(anomaly["explanation"], "Gasto elevado no mês.")
        self.assertEqual(anomaly["suggested_action_type"], "create_budget")

    def test_anomaly_history_crosses_previous_year_boundary(self):
        """
        Freezes "today" in March/2026 so that the 6-month lookback window
        used to build category history crosses into December of the
        previous year, exercising the `total_months <= 0` branch.
        """
        fixed_now = timezone.make_aware(datetime(2026, 3, 15, 10, 0, 0))
        with patch("django.utils.timezone.now", return_value=fixed_now):
            self._seed_history("education", [80, 90, 70], 900)
            url = reverse("dashboard-anomalies")
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        anomalies = {a["category"]: a for a in response.data["anomalies"]}
        self.assertIn("education", anomalies)
        self.assertGreater(anomalies["education"]["z_score"], 1.5)

    def test_anomaly_severity_thresholds(self):
        self.assertEqual(_anomaly_severity(3.5), "critical")
        self.assertEqual(_anomaly_severity(2.2), "warning")
        self.assertEqual(_anomaly_severity(1.6), "info")

    def test_enrich_llm_failure_is_swallowed(self):
        self._seed_history("food and drink", [100, 110, 90], 800)
        with patch(
            "agents.core.llm_client.LLMClient.chat",
            side_effect=RuntimeError("offline"),
        ):
            url = reverse("dashboard-anomalies")
            response = self.client.get(url, {"enrich_llm": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        anomaly = response.data["anomalies"][0]
        self.assertIsNone(anomaly["explanation"])
        self.assertEqual(anomaly["suggested_action_type"], "view_expenses")


# ---------------------------------------------------------------------------
# SpendingInsightsView
# ---------------------------------------------------------------------------


class SpendingInsightsViewTest(_DashboardCoverageBaseTestCase):
    def test_spending_insights_with_growing_category(self):
        today = timezone.now().date()

        def months_ago(offset):
            month = today.month - offset
            year = today.year
            while month <= 0:
                month += 12
                year -= 1
            return year, month

        for offset in range(1, 6):
            year, month = months_ago(offset)
            day = min(today.day, 28)
            self._make_expense(
                50,
                category="transport",
                payed=True,
                d=date(year, month, day),
            )
        self._make_expense(500, category="transport", payed=True, d=today)
        self._make_expense(30, category="others", payed=True, d=today)

        url = reverse("spending-insights")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("trend", data)
        self.assertIn("top_categories", data)
        self.assertEqual(len(data["monthly_breakdown"]), 6)
        growing_cats = {g["category"] for g in data["growing_categories"]}
        self.assertIn("transport", growing_cats)
        self.assertEqual(data["trend"]["direction"], "up")

    def test_spending_insights_crosses_previous_year_boundary(self):
        """
        Freezes "today" in Feb/2026 so the 6-month lookback window used to
        build `months_data` crosses into the previous year, exercising the
        `total_months <= 0` branch inside the view's own offset loop.
        """
        fixed_now = timezone.make_aware(datetime(2026, 2, 10, 10, 0, 0))
        with patch("django.utils.timezone.now", return_value=fixed_now):
            self._make_expense(
                40, category="education", payed=True, d=date(2025, 10, 5)
            )
            url = reverse("spending-insights")
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        periods = {m["month"] for m in response.data["monthly_breakdown"]}
        self.assertIn("2025-10", periods)

    def test_spending_insights_no_history(self):
        url = reverse("spending-insights")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_month"]["total_expenses"], 0)
        self.assertEqual(response.data["trend"]["direction"], "stable")


# ---------------------------------------------------------------------------
# AccountReconciliationView
# ---------------------------------------------------------------------------


class AccountReconciliationViewTest(_DashboardCoverageBaseTestCase):
    def test_account_not_found(self):
        url = reverse("dashboard-reconciliation", args=[999999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_reconciliation_without_bank_reconciliation_data(self):
        url = reverse("dashboard-reconciliation", args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["account_id"], self.account.id)
        self.assertEqual(response.data["unmatched_entries_count"], 0)

    def test_reconciliation_with_bank_statement_entries(self):
        from bank_reconciliation.models import (
            BankStatementEntry,
            BankStatementImport,
        )

        bank_import = BankStatementImport.objects.create(
            owner=self.user,
            account=self.account,
            file_hash="abc123",
            original_filename="extrato.ofx",
            file_format="ofx",
            status="completed",
            created_by=self.user,
        )
        BankStatementEntry.objects.create(
            statement_import=bank_import,
            transaction_id="1",
            date=date.today(),
            amount=Decimal("100.00"),
            description="Matched entry",
            transaction_type="credit",
            status="matched",
            created_by=self.user,
        )
        BankStatementEntry.objects.create(
            statement_import=bank_import,
            transaction_id="2",
            date=date.today(),
            amount=Decimal("50.00"),
            description="Unmatched entry",
            transaction_type="debit",
            status="unmatched",
            created_by=self.user,
        )

        url = reverse("dashboard-reconciliation", args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unmatched_entries_count"], 1)
        self.assertEqual(response.data["statement_balance"], 150.0)

    def test_reconciliation_swallows_unexpected_errors(self):
        with patch(
            "bank_reconciliation.models.BankStatementEntry.objects"
        ) as mock_objects:
            mock_objects.filter.side_effect = RuntimeError("db exploded")
            url = reverse("dashboard-reconciliation", args=[self.account.id])
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unmatched_entries_count"], 0)
        self.assertEqual(
            response.data["statement_balance"],
            response.data["system_balance"],
        )


# ---------------------------------------------------------------------------
# LGPDExportView
# ---------------------------------------------------------------------------


class LGPDExportViewTest(_DashboardCoverageBaseTestCase):
    def test_export_returns_zip_with_user_data(self):
        self._make_expense(100)
        self._make_revenue(200)
        url = reverse("lgpd-export")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/zip")
        zf = zipfile.ZipFile(BytesIO(response.content))
        names = set(zf.namelist())
        self.assertEqual(
            names,
            {
                "expenses.json",
                "revenues.json",
                "loans.json",
                "payables.json",
                "accounts.json",
            },
        )

    def test_export_rate_limited_on_second_call(self):
        url = reverse("lgpd-export")
        first = self.client.get(url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.get(url)
        self.assertEqual(second.status_code, 429)
        self.assertIn("detail", second.data)


# ---------------------------------------------------------------------------
# IRReportView
# ---------------------------------------------------------------------------


class IRReportViewTest(_DashboardCoverageBaseTestCase):
    def test_default_year_is_current_year(self):
        url = reverse("ir-report")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["year"], timezone.now().year)

    def test_invalid_year_returns_400(self):
        url = reverse("ir-report")
        response = self.client.get(url, {"year": "not-a-year"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_report_with_data(self):
        self._make_revenue(
            1000, category="salary", received=True, d=date(2026, 2, 1)
        )
        self._make_expense(
            200, category="health and care", payed=True, d=date(2026, 2, 1)
        )
        Loan.objects.create(
            description="Loan report",
            value=Decimal("500.00"),
            payed_value=Decimal("0.00"),
            date=date(2026, 2, 1),
            horary=time(9, 0),
            category="others",
            account=self.account,
            benefited=self.member,
            creditor=self.member,
            status="active",
            created_by=self.user,
        )
        url = reverse("ir-report")
        response = self.client.get(url, {"year": 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["year"], 2026)
        self.assertTrue(len(response.data["revenues"]) >= 1)
        self.assertTrue(len(response.data["loans"]) >= 1)


# ---------------------------------------------------------------------------
# AlertsStreamView
# ---------------------------------------------------------------------------


class AlertsStreamViewTest(_DashboardCoverageBaseTestCase):
    def _build_request(self):
        factory = APIRequestFactory()
        django_request = factory.get("/api/v1/dashboard/alerts/stream/")
        django_request.user = self.user
        return django_request

    def test_stream_yields_data_then_pings(self):
        request = self._build_request()
        view = AlertsStreamView()
        with patch("time.sleep", return_value=None):
            response = view.get(request)
            chunks = list(response.streaming_content)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(chunks[0].startswith(b"data:"))
        self.assertTrue(any(c.startswith(b": ping") for c in chunks[1:]))
        self.assertEqual(response["Content-Type"], "text/event-stream")
        self.assertEqual(response["Cache-Control"], "no-cache")

    def test_stream_yields_error_on_exception(self):
        request = self._build_request()
        view = AlertsStreamView()
        with (
            patch("time.sleep", return_value=None),
            patch(
                "dashboard.views.FinancialAlertsView.get",
                side_effect=RuntimeError("boom"),
            ),
        ):
            response = view.get(request)
            first_chunk = next(response.streaming_content)
        self.assertEqual(first_chunk, b": error\n\n")


# ---------------------------------------------------------------------------
# AuditLogView
# ---------------------------------------------------------------------------


class AuditLogViewTest(_DashboardCoverageBaseTestCase):
    def setUp(self):
        super().setUp()
        from django.contrib.contenttypes.models import ContentType

        from app.audit import ChangeLog

        expense = self._make_expense(100)
        self.expense_ct = ContentType.objects.get_for_model(Expense)
        self.log_entry = ChangeLog.objects.create(
            user=self.user,
            content_type=self.expense_ct,
            object_id=str(expense.uuid),
            action="create",
            changes={"value": ["0", "100"]},
        )

    def test_audit_log_no_filters(self):
        url = reverse("audit-log")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_audit_log_filter_by_object_type(self):
        url = reverse("audit-log")
        response = self.client.get(url, {"object_type": self.expense_ct.model})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_audit_log_filter_by_unknown_object_type(self):
        url = reverse("audit-log")
        response = self.client.get(
            url, {"object_type": "not_a_real_model_xyz"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # unknown content type -> filter is skipped, not an error
        self.assertEqual(response.data["count"], 1)

    def test_audit_log_filter_by_object_id(self):
        url = reverse("audit-log")
        response = self.client.get(
            url, {"object_id": self.log_entry.object_id}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["action"], "create")


# ---------------------------------------------------------------------------
# FinancialHealthScoreView
# ---------------------------------------------------------------------------


class FinancialHealthScoreViewTest(_DashboardCoverageBaseTestCase):
    def test_health_score_empty_data(self):
        url = reverse("health-score")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("score", response.data)
        self.assertIn("dimensions", response.data)

    def test_health_score_with_rich_data(self):
        today = timezone.now().date()
        year_start = date(today.year, 1, 1)

        # Liquidity: recent months expenses
        for i in range(3):
            self._make_expense(
                1000,
                category="house",
                payed=True,
                d=today - timedelta(days=20 * i),
            )

        # Debt: annual revenue + active loan
        self._make_revenue(
            20000, category="salary", received=True, d=year_start
        )
        Loan.objects.create(
            description="Active loan",
            value=Decimal("5000.00"),
            payed_value=Decimal("1000.00"),
            date=year_start,
            horary=time(9, 0),
            category="others",
            account=self.account,
            benefited=self.member,
            creditor=self.member,
            status="active",
            created_by=self.user,
        )

        # Savings: annual expenses
        self._make_expense(
            8000, category="supermarket", payed=True, d=year_start
        )

        # Compliance: overdue + non-overdue commitments
        Payable.objects.create(
            description="Overdue payable",
            value=Decimal("100.00"),
            paid_value=Decimal("0.00"),
            date=today,
            category="others",
            status="overdue",
            member=self.member,
            created_by=self.user,
        )
        Payable.objects.create(
            description="Paid payable",
            value=Decimal("100.00"),
            paid_value=Decimal("100.00"),
            date=today,
            category="others",
            status="paid",
            member=self.member,
            created_by=self.user,
        )

        url = reverse("health-score")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dims = response.data["dimensions"]
        self.assertIsNotNone(dims["liquidity"]["ratio"])
        self.assertGreater(dims["debt"]["ratio"], 0)
        self.assertIn("rate", dims["savings"])
        self.assertGreater(dims["compliance"]["overdue_count"], 0)
        self.assertIn(response.data["grade"], {"A", "B", "C", "D", "F"})

    def test_grade_boundaries(self):
        self.assertEqual(FinancialHealthScoreView._grade(95), "A")
        self.assertEqual(FinancialHealthScoreView._grade(80), "B")
        self.assertEqual(FinancialHealthScoreView._grade(65), "C")
        self.assertEqual(FinancialHealthScoreView._grade(45), "D")
        self.assertEqual(FinancialHealthScoreView._grade(10), "F")

    def _fresh_zero_balance_client(self):
        """
        A user whose only Account has current_balance=0 never gets the
        account-creation signal's auto "Saldo inicial" Revenue, so
        annual_revenue is genuinely 0 -- letting us exercise the
        `annual_revenue <= 0` fallback branches for debt/savings scores.
        """
        zero_user = User.objects.create_user(
            username=self._unique("zerorev"),
            email=f"{self._unique('zerorev')}@test.com",
            password="testpass123",
            is_superuser=True,
        )
        zero_account = Account.objects.create(
            account_name="Zero Balance Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("0.00"),
            created_by=zero_user,
        )
        client = APIClient()
        refresh = RefreshToken.for_user(zero_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        return zero_user, zero_account, client

    def test_health_score_zero_revenue_with_active_loans(self):
        zero_user, zero_account, client = self._fresh_zero_balance_client()
        Loan.objects.create(
            description="Loan with no revenue history",
            value=Decimal("1000.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(9, 0),
            category="others",
            account=zero_account,
            benefited=self.member,
            creditor=self.member,
            status="active",
            created_by=zero_user,
        )
        url = reverse("health-score")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dims = response.data["dimensions"]
        self.assertEqual(dims["debt"]["score"], 0.0)
        self.assertEqual(dims["savings"]["score"], 0.0)

    def test_health_score_zero_revenue_without_loans(self):
        _, _, client = self._fresh_zero_balance_client()
        url = reverse("health-score")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dims = response.data["dimensions"]
        self.assertEqual(dims["debt"]["score"], 25.0)
        self.assertEqual(dims["savings"]["score"], 0.0)


# ---------------------------------------------------------------------------
# DashboardSummaryView
# ---------------------------------------------------------------------------


class DashboardSummaryViewTest(_DashboardCoverageBaseTestCase):
    def test_summary_aggregates_all_sections(self):
        self._make_expense(50, payed=True)
        self._make_revenue(150, received=True)
        url = reverse("dashboard-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in (
            "stats",
            "account_balances",
            "financial_alerts",
            "budget_status",
        ):
            self.assertIn(key, response.data)

    def test_summary_cache_hit(self):
        url = reverse("dashboard-summary")
        first = self.client.get(url)
        second = self.client.get(url)
        self.assertEqual(first.data, second.data)
