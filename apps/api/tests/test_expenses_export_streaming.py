"""
Tests for ExportExpensesView streaming / memory-safety behaviour.

Covers:
- CSV export returns StreamingHttpResponse (not buffered HttpResponse)
- CSV content is correct for >1 000 records without loading all into memory
- PDF export returns 413 when record count exceeds 10 000
- PDF export succeeds when count is within the limit
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from expenses.models import Expense
from members.models import Member


class ExportExpensesStreamingTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="export_stream_user",
            email="export_stream@test.com",
            password="testpass123",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

        Member.objects.create(
            name="Export Stream User",
            document_hash="a" * 64,
            phone="11900000001",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Stream Test Account",
            institution_name="TestBank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("10000.00"),
        )

    def _create_expenses(self, count: int) -> None:
        Expense.objects.bulk_create(
            [
                Expense(
                    description=f"Expense {i}",
                    value=Decimal("10.00"),
                    date="2025-01-15",
                    horary="10:00:00",
                    category="food",
                    payed=True,
                    account=self.account,
                    created_by=self.user,
                )
                for i in range(count)
            ]
        )

    # ------------------------------------------------------------------
    # CSV streaming
    # ------------------------------------------------------------------

    def test_csv_export_returns_streaming_response(self):
        """CSV export must return StreamingHttpResponse, not a plain
        HttpResponse."""
        self._create_expenses(5)
        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "csv"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response, StreamingHttpResponse)
        self.assertIn("text/csv", response["Content-Type"])

    def test_csv_export_over_1000_records(self):
        """CSV export with >1 000 records streams all rows without memory
        blow-up."""
        RECORD_COUNT = 1_200
        self._create_expenses(RECORD_COUNT)

        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "csv"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response, StreamingHttpResponse)

        # Consume the stream and count data rows (excluding BOM + header)
        content = b"".join(response.streaming_content).decode("utf-8-sig")
        lines = [ln for ln in content.splitlines() if ln.strip()]
        # First line is the header; remaining are data rows
        data_rows = lines[1:]
        self.assertEqual(len(data_rows), RECORD_COUNT)

    def test_csv_export_content_disposition(self):
        """CSV Content-Disposition header must suggest a .csv filename."""
        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "csv"})

        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn(".csv", response["Content-Disposition"])

    # ------------------------------------------------------------------
    # PDF row-cap guard
    # ------------------------------------------------------------------

    def test_pdf_export_returns_413_when_over_limit(self):
        """PDF export with >10 000 rows must return 413."""
        # Bulk-create 10 001 expenses
        self._create_expenses(10_001)

        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "pdf"})

        self.assertEqual(
            response.status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        )
        self.assertIn("detail", response.data)
        self.assertIn("10000", response.data["detail"])

    def test_pdf_export_succeeds_within_limit(self):
        """PDF export with a small dataset must return 200 with
        application/pdf."""
        self._create_expenses(3)

        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "pdf"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", response["Content-Type"])

    def test_pdf_export_content_disposition(self):
        """PDF Content-Disposition header must suggest a .pdf filename."""
        self._create_expenses(1)
        url = reverse("expense-export")
        response = self.client.get(url, {"export_format": "pdf"})

        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn(".pdf", response["Content-Disposition"])
