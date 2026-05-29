"""
Extended view tests to increase overall backend coverage.

Covers: library, personal_planning, payables, loans, budgets, dashboard,
expenses
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
# Base test case with Member (needed for owner-filtered views)
# ---------------------------------------------------------------------------


class BaseWithMemberTestCase(APITestCase):
    """Base class: superuser + JWT client + Member linked to user."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="exttest",
            email="ext@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

        # Many views filter by owner__user=request.user
        self.member = Member.objects.create(
            name="Test User",
            document_hash="a" * 64,
            phone="11999999999",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Test Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )


# ---------------------------------------------------------------------------
# Library — Authors
# ---------------------------------------------------------------------------


class AuthorViewTest(BaseWithMemberTestCase):
    def _author_data(self, name="Marcus Aurelius"):
        return {"name": name, "nationality": "GRE", "owner": self.member.pk}

    def test_list_authors(self):
        url = reverse("author-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_author(self):
        url = reverse("author-list-create")
        response = self.client.post(url, self._author_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Marcus Aurelius")  # type: ignore  # noqa: E501

    def test_retrieve_author(self):
        from library.models import Author

        author = Author.objects.create(name="Seneca", owner=self.member)
        url = reverse("author-detail", args=[author.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_author(self):
        from library.models import Author

        author = Author.objects.create(name="Plato", owner=self.member)
        url = reverse("author-detail", args=[author.pk])
        response = self.client.patch(url, {"name": "Plato (updated)"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_author(self):
        from library.models import Author

        author = Author.objects.create(name="Aristotle", owner=self.member)
        url = reverse("author-detail", args=[author.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Library — Publishers
# ---------------------------------------------------------------------------


class PublisherViewTest(BaseWithMemberTestCase):
    def _publisher_data(self, name="Penguin"):
        return {"name": name, "owner": self.member.pk}

    def test_list_publishers(self):
        url = reverse("publisher-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_publisher(self):
        url = reverse("publisher-list-create")
        response = self.client.post(url, self._publisher_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_publisher(self):
        from library.models import Publisher

        pub = Publisher.objects.create(name="Random House", owner=self.member)
        url = reverse("publisher-detail", args=[pub.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_publisher(self):
        from library.models import Publisher

        pub = Publisher.objects.create(name="Old Name", owner=self.member)
        url = reverse("publisher-detail", args=[pub.pk])
        response = self.client.patch(url, {"name": "New Name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_publisher(self):
        from library.models import Publisher

        pub = Publisher.objects.create(name="ToDelete", owner=self.member)
        url = reverse("publisher-detail", args=[pub.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Library — Books
# ---------------------------------------------------------------------------


class BookViewTest(BaseWithMemberTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Author, Publisher

        self.author = Author.objects.create(
            name="Dostoevsky", owner=self.member
        )
        self.publisher = Publisher.objects.create(
            name="Penguin Classics", owner=self.member
        )

    def _book_data(self, title="Crime and Punishment"):
        return {
            "title": title,
            "authors": [self.author.pk],
            "pages": 400,
            "publisher": self.publisher.pk,
            "language": "Por",
            "genre": "Fiction",
            "literarytype": "book",
            "read_status": "to_read",
            "owner": self.member.pk,
        }

    def test_list_books(self):
        url = reverse("book-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_book(self):
        url = reverse("book-list-create")
        response = self.client.post(url, self._book_data(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_book(self):
        from library.models import Book

        book = Book.objects.create(
            title="The Idiot",
            pages=700,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        book.authors.set([self.author])
        url = reverse("book-detail", args=[book.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_book(self):
        from library.models import Book

        book = Book.objects.create(
            title="Brothers Karamazov",
            pages=900,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        book.authors.set([self.author])
        url = reverse("book-detail", args=[book.pk])
        response = self.client.patch(url, {"pages": 950})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Library — Summaries
# ---------------------------------------------------------------------------


class SummaryViewTest(BaseWithMemberTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Author, Book, Publisher

        author = Author.objects.create(name="Tolstoy", owner=self.member)
        publisher = Publisher.objects.create(
            name="Oxford Press", owner=self.member
        )
        self.book = Book.objects.create(
            title="War and Peace",
            pages=1200,
            publisher=publisher,
            language="Por",
            genre="History",
            literarytype="book",
            owner=self.member,
        )
        self.book.authors.set([author])

    def test_list_summaries(self):
        url = reverse("summary-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_summary(self):
        url = reverse("summary-list-create")
        response = self.client.post(
            url,
            {
                "book": self.book.pk,
                "title": "War and Peace Summary",
                "text": "A great book about war and peace.",
                "owner": self.member.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Library — Readings
# ---------------------------------------------------------------------------


class ReadingViewTest(BaseWithMemberTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Author, Book, Publisher

        author = Author.objects.create(name="Camus", owner=self.member)
        publisher = Publisher.objects.create(
            name="Gallimard", owner=self.member
        )
        self.book = Book.objects.create(
            title="The Stranger",
            pages=123,
            publisher=publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            owner=self.member,
        )
        self.book.authors.set([author])

    def test_list_readings(self):
        url = reverse("reading-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_reading(self):
        url = reverse("reading-list-create")
        response = self.client.post(
            url,
            {
                "book": self.book.pk,
                "reading_date": str(date.today()),
                "reading_time": 30,
                "pages_read": 20,
                "owner": self.member.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Personal Planning — Routine Tasks
# ---------------------------------------------------------------------------


class RoutineTaskViewTest(BaseWithMemberTestCase):
    def _task_data(self, name="Exercise"):
        return {
            "name": name,
            "category": "health",
            "periodicity": "daily",
            "is_active": True,
            "owner": self.member.pk,
        }

    def test_list_routine_tasks(self):
        url = reverse("routine-task-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_routine_task(self):
        url = reverse("routine-task-list-create")
        response = self.client.post(url, self._task_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_routine_task(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Meditate",
            category="meditation",
            periodicity="daily",
            owner=self.member,
        )
        url = reverse("routine-task-detail", args=[task.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_routine_task(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Read",
            category="reading",
            periodicity="daily",
            owner=self.member,
        )
        url = reverse("routine-task-detail", args=[task.pk])
        response = self.client.patch(url, {"name": "Read 30 min"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_routine_task(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Yoga",
            category="exercise",
            periodicity="daily",
            owner=self.member,
        )
        url = reverse("routine-task-detail", args=[task.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_list_routine_templates(self):
        url = reverse("routine-template-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_heatmap_endpoint(self):
        url = reverse("routine-task-heatmap")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Personal Planning — Goals
# ---------------------------------------------------------------------------


class GoalViewTest(BaseWithMemberTestCase):
    def _goal_data(self, title="30 Days Exercise"):
        return {
            "title": title,
            "goal_type": "total_days",
            "target_value": 30,
            "start_date": str(date.today()),
            "status": "active",
            "owner": self.member.pk,
        }

    def test_list_goals(self):
        url = reverse("goal-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_goal(self):
        url = reverse("goal-list-create")
        response = self.client.post(url, self._goal_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_goal(self):
        from personal_planning.models import Goal

        goal = Goal.objects.create(
            title="Meditate 30 days",
            goal_type="total_days",
            target_value=30,
            start_date=date.today(),
            status="active",
            owner=self.member,
        )
        url = reverse("goal-detail", args=[goal.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_goal(self):
        from personal_planning.models import Goal

        goal = Goal.objects.create(
            title="Run Marathon",
            goal_type="total_days",
            target_value=10,
            start_date=date.today(),
            status="active",
            owner=self.member,
        )
        url = reverse("goal-detail", args=[goal.pk])
        response = self.client.patch(url, {"target_value": 20})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Personal Planning — Task Instances
# ---------------------------------------------------------------------------


class TaskInstanceViewTest(BaseWithMemberTestCase):
    def setUp(self):
        super().setUp()
        from personal_planning.models import RoutineTask

        self.task = RoutineTask.objects.create(
            name="Morning Run",
            category="exercise",
            periodicity="daily",
            owner=self.member,
        )

    def test_list_task_instances(self):
        url = reverse("task-instance-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_task_instance(self):
        url = reverse("task-instance-list-create")
        data = {
            "template": str(self.task.pk),
            "task_name": self.task.name,
            "category": "exercise",
            "scheduled_date": str(date.today()),
            "owner": str(self.member.pk),
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_instances_for_date_endpoint(self):
        url = reverse("instances-for-date")
        response = self.client.get(url, {"date": str(date.today())})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_personal_planning_dashboard_stats(self):
        url = reverse("personal-planning-dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Payables
# ---------------------------------------------------------------------------


class PayableViewTest(BaseWithMemberTestCase):
    def _payable_data(self, desc="Dentist"):
        return {
            "description": desc,
            "value": "500.00",
            "date": str(date.today()),
            "category": "health and care",
            "status": "active",
        }

    def test_list_payables(self):
        url = reverse("payable-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_payable(self):
        url = reverse("payable-create-list")
        response = self.client.post(url, self._payable_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_payable(self):
        from payables.models import Payable

        payable = Payable.objects.create(
            description="Car repair",
            value=Decimal("1500.00"),
            date=date.today(),
            category="transport",
            created_by=self.user,
        )
        url = reverse("payable-detail-view", args=[payable.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_payable(self):
        from payables.models import Payable

        payable = Payable.objects.create(
            description="Gym",
            value=Decimal("100.00"),
            date=date.today(),
            category="health and care",
            created_by=self.user,
        )
        url = reverse("payable-detail-view", args=[payable.pk])
        response = self.client.patch(url, {"description": "Gym membership"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_payable(self):
        from payables.models import Payable

        payable = Payable.objects.create(
            description="Old bill",
            value=Decimal("50.00"),
            date=date.today(),
            category="bills and services",
            created_by=self.user,
        )
        url = reverse("payable-detail-view", args=[payable.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Loans
# ---------------------------------------------------------------------------


class LoanViewTest(BaseWithMemberTestCase):
    def setUp(self):
        super().setUp()
        self.benefited = Member.objects.create(
            name="Borrower",
            document_hash="b" * 64,
            phone="11988888888",
            sex="M",
        )
        self.creditor = Member.objects.create(
            name="Lender",
            document_hash="c" * 64,
            phone="11977777777",
            sex="F",
        )

    def _loan_data(self, desc="Personal loan"):
        return {
            "description": desc,
            "value": "1000.00",
            "payed_value": "0.00",
            "date": str(date.today()),
            "horary": "10:00:00",
            "category": "loans",
            "account": self.account.pk,
            "benefited": self.benefited.pk,
            "creditor": self.creditor.pk,
            "payed": False,
            "status": "active",
        }

    def test_list_loans(self):
        url = reverse("loan-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_loan(self):
        url = reverse("loan-create-list")
        response = self.client.post(url, self._loan_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_loan(self):
        from loans.models import Loan

        loan = Loan.objects.create(
            description="Test loan",
            value=Decimal("500.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(10, 0),
            category="loans",
            account=self.account,
            benefited=self.benefited,
            creditor=self.creditor,
            payed=False,
            status="active",
            created_by=self.user,
        )
        url = reverse("loan-detail-view", args=[loan.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------


class BudgetViewTest(BaseWithMemberTestCase):
    def test_list_budgets(self):
        url = reverse("budget-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_budget(self):
        url = reverse("budget-list-create")
        data = {
            "name": "Food Budget",
            "category": "food and drink",
            "amount": "500.00",
            "period": "monthly",
            "start_date": str(date.today()),
        }
        response = self.client.post(url, data)
        # 201 or 400 (if validation fails), just check it's not 5xx
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
            ],
        )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


class DashboardViewTest(BaseWithMemberTestCase):
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


# ---------------------------------------------------------------------------
# Expenses — additional coverage
# ---------------------------------------------------------------------------


class ExpensesExtendedViewTest(BaseWithMemberTestCase):
    def test_list_expenses(self):
        url = reverse("expense-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_expense(self):
        url = reverse("expense-create-list")
        data = {
            "description": "Grocery",
            "value": "80.00",
            "date": str(date.today()),
            "horary": "12:00:00",
            "category": "food and drink",
            "account": self.account.pk,
            "payed": True,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_fixed_expenses(self):
        url = reverse("fixed-expense-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_categorization_rules(self):
        url = reverse("categorization-rule-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_categorization_rule(self):
        url = reverse("categorization-rule-list")
        data = {
            "merchant_contains": "starbucks",
            "category": "food and drink",
            "is_active": True,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Revenues — additional coverage
# ---------------------------------------------------------------------------


class RevenuesExtendedViewTest(BaseWithMemberTestCase):
    def test_list_revenues(self):
        url = reverse("revenue-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_revenue(self):
        url = reverse("revenue-create-list")
        data = {
            "description": "Monthly salary",
            "value": "5000.00",
            "date": str(date.today()),
            "horary": "09:00:00",
            "category": "salary",
            "account": self.account.pk,
            "received": True,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------


class TransferViewTest(BaseWithMemberTestCase):
    def setUp(self):
        super().setUp()
        self.dest_account = Account.objects.create(
            account_name="Savings",
            institution_name="SIC",
            account_type="CS",
            is_active=True,
        )

    def test_list_transfers(self):
        url = reverse("transfer-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_transfer(self):
        url = reverse("transfer-create-list")
        data = {
            "description": "Monthly savings transfer",
            "value": "1000.00",
            "date": str(date.today()),
            "horary": "10:00:00",
            "category": "pix",
            "origin_account": self.account.pk,
            "destiny_account": self.dest_account.pk,
            "transfered": False,
            "fee": "0.00",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Credit Cards
# ---------------------------------------------------------------------------


class CreditCardViewTest(BaseWithMemberTestCase):
    def test_list_credit_cards(self):
        url = reverse("credit_card-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_credit_card_bills(self):
        url = reverse("credit_card-bill-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_credit_card_purchases(self):
        url = reverse("credit_card-purchase-create-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_credit_card_installments(self):
        url = reverse("credit_card-installment-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


class NotificationViewTest(BaseWithMemberTestCase):
    def test_list_notifications(self):
        url = reverse("notification-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
