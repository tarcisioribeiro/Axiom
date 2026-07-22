import io
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from bank_reconciliation.models import BankStatementEntry, BankStatementImport
from expenses.models import Expense


class BaseAPITestCase(APITestCase):
    """Base test case with JWT-authenticated superuser."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_bank",
            email="bank@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}"
        )

        self.account = Account.objects.create(
            account_name="TEST",
            account_type="CC",
            is_active=True,
            institution_name="NUB",
        )


SAMPLE_OFX = b"""OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20240115</DTPOSTED>
<TRNAMT>-150.00</TRNAMT>
<FITID>TX001</FITID>
<MEMO>SUPERMERCADO ABC</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20240116</DTPOSTED>
<TRNAMT>3000.00</TRNAMT>
<FITID>TX002</FITID>
<MEMO>SALARIO EMPRESA XYZ</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
"""

SAMPLE_CSV = b"""data;descricao;valor
15/01/2024;SUPERMERCADO ABC;-150.00
16/01/2024;SALARIO EMPRESA XYZ;3000.00
"""

MALFORMED_FILE = b"""THIS IS NOT A VALID OFX OR CSV FILE
WITH RANDOM CONTENT
NO TRANSACTIONS HERE
"""


class BankReconciliationImportOFXTest(BaseAPITestCase):
    """Test 1: Import OFX file — happy path."""

    def test_import_ofx_creates_entries(self):
        url = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(SAMPLE_OFX)
        file_obj.name = "extrato.ofx"

        response = self.client.post(
            url,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BankStatementImport.objects.count(), 1)

        stmt_import = BankStatementImport.objects.first()
        self.assertEqual(stmt_import.status, "completed")
        self.assertEqual(stmt_import.total_entries, 2)
        self.assertEqual(stmt_import.file_format, "ofx")

        entries = BankStatementEntry.objects.filter(
            statement_import=stmt_import
        )
        self.assertEqual(entries.count(), 2)

        debit_entry = entries.get(transaction_type="debit")
        self.assertEqual(debit_entry.amount, Decimal("-150.00"))
        self.assertEqual(debit_entry.transaction_id, "TX001")

        credit_entry = entries.get(transaction_type="credit")
        self.assertEqual(credit_entry.amount, Decimal("3000.00"))


class BankReconciliationDuplicateTest(BaseAPITestCase):
    """Test 2: Import same file twice — assert 400 duplicate."""

    def test_duplicate_file_returns_400(self):
        url = reverse("bank-reconciliation-import-create")

        # First import
        file_obj = io.BytesIO(SAMPLE_OFX)
        file_obj.name = "extrato.ofx"
        response = self.client.post(
            url,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Second import (same content)
        file_obj2 = io.BytesIO(SAMPLE_OFX)
        file_obj2.name = "extrato.ofx"
        response2 = self.client.post(
            url,
            {
                "file": file_obj2,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("já importado", response2.data.get("detail", ""))

        # Only one import should exist
        self.assertEqual(BankStatementImport.objects.count(), 1)


class BankReconciliationImportCSVTest(BaseAPITestCase):
    """Test 3: Import CSV — happy path with auto-column detection."""

    def test_import_csv_creates_entries(self):
        url = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(SAMPLE_CSV)
        file_obj.name = "extrato.csv"

        response = self.client.post(
            url,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "csv",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        stmt_import = BankStatementImport.objects.first()
        self.assertEqual(stmt_import.status, "completed")
        self.assertEqual(stmt_import.total_entries, 2)

        entries = BankStatementEntry.objects.filter(
            statement_import=stmt_import
        )
        self.assertEqual(entries.count(), 2)

        debit = entries.get(transaction_type="debit")
        self.assertEqual(debit.amount, Decimal("-150.00"))
        self.assertEqual(debit.description, "SUPERMERCADO ABC")


class BankReconciliationMalformedFileTest(BaseAPITestCase):
    """Test 4: Import malformed file — assert 400 with error message."""

    def test_malformed_ofx_returns_400(self):
        url = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(MALFORMED_FILE)
        file_obj.name = "broken.ofx"

        response = self.client.post(
            url,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

        # Import should be marked as failed (or not exist if error before
        # creation)
        failed = BankStatementImport.objects.filter(status="failed")
        self.assertTrue(failed.exists())


class BankReconciliationMatchTest(BaseAPITestCase):
    """Test 5: Run match — entries receive suggestions when matching expenses
    exist."""

    def setUp(self):
        super().setUp()
        # Create an expense that matches the OFX debit
        self.expense = Expense.objects.create(
            description="Supermercado",
            value=Decimal("150.00"),
            date=date(2024, 1, 15),
            horary="12:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def test_run_match_suggests_candidates(self):
        # First import OFX
        url_create = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(SAMPLE_OFX)
        file_obj.name = "extrato.ofx"
        resp = self.client.post(
            url_create,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        import_id = resp.data["id"]

        # Run matching
        url_match = reverse(
            "bank-reconciliation-match", kwargs={"pk": import_id}
        )
        resp_match = self.client.post(url_match)
        self.assertEqual(resp_match.status_code, status.HTTP_200_OK)

        # Check debit entry has a suggestion
        debit_entry = BankStatementEntry.objects.get(
            statement_import_id=import_id, transaction_type="debit"
        )
        self.assertIsNotNone(debit_entry.matched_expense)
        self.assertEqual(debit_entry.matched_expense, self.expense)
        self.assertEqual(debit_entry.match_confidence, "high")
        # Status should still be "pending" — user must confirm
        self.assertEqual(debit_entry.status, "pending")


class BankReconciliationEntryAcceptTest(BaseAPITestCase):
    """Test 6: Accept match → status=matched; import stats updated."""

    def setUp(self):
        super().setUp()
        self.expense = Expense.objects.create(
            description="Supermercado",
            value=Decimal("150.00"),
            date=date(2024, 1, 15),
            horary="12:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        # Import and match
        url_create = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(SAMPLE_OFX)
        file_obj.name = "extrato.ofx"
        resp = self.client.post(
            url_create,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )
        self.import_id = resp.data["id"]

        url_match = reverse(
            "bank-reconciliation-match", kwargs={"pk": self.import_id}
        )
        self.client.post(url_match)

        self.debit_entry = BankStatementEntry.objects.get(
            statement_import_id=self.import_id, transaction_type="debit"
        )

    def test_accept_match_updates_status(self):
        url = reverse(
            "bank-reconciliation-entry-update",
            kwargs={"pk": self.debit_entry.pk},
        )
        response = self.client.patch(
            url,
            {"status": "matched", "matched_expense": self.expense.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.debit_entry.refresh_from_db()
        self.assertEqual(self.debit_entry.status, "matched")

        # Stats updated
        stmt_import = BankStatementImport.objects.get(pk=self.import_id)
        self.assertEqual(stmt_import.matched_count, 1)


class BankReconciliationEntryIgnoreTest(BaseAPITestCase):
    """Test 7: Ignore entry → status=ignored; counts updated."""

    def setUp(self):
        super().setUp()
        url_create = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(SAMPLE_OFX)
        file_obj.name = "extrato.ofx"
        resp = self.client.post(
            url_create,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )
        self.import_id = resp.data["id"]
        self.debit_entry = BankStatementEntry.objects.get(
            statement_import_id=self.import_id, transaction_type="debit"
        )

    def test_ignore_entry_updates_counts(self):
        url = reverse(
            "bank-reconciliation-entry-update",
            kwargs={"pk": self.debit_entry.pk},
        )
        response = self.client.patch(url, {"status": "ignored"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.debit_entry.refresh_from_db()
        self.assertEqual(self.debit_entry.status, "ignored")

        stmt_import = BankStatementImport.objects.get(pk=self.import_id)
        self.assertEqual(stmt_import.ignored_count, 1)


class BankReconciliationEntryUnmatchedTest(BaseAPITestCase):
    """Test 8: Mark entry as unmatched → status=unmatched."""

    def setUp(self):
        super().setUp()
        url_create = reverse("bank-reconciliation-import-create")
        file_obj = io.BytesIO(SAMPLE_OFX)
        file_obj.name = "extrato.ofx"
        resp = self.client.post(
            url_create,
            {
                "file": file_obj,
                "account": self.account.id,
                "file_format": "ofx",
            },
            format="multipart",
        )
        self.import_id = resp.data["id"]
        self.debit_entry = BankStatementEntry.objects.get(
            statement_import_id=self.import_id, transaction_type="debit"
        )

    def test_mark_unmatched(self):
        url = reverse(
            "bank-reconciliation-entry-update",
            kwargs={"pk": self.debit_entry.pk},
        )
        response = self.client.patch(
            url, {"status": "unmatched"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.debit_entry.refresh_from_db()
        self.assertEqual(self.debit_entry.status, "unmatched")

        stmt_import = BankStatementImport.objects.get(pk=self.import_id)
        self.assertEqual(stmt_import.unmatched_count, 1)
