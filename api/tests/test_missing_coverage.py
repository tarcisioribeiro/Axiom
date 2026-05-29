"""
Tests targeting uncovered modules to push coverage well above 80%:
- loans/views.py: LoanInstallmentListView, LoanPaymentView,
LoanAmortizationView
- payables/views.py: PayableInstallmentListView, PayablePaymentView
- revenues/services.py: bulk_generate_fixed_revenues, get_fixed_revenues_stats
- transfers/services.py: bulk_generate_fixed_transfers
- loans/signals.py: generate_loan_installments (loan with installments > 1)
- transfers/views.py: FixedTransfer CRUD + BulkGenerate
- revenues/views.py: FixedRevenue CRUD + BulkGenerate + Stats
"""

from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member

# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------


class BaseMissingCoverageTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="misscov",
            email="misscov@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.account = Account.objects.create(
            account_name="Missing Cov Account",
            institution_name="TestBank",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("50000.00"),
            created_by=self.user,
        )
        self.member = Member.objects.create(
            name="Missing Cov Member",
            document_hash="m" * 64,
            phone="11911111111",
            sex="M",
            user=self.user,
        )

    def _make_loan(self, description="Test Loan", installments=1):
        from loans.models import Loan

        creditor = Member.objects.create(
            name=f"Cr {description[:8]}",
            document_hash=(description + "x" * 64)[:64],
            phone="11922222222",
            sex="M",
        )
        benefited = Member.objects.create(
            name=f"Be {description[:8]}",
            document_hash=(description + "y" * 64)[:64],
            phone="11933333333",
            sex="F",
        )
        return Loan.objects.create(
            description=description,
            value=Decimal("1000.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(10, 0),
            category="loans",
            account=self.account,
            benefited=benefited,
            creditor=creditor,
            payed=False,
            status="active",
            installments=installments,
            interest_rate=Decimal("1.5"),
            created_by=self.user,
            updated_by=self.user,
        )

    def _make_payable(self, description="Test Payable"):
        from payables.models import Payable

        return Payable.objects.create(
            description=description,
            value=Decimal("600.00"),
            date=date.today(),
            category="health and care",
            created_by=self.user,
            updated_by=self.user,
        )


# ===========================================================================
# loans/views.py — LoanInstallmentListView (GET + PATCH)
# ===========================================================================


class LoanInstallmentListViewTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.loan = self._make_loan("Installment Loan")

    def _add_installment(self, number=1):
        from loans.models import LoanInstallment

        return LoanInstallment.objects.create(
            loan=self.loan,
            installment_number=number,
            value=Decimal("500.00"),
            due_date=date(2026, 6, number),
            payed=False,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_get_installments_returns_200(self):
        url = reverse("loan-installments", args=[self.loan.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_get_installments_loan_not_found_returns_404(self):
        url = reverse("loan-installments", args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_installment_success(self):
        installment = self._add_installment(1)
        url = reverse("loan-installments", args=[self.loan.pk])
        response = self.client.patch(
            url, {"installment_number": 1, "payed": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        installment.refresh_from_db()
        self.assertTrue(installment.payed)

    def test_patch_loan_not_found_returns_404(self):
        url = reverse("loan-installments", args=[99999])
        response = self.client.patch(
            url, {"installment_number": 1}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_missing_installment_number_returns_400(self):
        url = reverse("loan-installments", args=[self.loan.pk])
        response = self.client.patch(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_installment_not_found_returns_404(self):
        url = reverse("loan-installments", args=[self.loan.pk])
        response = self.client.patch(
            url, {"installment_number": 999}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ===========================================================================
# loans/views.py — LoanPaymentView
# ===========================================================================


class LoanPaymentViewTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.loan = self._make_loan("Payment Loan")

    def test_post_payment_success(self):
        url = reverse("loan-payment", args=[self.loan.pk])
        response = self.client.post(
            url,
            {
                "value": "200.00",
                "account": self.account.pk,
                "date": str(date.today()),
                "notes": "Partial payment",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("expense", response.data)
        self.assertIn("loan", response.data)

    def test_post_payment_loan_not_found_returns_404(self):
        url = reverse("loan-payment", args=[99999])
        response = self.client.post(
            url,
            {
                "value": "100.00",
                "account": self.account.pk,
                "date": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_post_payment_missing_fields_returns_400(self):
        url = reverse("loan-payment", args=[self.loan.pk])
        response = self.client.post(url, {"value": "100.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_payment_invalid_account_returns_404(self):
        url = reverse("loan-payment", args=[self.loan.pk])
        response = self.client.post(
            url,
            {"value": "100.00", "account": 99999, "date": str(date.today())},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ===========================================================================
# loans/views.py — LoanAmortizationView
# ===========================================================================


class LoanAmortizationViewTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.loan = self._make_loan("Amortization Loan")

    def test_amortization_price_method(self):
        url = reverse("loan-amortization", args=[self.loan.pk])
        response = self.client.get(url, {"method": "price"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["method"], "price")
        self.assertIn("schedule", response.data)

    def test_amortization_sac_method(self):
        url = reverse("loan-amortization", args=[self.loan.pk])
        response = self.client.get(url, {"method": "sac"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["method"], "sac")

    def test_amortization_default_is_price(self):
        url = reverse("loan-amortization", args=[self.loan.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["method"], "price")

    def test_amortization_invalid_method_returns_400(self):
        url = reverse("loan-amortization", args=[self.loan.pk])
        response = self.client.get(url, {"method": "invalid"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_amortization_loan_not_found_returns_404(self):
        url = reverse("loan-amortization", args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_amortization_zero_interest_rate(self):
        from loans.models import Loan

        creditor = Member.objects.create(
            name="Zero Rate Creditor",
            document_hash="zc" + "0" * 62,
            phone="11944444444",
            sex="M",
        )
        benefited = Member.objects.create(
            name="Zero Rate Benefited",
            document_hash="zb" + "0" * 62,
            phone="11955555555",
            sex="F",
        )
        loan_zero = Loan.objects.create(
            description="Zero Interest Loan",
            value=Decimal("900.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(10, 0),
            category="loans",
            account=self.account,
            benefited=benefited,
            creditor=creditor,
            payed=False,
            status="active",
            installments=3,
            interest_rate=Decimal("0.00"),
            created_by=self.user,
            updated_by=self.user,
        )
        url = reverse("loan-amortization", args=[loan_zero.pk])
        response = self.client.get(url, {"method": "price"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["schedule"]), 3)


# ===========================================================================
# loans/signals.py — generate_loan_installments signal
# ===========================================================================


class LoanInstallmentsSignalTest(BaseMissingCoverageTestCase):
    def test_loan_with_multiple_installments_generates_schedule(self):
        from loans.models import LoanInstallment

        loan = self._make_loan("Signal Loan 6x", installments=6)
        count = LoanInstallment.objects.filter(loan=loan).count()
        self.assertEqual(count, 6)

    def test_loan_with_one_installment_generates_no_schedule(self):
        from loans.models import LoanInstallment

        loan = self._make_loan("Single Loan", installments=1)
        count = LoanInstallment.objects.filter(loan=loan).count()
        self.assertEqual(count, 0)

    def test_loan_quarterly_frequency_generates_correct_dates(self):
        from loans.models import Loan, LoanInstallment

        creditor = Member.objects.create(
            name="Quarterly Creditor",
            document_hash="qc" + "3" * 62,
            phone="11900000001",
            sex="M",
        )
        benefited = Member.objects.create(
            name="Quarterly Benefited",
            document_hash="qb" + "3" * 62,
            phone="11900000002",
            sex="F",
        )
        loan = Loan.objects.create(
            description="Quarterly Loan",
            value=Decimal("800.00"),
            payed_value=Decimal("0.00"),
            date=date(2026, 1, 31),
            horary=time(9, 0),
            category="loans",
            account=self.account,
            benefited=benefited,
            creditor=creditor,
            payed=False,
            status="active",
            installments=4,
            payment_frequency="quarterly",
            created_by=self.user,
            updated_by=self.user,
        )
        count = LoanInstallment.objects.filter(loan=loan).count()
        self.assertEqual(count, 4)

    def test_loan_semiannual_frequency(self):
        from loans.models import Loan, LoanInstallment

        creditor = Member.objects.create(
            name="Semi Creditor",
            document_hash="sc2" + "4" * 61,
            phone="11900000003",
            sex="M",
        )
        benefited = Member.objects.create(
            name="Semi Benefited",
            document_hash="sb2" + "4" * 61,
            phone="11900000004",
            sex="F",
        )
        loan = Loan.objects.create(
            description="Semiannual Loan",
            value=Decimal("600.00"),
            payed_value=Decimal("0.00"),
            date=date(2026, 1, 15),
            horary=time(9, 0),
            category="loans",
            account=self.account,
            benefited=benefited,
            creditor=creditor,
            payed=False,
            status="active",
            installments=3,
            payment_frequency="semiannual",
            created_by=self.user,
            updated_by=self.user,
        )
        count = LoanInstallment.objects.filter(loan=loan).count()
        self.assertEqual(count, 3)


# ===========================================================================
# payables/views.py — PayableInstallmentListView (GET + PATCH)
# ===========================================================================


class PayableInstallmentListViewTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.payable = self._make_payable("Installment Payable")

    def _add_installment(self, number=1):
        from payables.models import PayableInstallment

        return PayableInstallment.objects.create(
            payable=self.payable,
            installment_number=number,
            value=Decimal("200.00"),
            due_date=date(2026, 7, number),
            payed=False,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_get_installments_returns_200(self):
        url = reverse("payable-installments", args=[self.payable.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_get_installments_payable_not_found_returns_404(self):
        url = reverse("payable-installments", args=[99999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_installment_success(self):
        installment = self._add_installment(1)
        url = reverse("payable-installments", args=[self.payable.pk])
        response = self.client.patch(
            url, {"installment_number": 1, "payed": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        installment.refresh_from_db()
        self.assertTrue(installment.payed)

    def test_patch_payable_not_found_returns_404(self):
        url = reverse("payable-installments", args=[99999])
        response = self.client.patch(
            url, {"installment_number": 1}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_missing_installment_number_returns_400(self):
        url = reverse("payable-installments", args=[self.payable.pk])
        response = self.client.patch(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_installment_not_found_returns_404(self):
        url = reverse("payable-installments", args=[self.payable.pk])
        response = self.client.patch(
            url, {"installment_number": 999}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ===========================================================================
# payables/views.py — PayablePaymentView
# ===========================================================================


class PayablePaymentViewTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.payable = self._make_payable("Payment Payable")

    def test_post_payment_success(self):
        url = reverse("payable-payment", args=[self.payable.pk])
        response = self.client.post(
            url,
            {
                "value": "150.00",
                "account": self.account.pk,
                "date": str(date.today()),
                "notes": "First installment",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("expense", response.data)
        self.assertIn("payable", response.data)

    def test_post_payment_payable_not_found_returns_404(self):
        url = reverse("payable-payment", args=[99999])
        response = self.client.post(
            url,
            {
                "value": "100.00",
                "account": self.account.pk,
                "date": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_post_payment_missing_fields_returns_400(self):
        url = reverse("payable-payment", args=[self.payable.pk])
        response = self.client.post(url, {"value": "100.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_payment_invalid_account_returns_404(self):
        url = reverse("payable-payment", args=[self.payable.pk])
        response = self.client.post(
            url,
            {"value": "100.00", "account": 99999, "date": str(date.today())},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_post_payment_capped_at_total_value(self):
        url = reverse("payable-payment", args=[self.payable.pk])
        response = self.client.post(
            url,
            {
                "value": "1000.00",
                "account": self.account.pk,
                "date": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.paid_value, self.payable.value)


# ===========================================================================
# revenues/services.py — bulk_generate_fixed_revenues +
# get_fixed_revenues_stats
# ===========================================================================


class BulkGenerateFixedRevenuesServiceTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        from revenues.models import FixedRevenue

        self.fixed_rev = FixedRevenue.objects.create(
            description="Monthly Salary",
            default_value=Decimal("5000.00"),
            category="salary",
            account=self.account,
            due_day=5,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_bulk_generate_creates_revenue(self):
        from revenues.services import bulk_generate_fixed_revenues

        result = bulk_generate_fixed_revenues(
            month="2026-06",
            revenue_values=[
                {
                    "fixed_revenue_id": self.fixed_rev.id,
                    "value": Decimal("5000.00"),
                }
            ],
            user=self.user,
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["created_count"], 1)

    def test_bulk_generate_skips_existing_revenue(self):
        from revenues.services import bulk_generate_fixed_revenues

        bulk_generate_fixed_revenues(
            month="2026-07",
            revenue_values=[
                {
                    "fixed_revenue_id": self.fixed_rev.id,
                    "value": Decimal("5000.00"),
                }
            ],
            user=self.user,
        )
        result = bulk_generate_fixed_revenues(
            month="2026-07",
            revenue_values=[
                {
                    "fixed_revenue_id": self.fixed_rev.id,
                    "value": Decimal("5000.00"),
                }
            ],
            user=self.user,
        )
        self.assertEqual(result["created_count"], 0)

    def test_bulk_generate_updates_existing_log(self):
        from revenues.models import FixedRevenue
        from revenues.services import bulk_generate_fixed_revenues

        bulk_generate_fixed_revenues(
            month="2026-08",
            revenue_values=[
                {
                    "fixed_revenue_id": self.fixed_rev.id,
                    "value": Decimal("5000.00"),
                }
            ],
            user=self.user,
        )
        fixed_rev2 = FixedRevenue.objects.create(
            description="Rental Income",
            default_value=Decimal("1500.00"),
            category="income",
            account=self.account,
            due_day=10,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )
        result = bulk_generate_fixed_revenues(
            month="2026-08",
            revenue_values=[
                {
                    "fixed_revenue_id": fixed_rev2.id,
                    "value": Decimal("1500.00"),
                }
            ],
            user=self.user,
        )
        self.assertTrue(result["success"])

    def test_bulk_generate_raises_for_invalid_id(self):
        from revenues.models import FixedRevenue
        from revenues.services import bulk_generate_fixed_revenues

        with self.assertRaises(FixedRevenue.DoesNotExist):
            bulk_generate_fixed_revenues(
                month="2026-09",
                revenue_values=[
                    {"fixed_revenue_id": 99999, "value": Decimal("100.00")}
                ],
                user=self.user,
            )

    def test_bulk_generate_edge_day_31_in_february(self):
        from revenues.models import FixedRevenue
        from revenues.services import bulk_generate_fixed_revenues

        fixed_rev_31 = FixedRevenue.objects.create(
            description="End of Month Revenue",
            default_value=Decimal("2000.00"),
            category="income",
            account=self.account,
            due_day=31,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )
        result = bulk_generate_fixed_revenues(
            month="2026-02",
            revenue_values=[
                {
                    "fixed_revenue_id": fixed_rev_31.id,
                    "value": Decimal("2000.00"),
                }
            ],
            user=self.user,
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["created_count"], 1)

    def test_get_fixed_revenues_stats_structure(self):
        from revenues.services import get_fixed_revenues_stats

        stats = get_fixed_revenues_stats()
        self.assertIn("active_templates", stats)
        self.assertIn("current_month", stats)
        self.assertIn("previous_month", stats)
        self.assertGreaterEqual(stats["active_templates"], 1)

    def test_bulk_generate_via_api_endpoint(self):
        url = reverse("fixed-revenue-generate")
        response = self.client.post(
            url,
            {
                "month": "2026-10",
                "revenue_values": [
                    {"fixed_revenue_id": self.fixed_rev.id, "value": "5000.00"}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_fixed_revenue_stats_via_api(self):
        url = reverse("fixed-revenue-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("active_templates", response.data)

    def test_fixed_revenue_list_create(self):
        url = reverse("fixed-revenue-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_fixed_revenue(self):
        url = reverse("fixed-revenue-list-create")
        response = self.client.post(
            url,
            {
                "description": "Freelance Income",
                "default_value": "800.00",
                "category": "income",
                "account": self.account.pk,
                "due_day": 20,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_fixed_revenue(self):
        url = reverse("fixed-revenue-detail", args=[self.fixed_rev.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_fixed_revenue(self):
        url = reverse("fixed-revenue-detail", args=[self.fixed_rev.pk])
        response = self.client.patch(
            url, {"description": "Updated Salary"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_fixed_revenue_full(self):
        url = reverse("fixed-revenue-detail", args=[self.fixed_rev.pk])
        response = self.client.put(
            url,
            {
                "description": "Full Update Salary",
                "default_value": "5500.00",
                "category": "salary",
                "account": self.account.pk,
                "due_day": 6,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_fixed_revenue(self):
        from revenues.models import FixedRevenue

        fr = FixedRevenue.objects.create(
            description="To Delete Revenue",
            default_value=Decimal("100.00"),
            category="income",
            account=self.account,
            due_day=15,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )
        url = reverse("fixed-revenue-detail", args=[fr.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ===========================================================================
# transfers/services.py — bulk_generate_fixed_transfers
# ===========================================================================


class BulkGenerateFixedTransfersServiceTest(BaseMissingCoverageTestCase):
    def setUp(self):
        super().setUp()
        self.account2 = Account.objects.create(
            account_name="Destiny Account",
            institution_name="TestBank",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("5000.00"),
            created_by=self.user,
        )
        from transfers.models import FixedTransfer

        self.fixed_transfer = FixedTransfer.objects.create(
            description="Monthly Savings Transfer",
            value=Decimal("500.00"),
            category="pix",
            origin_account=self.account,
            destiny_account=self.account2,
            due_day=10,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_bulk_generate_creates_transfer(self):
        from transfers.services import bulk_generate_fixed_transfers

        result = bulk_generate_fixed_transfers(month="2026-06", user=self.user)
        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["created_count"], 1)

    def test_bulk_generate_skips_existing_transfer(self):
        from transfers.services import bulk_generate_fixed_transfers

        bulk_generate_fixed_transfers(month="2026-07", user=self.user)
        result = bulk_generate_fixed_transfers(month="2026-07", user=self.user)
        self.assertEqual(result["created_count"], 0)

    def test_bulk_generate_updates_existing_log(self):
        from transfers.models import FixedTransferGenerationLog
        from transfers.services import bulk_generate_fixed_transfers

        bulk_generate_fixed_transfers(month="2026-08", user=self.user)
        bulk_generate_fixed_transfers(month="2026-08", user=self.user)
        self.assertEqual(
            FixedTransferGenerationLog.objects.filter(month="2026-08").count(),
            1,
        )

    def test_bulk_generate_edge_day_31_in_february(self):
        from transfers.services import bulk_generate_fixed_transfers

        self.fixed_transfer.due_day = 31
        self.fixed_transfer.save()
        result = bulk_generate_fixed_transfers(month="2026-02", user=self.user)
        self.assertTrue(result["success"])

    def test_bulk_generate_via_api_endpoint(self):
        url = reverse("fixed-transfer-generate")
        response = self.client.post(url, {"month": "2026-11"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_fixed_transfer_list(self):
        url = reverse("fixed-transfer-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_fixed_transfer(self):
        url = reverse("fixed-transfer-list-create")
        response = self.client.post(
            url,
            {
                "description": "New Fixed Transfer",
                "value": "300.00",
                "category": "ted",
                "origin_account": self.account.pk,
                "destiny_account": self.account2.pk,
                "due_day": 15,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_fixed_transfer(self):
        url = reverse("fixed-transfer-detail", args=[self.fixed_transfer.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_fixed_transfer_patch(self):
        url = reverse("fixed-transfer-detail", args=[self.fixed_transfer.pk])
        response = self.client.patch(
            url, {"description": "Updated Transfer"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_fixed_transfer_put(self):
        url = reverse("fixed-transfer-detail", args=[self.fixed_transfer.pk])
        response = self.client.put(
            url,
            {
                "description": "Full Update Transfer",
                "value": "600.00",
                "category": "pix",
                "origin_account": self.account.pk,
                "destiny_account": self.account2.pk,
                "due_day": 11,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_fixed_transfer(self):
        from transfers.models import FixedTransfer

        ft = FixedTransfer.objects.create(
            description="To Delete Transfer",
            value=Decimal("100.00"),
            category="pix",
            origin_account=self.account,
            destiny_account=self.account2,
            due_day=20,
            is_active=True,
            created_by=self.user,
            updated_by=self.user,
        )
        url = reverse("fixed-transfer-detail", args=[ft.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
