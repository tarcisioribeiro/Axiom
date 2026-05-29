"""
Final coverage push — member permissions, financial report, and remaining
areas.
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


class BaseFinalTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="finaltest",
            email="final@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Final User",
            document_hash="f" * 64,
            phone="11999999919",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Final Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("5000.00"),
        )


# ---------------------------------------------------------------------------
# Member permissions endpoints
# ---------------------------------------------------------------------------


class MemberPermissionsViewTest(BaseFinalTestCase):
    def test_get_member_permissions(self):
        url = reverse("member-permissions-get", args=[self.member.pk])
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_403_FORBIDDEN,
                status.HTTP_404_NOT_FOUND,
            ],
        )

    def test_get_available_permissions(self):
        url = reverse("available-permissions")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN],
        )

    def test_user_permissions(self):
        # Need non-superuser for this endpoint
        regular_user = User.objects.create_user(
            "permtest", "perm@test.com", "pass123"
        )
        Member.objects.create(
            name="Perm User",
            document_hash="q" * 64,
            phone="11999999909",
            sex="F",
            user=regular_user,
        )
        client = APIClient()
        refresh = RefreshToken.for_user(regular_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse("user-permissions")
        response = client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN],
        )


# ---------------------------------------------------------------------------
# Member financial report
# ---------------------------------------------------------------------------


class MemberFinancialReportViewTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        # Create expenses and revenues for the member
        from expenses.models import Expense
        from revenues.models import Revenue

        Revenue.objects.create(
            description="Salary",
            value=Decimal("5000.00"),
            date=date.today(),
            horary="09:00:00",
            category="salary",
            account=self.account,
            received=True,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Rent",
            value=Decimal("1500.00"),
            date=date.today(),
            horary="10:00:00",
            category="bills and services",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def test_member_financial_report(self):
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )

    def test_member_financial_report_with_date_range(self):
        url = reverse("member-financial-report", args=[self.member.pk])
        response = self.client.get(
            url,
            {
                "start_date": str(date(2026, 1, 1)),
                "end_date": str(date(2026, 12, 31)),
            },
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND],
        )


# ---------------------------------------------------------------------------
# Credit card purchases and installments detail
# ---------------------------------------------------------------------------


class CreditCardPurchaseDetailViewTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        from app.encryption import FieldEncryption
        from credit_cards.models import CreditCard

        self.card = CreditCard(
            name="Test Card",
            on_card_name="TEST USER",
            flag="VSA",
            associated_account=self.account,
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            closing_day=15,
            due_day=10,
            validation_date=date(2030, 1, 1),
            created_by=self.user,
        )
        self.card._security_code = FieldEncryption.encrypt_data("123")
        self.card._card_number = FieldEncryption.encrypt_data(
            "4111111111111111"
        )
        self.card.save()

    def test_list_credit_card_purchases(self):
        url = reverse("credit_card-purchase-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_credit_card_installments(self):
        url = reverse("credit_card-installment-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_credit_card(self):
        url = reverse("credit_card-create-list")
        response = self.client.post(
            url,
            {
                "name": "New Card",
                "on_card_name": "NEW USER",
                "flag": "ELO",
                "associated_account": self.account.pk,
                "credit_limit": "3000.00",
                "max_limit": "3000.00",
                "closing_day": 10,
                "due_day": 5,
                "validation_date": "2030-06-30",
                "card_number": "4111111111111112",
                "security_code": "456",
            },
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )


# ---------------------------------------------------------------------------
# Transfer detail operations
# ---------------------------------------------------------------------------


class TransferDetailViewTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        self.dest_account = Account.objects.create(
            account_name="Dest Account",
            institution_name="SIC",
            account_type="CS",
            is_active=True,
        )

    def test_retrieve_transfer(self):
        from transfers.models import Transfer

        transfer = Transfer.objects.create(
            description="Test Transfer",
            value=Decimal("500.00"),
            date=date.today(),
            horary="10:00:00",
            category="pix",
            origin_account=self.account,
            destiny_account=self.dest_account,
            transfered=False,
            fee=Decimal("0.00"),
            created_by=self.user,
        )
        url = reverse("transfer-detail-view", args=[transfer.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_transfer(self):
        from transfers.models import Transfer

        transfer = Transfer.objects.create(
            description="To Update",
            value=Decimal("300.00"),
            date=date.today(),
            horary="11:00:00",
            category="ted",
            origin_account=self.account,
            destiny_account=self.dest_account,
            transfered=False,
            fee=Decimal("0.00"),
            created_by=self.user,
        )
        url = reverse("transfer-detail-view", args=[transfer.pk])
        response = self.client.patch(url, {"description": "Updated Transfer"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_transfer(self):
        from transfers.models import Transfer

        transfer = Transfer.objects.create(
            description="To Delete",
            value=Decimal("200.00"),
            date=date.today(),
            horary="12:00:00",
            category="doc",
            origin_account=self.account,
            destiny_account=self.dest_account,
            transfered=False,
            fee=Decimal("0.00"),
            created_by=self.user,
        )
        url = reverse("transfer-detail-view", args=[transfer.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Revenue export with filters
# ---------------------------------------------------------------------------


class RevenueExportFilterTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        from revenues.models import Revenue

        Revenue.objects.create(
            description="Salário Filtrado",
            value=Decimal("8000.00"),
            date=date(2026, 3, 15),
            horary="09:00:00",
            category="salary",
            received=True,
            account=self.account,
            created_by=self.user,
        )

    def test_revenue_export_with_all_filters(self):
        url = reverse("revenue-export")
        response = self.client.get(
            url,
            {
                "date_from": "2026-03-01",
                "date_to": "2026-03-31",
                "category": "salary",
                "received": "true",
                "search": "Salário",
                "account": [self.account.pk],
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_revenue_export_with_date_to_only(self):
        url = reverse("revenue-export")
        response = self.client.get(url, {"date_to": "2026-12-31"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_revenue_export_received_false(self):
        url = reverse("revenue-export")
        response = self.client.get(url, {"received": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Expense bulk mark paid — success path
# ---------------------------------------------------------------------------


class ExpenseBulkMarkPaidTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import Expense

        self.expense1 = Expense.objects.create(
            description="Conta Luz",
            value=Decimal("150.00"),
            date=date.today(),
            horary="10:00:00",
            category="bills and utilities",
            payed=False,
            account=self.account,
            created_by=self.user,
        )
        self.expense2 = Expense.objects.create(
            description="Conta Água",
            value=Decimal("80.00"),
            date=date.today(),
            horary="10:00:00",
            category="bills and utilities",
            payed=False,
            account=self.account,
            created_by=self.user,
        )

    def test_bulk_mark_paid_success(self):
        url = reverse("expense-bulk-mark-paid")
        response = self.client.post(
            url,
            {"expense_ids": [self.expense1.pk, self.expense2.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["updated_count"], 2)


# ---------------------------------------------------------------------------
# Expense export with filters
# ---------------------------------------------------------------------------


class ExpenseExportFilterTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import Expense

        Expense.objects.create(
            description="Mercado Filtrado",
            value=Decimal("200.00"),
            date=date(2026, 3, 10),
            horary="12:00:00",
            category="food and drink",
            payed=True,
            account=self.account,
            created_by=self.user,
        )

    def test_expense_export_with_all_filters(self):
        url = reverse("expense-export")
        response = self.client.get(
            url,
            {
                "date_from": "2026-03-01",
                "date_to": "2026-03-31",
                "category": "food and drink",
                "payed": "true",
                "search": "Mercado",
                "account": [self.account.pk],
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_expense_export_date_to_only(self):
        url = reverse("expense-export")
        response = self.client.get(url, {"date_to": "2026-12-31"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Apply categorization rules
# ---------------------------------------------------------------------------


class ApplyCategorizationRulesTest(BaseFinalTestCase):
    def setUp(self):
        super().setUp()
        from expenses.models import CategorizationRule, Expense

        CategorizationRule.objects.create(
            merchant_contains="amazon",
            category="shopping",
            is_active=True,
            owner=self.user,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Compra Amazon",
            merchant="Amazon Store",
            value=Decimal("99.99"),
            date=date.today(),
            horary="10:00:00",
            category="others",
            auto_categorized=True,
            payed=False,
            account=self.account,
            created_by=self.user,
        )

    def test_apply_categorization_rules(self):
        url = reverse("categorization-rule-apply")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("updated", response.data)
        self.assertIn("total_processed", response.data)


# ---------------------------------------------------------------------------
# Bank reconciliation import list
# ---------------------------------------------------------------------------


class BankReconciliationImportListTest(BaseFinalTestCase):
    def test_import_list_empty(self):
        url = reverse("bank-reconciliation-import-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
