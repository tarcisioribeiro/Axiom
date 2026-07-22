"""
Coverage for BookFileView, BookFileStreamView, goal_progress service,
and related library/vaults code.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class BaseTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="filetest",
            email="file@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="File Test User",
            document_hash="f" * 63 + "1",
            phone="11999998801",
            sex="M",
            user=self.user,
        )
        from library.models import Author, Book, Publisher

        self.publisher = Publisher.objects.create(
            name="Test Publisher File", owner=self.member
        )
        self.author = Author.objects.create(
            name="Test Author File", owner=self.member
        )
        self.book = Book.objects.create(
            title="Digital Book",
            pages=100,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            media_type="Dig",
            owner=self.member,
        )
        self.book.authors.set([self.author])
        self.physical_book = Book.objects.create(
            title="Physical Book",
            pages=100,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            media_type="Phi",
            owner=self.member,
        )
        self.physical_book.authors.set([self.author])


# ---------------------------------------------------------------------------
# BookFileView — error paths (no MinIO needed)
# ---------------------------------------------------------------------------


class BookFileViewNotFoundTest(BaseTestCase):
    def test_get_nonexistent_book_returns_404(self):
        url = reverse("book-file", args=[999999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_book_without_file_returns_404(self):
        url = reverse("book-file", args=[self.book.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_nonexistent_book_returns_404(self):
        url = reverse("book-file", args=[999999])
        response = self.client.patch(url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_physical_book_returns_400(self):
        url = reverse("book-file", args=[self.physical_book.pk])
        response = self.client.patch(url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_no_file_returns_400(self):
        url = reverse("book-file", args=[self.book.pk])
        response = self.client.patch(url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_invalid_extension_returns_400(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        url = reverse("book-file", args=[self.book.pk])
        file = SimpleUploadedFile(
            "book.docx", b"content", content_type="application/octet-stream"
        )
        response = self.client.patch(
            url, {"book_file": file}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_nonexistent_book_returns_404(self):
        url = reverse("book-file", args=[999999])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_book_without_file_returns_404(self):
        url = reverse("book-file", args=[self.book.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# BookFileStreamView — error paths
# ---------------------------------------------------------------------------


class BookFileStreamViewTest(BaseTestCase):
    def test_stream_nonexistent_book_returns_404(self):
        url = reverse("book-file-stream", args=[999999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_stream_book_without_file_returns_404(self):
        url = reverse("book-file-stream", args=[self.book.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# library views — X-Forwarded-For and log_activity exception branch
# ---------------------------------------------------------------------------


class LibraryXForwardedForTest(BaseTestCase):
    def test_list_books_with_x_forwarded_for(self):
        """Covers get_client_ip X-Forwarded-For branch (line 66)."""
        url = reverse("book-list-create")
        response = self.client.get(
            url, HTTP_X_FORWARDED_FOR="10.0.0.1, 10.0.0.2"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# goal_progress service — unit tests (no DB needed for the core logic)
# ---------------------------------------------------------------------------


class ComputeProgressUnitTest(APITestCase):
    """Tests for vaults/services/goal_progress.py."""

    def _make_goal(
        self,
        category,
        target,
        current=None,
        linked_expense_category=None,
        linked_account_id=None,
    ):
        goal = MagicMock()
        goal.category = category
        goal.target_value = Decimal(str(target))
        if current is not None:
            goal.current_value = Decimal(str(current))
        goal.linked_expense_category = linked_expense_category
        goal.linked_account_id = linked_account_id
        goal.created_by = None
        return goal

    def test_vault_based_category_returns_vaults_data_source(self):
        from vaults.services.goal_progress import compute_progress

        goal = self._make_goal("savings", 1000, current=500)
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "vaults")
        self.assertEqual(result["percentage"], Decimal("50.00"))

    def test_unknown_category_falls_through_to_vaults(self):
        from vaults.services.goal_progress import compute_progress

        goal = self._make_goal("unknown_cat", 200, current=100)
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "vaults")

    def test_target_zero_returns_zero_percentage(self):
        from vaults.services.goal_progress import compute_progress

        goal = self._make_goal("savings", 0, current=0)
        result = compute_progress(goal)
        self.assertEqual(result["percentage"], Decimal("0.00"))

    def test_percentage_capped_at_100(self):
        from vaults.services.goal_progress import compute_progress

        goal = self._make_goal("savings", 100, current=500)
        result = compute_progress(goal)
        self.assertEqual(result["percentage"], Decimal("100.00"))


class ComputeProgressWithDBTest(APITestCase):
    """Tests for goal_progress branches that hit the database."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="goalprog",
            email="goalprog@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.account = Account.objects.create(
            account_name="Goal Account",
            institution_name="BNK",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("0.00"),
        )

    def _make_db_goal(
        self,
        category,
        target,
        linked_expense_category=None,
        linked_account=None,
    ):
        goal = MagicMock()
        goal.category = category
        goal.target_value = Decimal(str(target))
        goal.current_value = Decimal("0.00")
        goal.linked_expense_category = linked_expense_category
        goal.linked_account_id = linked_account.pk if linked_account else None
        goal.created_by = self.user
        return goal

    def test_reduce_expenses_no_expenses(self):
        from vaults.services.goal_progress import compute_progress

        goal = self._make_db_goal("reduce_expenses", 1000)
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "expenses")
        self.assertEqual(result["current_value"], Decimal("0.00"))

    def test_reduce_expenses_with_category_filter(self):
        from expenses.models import Expense
        from vaults.services.goal_progress import compute_progress

        Expense.objects.create(
            description="Rent",
            value=Decimal("500.00"),
            date=date.today(),
            horary="10:00:00",
            category="bills and services",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        goal = self._make_db_goal(
            "reduce_expenses",
            1000,
            linked_expense_category="bills and services",
        )
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "expenses")
        self.assertEqual(result["current_value"], Decimal("500.00"))

    def test_reduce_expenses_with_account_filter(self):
        from expenses.models import Expense
        from vaults.services.goal_progress import compute_progress

        Expense.objects.create(
            description="Food",
            value=Decimal("200.00"),
            date=date.today(),
            horary="11:00:00",
            category="food",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        goal = self._make_db_goal(
            "reduce_expenses", 1000, linked_account=self.account
        )
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "expenses")
        self.assertEqual(result["current_value"], Decimal("200.00"))

    def test_increase_revenue_no_revenues(self):
        from vaults.services.goal_progress import compute_progress

        goal = self._make_db_goal("increase_revenue", 5000)
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "revenues")
        self.assertEqual(result["current_value"], Decimal("0.00"))

    def test_increase_revenue_with_account_filter(self):
        from revenues.models import Revenue
        from vaults.services.goal_progress import compute_progress

        Revenue.objects.create(
            description="Salary",
            value=Decimal("3000.00"),
            date=date.today(),
            horary="09:00:00",
            category="salary",
            account=self.account,
            received=True,
            created_by=self.user,
        )
        goal = self._make_db_goal(
            "increase_revenue", 5000, linked_account=self.account
        )
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "revenues")
        self.assertEqual(result["current_value"], Decimal("3000.00"))

    def test_increase_revenue_without_account_filter(self):
        from revenues.models import Revenue
        from vaults.services.goal_progress import compute_progress

        Revenue.objects.create(
            description="Freelance",
            value=Decimal("1000.00"),
            date=date.today(),
            horary="08:00:00",
            category="freelance",
            account=self.account,
            received=True,
            created_by=self.user,
        )
        goal = self._make_db_goal("increase_revenue", 5000)
        result = compute_progress(goal)
        self.assertEqual(result["data_source"], "revenues")
        self.assertGreaterEqual(result["current_value"], Decimal("1000.00"))
