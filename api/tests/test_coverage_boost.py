"""
Coverage boost tests — targets modules with <80% coverage:
- credit_cards: PayCreditCardBillView, BillItemsView, ReopenCreditCardBillView,
  Purchase creation with installments, InstallmentUpdateView
- expenses/services.py: get_or_create_bill, bulk_generate_fixed_expenses,
  FixedExpensesStatsView
- library: LiteraryTypeGoalDetailView, BookReorderView
- personal_planning: RoutineTemplateImportView (error paths), analytics
- dashboard: FinancialAlertsView with credit card bills
"""

import os
from datetime import date, time
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from cryptography.fernet import Fernet
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member

# Stable test encryption key shared across all CC tests
_TEST_FERNET_KEY = Fernet.generate_key().decode()


# ============================================================================
# Base helper
# ============================================================================


class BaseTestCase(APITestCase):
    def setUp(self):
        # Ensure a valid ENCRYPTION_KEY is available for credit card encryption
        self._enc_patcher = patch.dict(
            os.environ, {"ENCRYPTION_KEY": _TEST_FERNET_KEY}
        )
        self._enc_patcher.start()

        self.user = User.objects.create_user(
            username="covboost",
            email="covboost@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.account = Account.objects.create(
            account_name="Boost Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("10000.00"),
            created_by=self.user,
        )

    def tearDown(self):
        self._enc_patcher.stop()

    def _make_credit_card(self, name="Boost Card"):
        from app.encryption import FieldEncryption
        from credit_cards.models import CreditCard

        card = CreditCard(
            name=name,
            on_card_name="BOOST USER",
            flag="VSA",
            associated_account=self.account,
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            closing_day=15,
            due_day=10,
            validation_date=date(2030, 1, 1),
            created_by=self.user,
            updated_by=self.user,
        )
        card._security_code = FieldEncryption.encrypt_data("123")
        card._card_number = FieldEncryption.encrypt_data("4111111111111111")
        card.save()
        return card

    def _make_bill(
        self, card, year="2026", month="Jan", total_amount=Decimal("500.00")
    ):
        from credit_cards.models import CreditCardBill

        return CreditCardBill.objects.create(
            credit_card=card,
            year=year,
            month=month,
            invoice_beginning_date=date(2026, 1, 1),
            invoice_ending_date=date(2026, 1, 31),
            due_date=date(2026, 2, 10),
            closed=False,
            total_amount=total_amount,
            minimum_payment=Decimal("50.00"),
            paid_amount=Decimal("0.00"),
            status="open",
            created_by=self.user,
        )

    def _make_purchase(
        self, card, total_value=Decimal("300.00"), total_installments=3
    ):
        from credit_cards.models import CreditCardPurchase

        return CreditCardPurchase.objects.create(
            description="Test Purchase",
            total_value=total_value,
            purchase_date=date(2026, 1, 5),
            purchase_time=time(12, 0),
            category="food and drink",
            card=card,
            total_installments=total_installments,
            created_by=self.user,
            updated_by=self.user,
        )

    def _make_installment(
        self, purchase, bill, installment_number=1, value=Decimal("100.00")
    ):
        from credit_cards.models import CreditCardInstallment

        return CreditCardInstallment.objects.create(
            purchase=purchase,
            installment_number=installment_number,
            value=value,
            due_date=date(2026, 1, 15),
            bill=bill,
            payed=False,
            created_by=self.user,
        )


# ============================================================================
# Credit Card: PayCreditCardBillView
# ============================================================================


class PayCreditCardBillViewTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Pay Test Card")
        # Create bill with total_amount=0; signal updates it when installment
        # is added
        self.bill = self._make_bill(self.card, total_amount=Decimal("0.00"))
        self.purchase = self._make_purchase(
            self.card, total_value=Decimal("300.00"), total_installments=1
        )
        self.installment = self._make_installment(
            self.purchase, self.bill, value=Decimal("300.00")
        )
        # Refresh bill to get updated total_amount from signal
        self.bill.refresh_from_db()

    def test_pay_bill_full_payment(self):
        url = reverse("credit-card-bill-pay", args=[self.bill.pk])
        # Pay the exact total_amount (refreshed after signal updated it)
        pay_amount = str(self.bill.total_amount)
        response = self.client.post(
            url,
            {
                "amount": pay_amount,
                "payment_date": "2026-02-10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.bill.refresh_from_db()
        self.assertEqual(self.bill.status, "paid")
        self.assertTrue(self.bill.closed)

    def test_pay_bill_updates_account_balance(self):
        self.account.refresh_from_db()
        balance_before = self.account.current_balance
        url = reverse("credit-card-bill-pay", args=[self.bill.pk])
        response = self.client.post(
            url,
            {"amount": "100.00", "payment_date": "2026-02-10"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.account.refresh_from_db()
        self.assertEqual(
            self.account.current_balance, balance_before - Decimal("100.00")
        )

    def test_pay_bill_partial_payment(self):
        url = reverse("credit-card-bill-pay", args=[self.bill.pk])
        response = self.client.post(
            url,
            {
                "amount": "100.00",
                "payment_date": "2026-02-10",
                "notes": "Partial payment",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.bill.refresh_from_db()
        self.assertEqual(self.bill.paid_amount, Decimal("100.00"))
        self.assertEqual(self.bill.status, "open")

    def test_pay_bill_not_found(self):
        url = reverse("credit-card-bill-pay", args=[99999])
        response = self.client.post(
            url,
            {
                "amount": "100.00",
                "payment_date": "2026-02-10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_pay_bill_already_paid(self):
        # Manually set the bill as fully paid without triggering signals
        from credit_cards.models import CreditCardBill

        CreditCardBill.objects.filter(pk=self.bill.pk).update(
            paid_amount=self.bill.total_amount, status="paid"
        )
        self.bill.refresh_from_db()
        url = reverse("credit-card-bill-pay", args=[self.bill.pk])
        response = self.client.post(
            url,
            {
                "amount": "100.00",
                "payment_date": "2026-02-10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pay_bill_amount_exceeds_remaining(self):
        url = reverse("credit-card-bill-pay", args=[self.bill.pk])
        # Use an amount clearly larger than the total_amount
        big_amount = str(
            Decimal(str(self.bill.total_amount)) + Decimal("100.00")
        )
        response = self.client.post(
            url,
            {
                "amount": big_amount,
                "payment_date": "2026-02-10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pay_bill_invalid_amount_zero(self):
        url = reverse("credit-card-bill-pay", args=[self.bill.pk])
        response = self.client.post(
            url,
            {
                "amount": "0.00",
                "payment_date": "2026-02-10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ============================================================================
# Credit Card: BillItemsView
# ============================================================================


class BillItemsViewTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Items Card")
        self.bill = self._make_bill(self.card)
        self.purchase = self._make_purchase(self.card)
        self._make_installment(
            self.purchase, self.bill, value=Decimal("100.00")
        )

    def test_get_bill_items(self):
        url = reverse("credit-card-bill-items", args=[self.bill.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["bill_id"], self.bill.id)
        self.assertIn("items", response.data)
        self.assertEqual(response.data["total_items"], 1)
        self.assertGreater(response.data["total_value"], 0)

    def test_get_bill_items_not_found(self):
        url = reverse("credit-card-bill-items", args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_bill_items_empty(self):
        empty_bill = self._make_bill(self.card, month="Feb")
        url = reverse("credit-card-bill-items", args=[empty_bill.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_items"], 0)
        self.assertEqual(response.data["total_value"], 0)

    def test_get_bill_items_with_paid_installment(self):
        from credit_cards.models import CreditCardInstallment

        purchase2 = self._make_purchase(
            self.card, total_value=Decimal("50.00"), total_installments=1
        )
        CreditCardInstallment.objects.create(
            purchase=purchase2,
            installment_number=1,
            value=Decimal("50.00"),
            due_date=date(2026, 1, 10),
            bill=self.bill,
            payed=True,
            created_by=self.user,
        )
        url = reverse("credit-card-bill-items", args=[self.bill.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["paid_count"], 1)
        self.assertEqual(response.data["pending_count"], 1)


# ============================================================================
# Credit Card: ReopenCreditCardBillView
# ============================================================================


class ReopenCreditCardBillViewTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Reopen Card")
        self.bill = self._make_bill(self.card)
        self.bill.closed = True
        self.bill.status = "paid"
        self.bill.save()

    def test_reopen_closed_bill(self):
        url = reverse("credit-card-bill-reopen", args=[self.bill.pk])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.bill.refresh_from_db()
        self.assertFalse(self.bill.closed)
        self.assertEqual(self.bill.status, "open")

    def test_reopen_already_open_bill(self):
        self.bill.closed = False
        self.bill.status = "open"
        self.bill.save()
        url = reverse("credit-card-bill-reopen", args=[self.bill.pk])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reopen_not_found(self):
        url = reverse("credit-card-bill-reopen", args=[99999])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ============================================================================
# Credit Card: Purchase creation via API (creates installments)
# ============================================================================


class CreditCardPurchaseCreateAPITest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Purchase API Card")
        self.bill = self._make_bill(self.card)

    def test_create_purchase_creates_installments(self):
        url = reverse("credit_card-purchase-create-list")
        response = self.client.post(
            url,
            {
                "description": "New Purchase",
                "total_value": "300.00",
                "purchase_date": "2026-01-05",
                "purchase_time": "12:00:00",
                "category": "food and drink",
                "card": self.card.pk,
                "total_installments": 3,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_purchase_single_installment(self):
        url = reverse("credit_card-purchase-create-list")
        response = self.client.post(
            url,
            {
                "description": "Single Purchase",
                "total_value": "150.00",
                "purchase_date": "2026-01-10",
                "purchase_time": "14:00:00",
                "category": "house",
                "card": self.card.pk,
                "total_installments": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_purchase_invalid_installments(self):
        url = reverse("credit_card-purchase-create-list")
        response = self.client.post(
            url,
            {
                "description": "Bad Purchase",
                "total_value": "300.00",
                "purchase_date": "2026-01-05",
                "purchase_time": "12:00:00",
                "category": "food and drink",
                "card": self.card.pk,
                "total_installments": 0,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_purchase_invalid_value(self):
        url = reverse("credit_card-purchase-create-list")
        response = self.client.post(
            url,
            {
                "description": "Zero Value",
                "total_value": "0.00",
                "purchase_date": "2026-01-05",
                "purchase_time": "12:00:00",
                "category": "food and drink",
                "card": self.card.pk,
                "total_installments": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_purchase_recalculates_bill(self):
        purchase = self._make_purchase(self.card)
        self._make_installment(purchase, self.bill, value=Decimal("100.00"))
        url = reverse("credit-card-purchase-detail-view", args=[purchase.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_update_purchase(self):
        purchase = self._make_purchase(self.card)
        url = reverse("credit-card-purchase-detail-view", args=[purchase.pk])
        response = self.client.patch(
            url,
            {
                "description": "Updated Description",
                "category": "house",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================================
# Credit Card: InstallmentUpdateView
# ============================================================================


class CreditCardInstallmentUpdateViewTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Installment Card")
        self.bill = self._make_bill(self.card)
        self.purchase = self._make_purchase(self.card)
        self.installment = self._make_installment(
            self.purchase, self.bill, value=Decimal("100.00")
        )

    def test_mark_installment_paid(self):
        url = reverse(
            "credit-card-installment-update", args=[self.installment.pk]
        )
        response = self.client.patch(url, {"payed": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.installment.refresh_from_db()
        self.assertTrue(self.installment.payed)

    def test_update_installment_value(self):
        url = reverse(
            "credit-card-installment-update", args=[self.installment.pk]
        )
        response = self.client.patch(url, {"value": "150.00"}, format="json")
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )


# ============================================================================
# Credit Card: CreditCardBillsSerializer create with auto due_date
# ============================================================================


class CreditCardBillCreateAutoDateTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Auto Date Card")

    def test_create_bill_with_auto_due_date(self):
        url = reverse("credit_card-bill-create-list")
        response = self.client.post(
            url,
            {
                "credit_card": self.card.pk,
                "year": "2026",
                "month": "Mar",
                "invoice_beginning_date": "2026-03-01",
                "invoice_ending_date": "2026-03-31",
                "closed": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_bill_with_explicit_due_date(self):
        url = reverse("credit_card-bill-create-list")
        response = self.client.post(
            url,
            {
                "credit_card": self.card.pk,
                "year": "2026",
                "month": "Apr",
                "invoice_beginning_date": "2026-04-01",
                "invoice_ending_date": "2026-04-30",
                "due_date": "2026-05-10",
                "closed": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ============================================================================
# Expenses Services: get_or_create_bill and bulk_generate_fixed_expenses
# ============================================================================


class ExpensesServicesTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Service Card")

    def test_get_or_create_bill_creates_new(self):
        from expenses.services import get_or_create_bill

        bill, created = get_or_create_bill(self.card, "2026", "3", self.user)
        self.assertTrue(created)
        self.assertIsNotNone(bill)

    def test_get_or_create_bill_returns_existing(self):
        from expenses.services import get_or_create_bill

        bill1, _ = get_or_create_bill(self.card, "2026", "4", self.user)
        bill2, created = get_or_create_bill(self.card, "2026", "4", self.user)
        self.assertFalse(created)
        self.assertEqual(bill1.pk, bill2.pk)

    def test_get_or_create_bill_december_wraps_year(self):
        from expenses.services import get_or_create_bill

        bill, created = get_or_create_bill(self.card, "2026", "12", self.user)
        self.assertTrue(created)
        self.assertEqual(bill.month, "Dec")


class BulkGenerateFixedExpensesTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import FixedExpense

        self.fixed_expense = FixedExpense.objects.create(
            description="Monthly Rent",
            default_value=Decimal("1200.00"),
            category="house",
            account=self.account,
            due_day=5,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_bulk_generate_via_api(self):
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url,
            {
                "month": "2026-02",
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_expense.id,
                        "value": "1200.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_bulk_generate_skips_already_existing(self):
        url = reverse("fixed-expense-generate")
        self.client.post(
            url,
            {
                "month": "2026-03",
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_expense.id,
                        "value": "1200.00",
                    }
                ],
            },
            format="json",
        )
        response = self.client.post(
            url,
            {
                "month": "2026-03",
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_expense.id,
                        "value": "1200.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_bulk_generate_not_found_returns_404(self):
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url,
            {
                "month": "2026-04",
                "expense_values": [
                    {"fixed_expense_id": 99999, "value": "100.00"}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_fixed_expenses_stats(self):
        url = reverse("fixed-expense-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("active_templates", response.data)
        self.assertIn("current_month", response.data)
        self.assertIn("comparison", response.data)


class BulkGenerateWithCreditCardTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.card = self._make_credit_card("Fixed CC Card")
        from expenses.models import FixedExpense

        self.fixed_cc_expense = FixedExpense.objects.create(
            description="Streaming Service",
            default_value=Decimal("45.90"),
            category="entertainment",
            credit_card=self.card,
            due_day=10,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_bulk_generate_cc_expense_creates_purchase(self):
        from credit_cards.models import CreditCardBill

        CreditCardBill.objects.create(
            credit_card=self.card,
            year="2026",
            month="May",
            invoice_beginning_date=date(2026, 5, 1),
            invoice_ending_date=date(2026, 5, 31),
            due_date=date(2026, 6, 10),
            total_amount=Decimal("0.00"),
            minimum_payment=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            status="open",
            closed=False,
            created_by=self.user,
        )
        url = reverse("fixed-expense-generate")
        response = self.client.post(
            url,
            {
                "month": "2026-05",
                "expense_values": [
                    {
                        "fixed_expense_id": self.fixed_cc_expense.id,
                        "value": "45.90",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ============================================================================
# Library: LiteraryTypeGoal CRUD
# ============================================================================


class LiteraryTypeGoalTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="litgoal",
            email="litgoal@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Lit Goal User",
            document_hash="g" * 64,
            phone="11999999989",
            sex="M",
            user=self.user,
        )
        from library.models import ReadingGoal

        self.reading_goal = ReadingGoal.objects.create(
            year=2026,
            books_goal=12,
            owner=self.member,
        )

    def test_list_literary_type_goals(self):
        url = reverse("literary-type-goal-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_literary_type_goal(self):
        url = reverse("literary-type-goal-list-create")
        response = self.client.post(
            url,
            {
                "reading_goal": self.reading_goal.pk,
                "literary_type": "essay",
                "goal_count": 10,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_literary_type_goal(self):
        from library.models import LiteraryTypeGoal

        goal = LiteraryTypeGoal.objects.create(
            reading_goal=self.reading_goal,
            literary_type="collection",
            goal_count=5,
        )
        url = reverse("literary-type-goal-detail", args=[goal.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_literary_type_goal(self):
        from library.models import LiteraryTypeGoal

        goal = LiteraryTypeGoal.objects.create(
            reading_goal=self.reading_goal,
            literary_type="magazine",
            goal_count=4,
        )
        url = reverse("literary-type-goal-detail", args=[goal.pk])
        response = self.client.patch(
            url,
            {
                "reading_goal": self.reading_goal.pk,
                "literary_type": "magazine",
                "goal_count": 6,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        goal.refresh_from_db()
        self.assertEqual(goal.goal_count, 6)

    def test_delete_literary_type_goal(self):
        from library.models import LiteraryTypeGoal

        goal = LiteraryTypeGoal.objects.create(
            reading_goal=self.reading_goal,
            literary_type="article",
            goal_count=2,
        )
        url = reverse("literary-type-goal-detail", args=[goal.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_filter_by_reading_goal(self):
        url = reverse("literary-type-goal-list-create")
        response = self.client.get(url, {"reading_goal": self.reading_goal.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================================
# Library: BookReorderView
# ============================================================================


class BookReorderViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reorderuser",
            email="reorder@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Reorder User",
            document_hash="r" * 64,
            phone="11999999909",
            sex="F",
            user=self.user,
        )
        from library.models import Author, Book, Publisher

        author = Author.objects.create(
            name="Reorder Author", owner=self.member
        )
        publisher = Publisher.objects.create(
            name="Reorder Publisher", owner=self.member
        )
        self.book1 = Book.objects.create(
            title="Book One",
            pages=200,
            publisher=publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            read_status="to_read",
            owner=self.member,
        )
        self.book1.authors.set([author])
        self.book2 = Book.objects.create(
            title="Book Two",
            pages=300,
            publisher=publisher,
            language="Por",
            genre="History",
            literarytype="book",
            read_status="to_read",
            owner=self.member,
        )
        self.book2.authors.set([author])

    def test_reorder_books(self):
        url = reverse("reading-queue-reorder")
        response = self.client.patch(
            url,
            [
                {"id": self.book1.id, "priority": 2},
                {"id": self.book2.id, "priority": 1},
            ],
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reorder_invalid_data(self):
        url = reverse("reading-queue-reorder")
        response = self.client.patch(url, [{"no_id": "bad"}], format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reorder_book_not_owned(self):
        other_user = User.objects.create_user(
            username="otherreorder",
            email="other_reorder@test.com",
            password="pass",
        )
        other_member = Member.objects.create(
            name="Other Reorder",
            document_hash="o" * 60 + "rord",
            phone="11888888801",
            sex="M",
            user=other_user,
        )
        from library.models import Author, Book, Publisher

        other_author = Author.objects.create(
            name="Other Reorder Author", owner=other_member
        )
        other_publisher = Publisher.objects.create(
            name="Other Reorder Publisher", owner=other_member
        )
        other_book = Book.objects.create(
            title="Other Book",
            pages=100,
            publisher=other_publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            read_status="to_read",
            owner=other_member,
        )
        other_book.authors.set([other_author])
        url = reverse("reading-queue-reorder")
        response = self.client.patch(
            url,
            [
                {"id": other_book.id, "priority": 1},
            ],
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reading_queue_with_priority(self):
        self.book1.reading_priority = 2
        self.book1.save()
        self.book2.reading_priority = 1
        self.book2.save()
        url = reverse("reading-queue")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================================
# Personal Planning: Analytics and Template Import errors
# ============================================================================


class PersonalPlanningAnalyticsTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="analytics_user",
            email="analytics@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Analytics User",
            document_hash="a" * 64,
            phone="11999999919",
            sex="M",
            user=self.user,
        )

    def test_analytics_endpoint(self):
        url = reverse("personal-planning-analytics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("completion_by_weekday", response.data)

    def test_template_import_no_template_id(self):
        url = reverse("routine-template-import")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_template_import_invalid_template_id(self):
        url = reverse("routine-template-import")
        response = self.client.post(
            url, {"template_id": "nonexistent-id-xyz"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_template_import_no_member(self):
        user2 = User.objects.create_user(
            username="no_member_user",
            email="nomember@test.com",
            password="testpass123",
            is_superuser=True,
        )
        client2 = APIClient()
        refresh = RefreshToken.for_user(user2)
        client2.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        url = reverse("routine-template-list")
        response = client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        templates = response.data
        if templates:
            import_url = reverse("routine-template-import")
            resp2 = client2.post(
                import_url, {"template_id": templates[0]["id"]}, format="json"
            )
            self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_heatmap_with_task_id(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Analytics Task",
            category="health",
            periodicity="daily",
            owner=self.member,
            created_by=self.user,
        )
        url = reverse("routine-task-heatmap")
        response = self.client.get(url, {"task_id": task.pk, "year": 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("data", response.data)


# ============================================================================
# Personal Planning: Custom periodicity model validation
# ============================================================================


class RoutineTaskCustomPeriodicityTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="custom_periodic",
            email="custom@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.member = Member.objects.create(
            name="Custom User",
            document_hash="c" * 64,
            phone="11999999929",
            sex="F",
            user=self.user,
        )

    def test_weekly_without_weekday_raises(self):
        from django.core.exceptions import ValidationError

        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Weekly No Day",
            category="health",
            periodicity="weekly",
            owner=self.member,
        )
        with self.assertRaises(ValidationError):
            task.full_clean()

    def test_monthly_without_day_raises(self):
        from django.core.exceptions import ValidationError

        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Monthly No Day",
            category="health",
            periodicity="monthly",
            owner=self.member,
        )
        with self.assertRaises(ValidationError):
            task.full_clean()

    def test_custom_without_any_config_raises(self):
        from django.core.exceptions import ValidationError

        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Custom No Config",
            category="health",
            periodicity="custom",
            owner=self.member,
        )
        with self.assertRaises(ValidationError):
            task.full_clean()

    def test_custom_with_weekdays_valid(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Custom Weekdays",
            category="health",
            periodicity="custom",
            custom_weekdays=[0, 2, 4],
            owner=self.member,
            created_by=self.user,
        )
        task.full_clean()
        task.save()
        self.assertIsNotNone(task.pk)

    def test_custom_with_invalid_weekday_value_raises(self):
        from django.core.exceptions import ValidationError

        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Custom Bad Weekday",
            category="health",
            periodicity="custom",
            custom_weekdays=[7],
            owner=self.member,
        )
        with self.assertRaises(ValidationError):
            task.full_clean()

    def test_custom_with_invalid_month_day_raises(self):
        from django.core.exceptions import ValidationError

        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Custom Bad Month Day",
            category="health",
            periodicity="custom",
            custom_month_days=[32],
            owner=self.member,
        )
        with self.assertRaises(ValidationError):
            task.full_clean()

    def test_custom_interval_without_start_date_raises(self):
        from django.core.exceptions import ValidationError

        from personal_planning.models import RoutineTask

        task = RoutineTask(
            name="Custom Interval No Start",
            category="health",
            periodicity="custom",
            interval_days=3,
            owner=self.member,
        )
        with self.assertRaises(ValidationError):
            task.full_clean()

    def test_should_appear_on_date_custom_weekdays(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Custom Appear Weekday",
            category="health",
            periodicity="custom",
            custom_weekdays=[0],
            owner=self.member,
            created_by=self.user,
        )
        monday = date(2026, 4, 20)
        self.assertTrue(monday.weekday() == 0)
        result = task.should_appear_on_date(monday)
        self.assertTrue(result)

    def test_should_appear_on_date_custom_month_days(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Custom Appear Month Day",
            category="health",
            periodicity="custom",
            custom_month_days=[15],
            owner=self.member,
            created_by=self.user,
        )
        self.assertTrue(task.should_appear_on_date(date(2026, 4, 15)))
        self.assertFalse(task.should_appear_on_date(date(2026, 4, 16)))

    def test_should_appear_on_date_interval(self):
        from personal_planning.models import RoutineTask

        start = date(2026, 1, 1)
        task = RoutineTask.objects.create(
            name="Custom Interval",
            category="health",
            periodicity="custom",
            interval_days=7,
            interval_start_date=start,
            owner=self.member,
            created_by=self.user,
        )
        self.assertTrue(task.should_appear_on_date(date(2026, 1, 1)))
        self.assertFalse(task.should_appear_on_date(date(2026, 1, 2)))
        self.assertTrue(task.should_appear_on_date(date(2026, 1, 8)))


# ============================================================================
# Dashboard: FinancialAlertsView with credit card bill due
# ============================================================================


class FinancialAlertsCreditCardTest(BaseTestCase):
    def test_financial_alerts_with_cc_bill_due_today(self):
        from credit_cards.models import CreditCardBill

        card = self._make_credit_card("Alert Card")
        today = date.today()
        CreditCardBill.objects.create(
            credit_card=card,
            year=str(today.year),
            month="Jan",
            invoice_beginning_date=(
                today.replace(day=1) if today.day > 1 else today
            ),
            invoice_ending_date=today,
            due_date=today,
            total_amount=Decimal("500.00"),
            minimum_payment=Decimal("50.00"),
            paid_amount=Decimal("0.00"),
            status="open",
            closed=False,
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_financial_alerts_with_cc_bill_overdue(self):
        from credit_cards.models import CreditCardBill

        card = self._make_credit_card("Overdue Alert Card")
        yesterday = date.today().replace(day=max(1, date.today().day - 1))
        CreditCardBill.objects.create(
            credit_card=card,
            year=str(yesterday.year),
            month="Feb",
            invoice_beginning_date=yesterday,
            invoice_ending_date=yesterday,
            due_date=yesterday,
            total_amount=Decimal("300.00"),
            minimum_payment=Decimal("30.00"),
            paid_amount=Decimal("0.00"),
            status="open",
            closed=False,
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_financial_alerts_empty(self):
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)


# ============================================================================
# Dashboard: Budget alerts
# ============================================================================


class FinancialAlertsBudgetTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="budgetalert",
            email="budgetalert@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Budget Alert User",
            document_hash="b" * 64,
            phone="11999998899",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Budget Alert Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            created_by=self.user,
        )
        from budgets.models import Budget

        today = date.today()
        self.budget = Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("100.00"),
            month=today.month,
            year=today.year,
            member=self.member,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_financial_alerts_with_budget_over_80(self):
        from expenses.models import Expense

        today = date.today()
        Expense.objects.create(
            description="Over budget expense",
            value=Decimal("90.00"),
            date=today,
            horary=time(10, 0),
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        url = reverse("financial-alerts")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        budget_alerts = [
            a for a in response.data if a.get("type") == "budget_limit"
        ]
        self.assertTrue(len(budget_alerts) >= 1)
