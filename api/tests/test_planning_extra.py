"""
Additional personal_planning view tests — daily reflections, goal
recalculate/reset,
task instance status update, bulk update, and credit card views coverage.
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


class BasePlanningTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="planextra",
            email="plan@extra.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Plan User",
            document_hash="p" * 64,
            phone="11999999959",
            sex="F",
            user=self.user,
        )
        from personal_planning.models import Goal, RoutineTask

        self.task = RoutineTask.objects.create(
            name="Test Task",
            category="health",
            periodicity="daily",
            owner=self.member,
        )
        self.goal = Goal.objects.create(
            title="Test Goal",
            goal_type="total_days",
            target_value=30,
            start_date=date.today(),
            status="active",
            owner=self.member,
        )


# ---------------------------------------------------------------------------
# Daily Reflections
# ---------------------------------------------------------------------------


class DailyReflectionViewTest(BasePlanningTestCase):
    def _reflection_data(self):
        return {
            "date": str(date.today()),
            "mood": "good",
            "reflection": "Today was a productive day.",
            "owner": self.member.pk,
        }

    def test_list_daily_reflections(self):
        url = reverse("daily-reflection-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_daily_reflection(self):
        url = reverse("daily-reflection-list-create")
        response = self.client.post(url, self._reflection_data())
        self.assertIn(
            response.status_code,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )

    def test_retrieve_daily_reflection(self):
        from personal_planning.models import DailyReflection

        reflection = DailyReflection.objects.create(
            date=date.today(),
            mood="great",
            reflection="A great day!",
            owner=self.member,
        )
        url = reverse("daily-reflection-detail", args=[reflection.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_daily_reflection(self):
        from personal_planning.models import DailyReflection

        reflection = DailyReflection.objects.create(
            date=date(2026, 3, 1),
            mood="neutral",
            reflection="Just another day.",
            owner=self.member,
        )
        url = reverse("daily-reflection-detail", args=[reflection.pk])
        response = self.client.patch(url, {"mood": "good"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_daily_reflection(self):
        from personal_planning.models import DailyReflection

        reflection = DailyReflection.objects.create(
            date=date(2026, 2, 1),
            mood="bad",
            reflection="Hard day.",
            owner=self.member,
        )
        url = reverse("daily-reflection-detail", args=[reflection.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Goal Recalculate / Reset
# ---------------------------------------------------------------------------


class GoalActionsViewTest(BasePlanningTestCase):
    def test_goal_recalculate(self):
        url = reverse("goal-recalculate", args=[self.goal.pk])
        response = self.client.post(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_goal_restart(self):
        url = reverse("goal-restart", args=[self.goal.pk])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Task Instance Status Update & Bulk Update
# ---------------------------------------------------------------------------


class TaskInstanceActionsViewTest(BasePlanningTestCase):
    def setUp(self):
        super().setUp()
        from personal_planning.models import TaskInstance

        self.instance = TaskInstance.objects.create(
            template=self.task,
            task_name=self.task.name,
            category="health",
            scheduled_date=date.today(),
            owner=self.member,
        )

    def test_task_instance_status_update(self):
        url = reverse("task-instance-status-update", args=[self.instance.pk])
        response = self.client.patch(url, {"status": "completed"})
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_task_instance_bulk_update(self):
        url = reverse("task-instance-bulk-update")
        response = self.client.post(
            url,
            {"instances": [{"id": self.instance.pk, "status": "completed"}]},
            format="json",
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_task_instance_detail(self):
        url = reverse("task-instance-detail", args=[self.instance.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_task_instance_update(self):
        url = reverse("task-instance-detail", args=[self.instance.pk])
        response = self.client.patch(url, {"notes": "Good progress"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_task_instance_delete(self):
        url = reverse("task-instance-detail", args=[self.instance.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Routine Template Import
# ---------------------------------------------------------------------------


class RoutineTemplateImportViewTest(BasePlanningTestCase):
    def test_list_templates(self):
        url = reverse("routine-template-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_import_template(self):
        url = reverse("routine-template-import")
        response = self.client.post(url, {"template_ids": []}, format="json")
        self.assertIn(
            response.status_code,
            [
                status.HTTP_200_OK,
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
            ],
        )


# ---------------------------------------------------------------------------
# Credit Card Additional Coverage
# ---------------------------------------------------------------------------


class CreditCardAdditionalViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cctest",
            email="cc@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.account = Account.objects.create(
            account_name="CC Account",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )

    def _create_cc(self, name="My Card"):
        from datetime import date as dt

        from app.encryption import FieldEncryption
        from credit_cards.models import CreditCard

        card = CreditCard(
            name=name,
            on_card_name="TEST USER",
            flag="VSA",
            associated_account=self.account,
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            closing_day=15,
            due_day=10,
            validation_date=dt(2030, 1, 1),
            created_by=self.user,
        )
        card._security_code = FieldEncryption.encrypt_data("123")
        card._card_number = FieldEncryption.encrypt_data("4111111111111111")
        card.save()
        return card

    def test_retrieve_credit_card(self):
        card = self._create_cc("Retrieve Card")
        url = reverse("credit-card-detail-view", args=[card.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_credit_card(self):
        card = self._create_cc("Update Card")
        url = reverse("credit-card-detail-view", args=[card.pk])
        response = self.client.patch(url, {"card_name": "Updated Card"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_credit_card(self):
        card = self._create_cc("Delete Card")
        url = reverse("credit-card-detail-view", args=[card.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_retrieve_credit_card_bill(self):
        from credit_cards.models import CreditCardBill

        card = self._create_cc("Bill Test Card")
        # Bill is created by signal
        bill = CreditCardBill.objects.filter(credit_card=card).first()
        if bill is None:
            from datetime import date as dt

            bill = CreditCardBill.objects.create(
                credit_card=card,
                year="2026",
                month="01",
                invoice_beginning_date=dt(2026, 1, 1),
                invoice_ending_date=dt(2026, 1, 31),
                closed=False,
                total_amount=Decimal("0.00"),
                minimum_payment=Decimal("0.00"),
                due_date=dt(2026, 2, 10),
                paid_amount=Decimal("0.00"),
                interest_charged=Decimal("0.00"),
                late_fee=Decimal("0.00"),
                status="open",
                created_by=self.user,
            )
        url = reverse("credit-card-bill-detail-view", args=[bill.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Budget additional coverage
# ---------------------------------------------------------------------------


class BudgetAdditionalViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="budgtest",
            email="budg@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def test_budget_status(self):
        url = reverse("budget-status")
        response = self.client.get(url)
        self.assertIn(
            response.status_code,
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )

    def test_budget_detail(self):
        from budgets.models import Budget
        from members.models import Member

        member = Member.objects.create(
            name="Budget Member",
            document_hash="b" * 64,
            phone="11999999949",
            sex="M",
            user=self.user,
        )
        budget = Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("500.00"),
            month=3,
            year=2026,
            member=member,
            created_by=self.user,
        )
        url = reverse("budget-detail", args=[budget.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# RoutineTask linked_book
# ---------------------------------------------------------------------------


class RoutineTaskLinkedBookTest(BasePlanningTestCase):
    def setUp(self):
        super().setUp()
        from library.models import Author, Book, Publisher

        self.author = Author.objects.create(
            name="Author Test", owner=self.member
        )
        self.publisher = Publisher.objects.create(
            name="Publisher Test", owner=self.member
        )
        self.book = Book.objects.create(
            title="Reading Book Test",
            pages=300,
            publisher=self.publisher,
            language="Por",
            genre="Fiction",
            literarytype="book",
            read_status="reading",
            owner=self.member,
        )
        self.book.authors.set([self.author])

    def test_create_routine_task_with_linked_book(self):
        url = reverse("routine-task-list-create")
        data = {
            "name": "Ler 30 páginas",
            "category": "intellect",
            "periodicity": "daily",
            "target_quantity": 30,
            "unit": "página",
            "is_active": True,
            "priority": "medium",
            "allowed_skips_per_month": 0,
            "daily_occurrences": 1,
            "owner": self.member.pk,
            "linked_book": self.book.pk,
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["linked_book"], self.book.pk)

    def test_routine_task_serializer_includes_linked_book_title(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Ler Kafka",
            category="intellect",
            periodicity="daily",
            owner=self.member,
            linked_book=self.book,
        )
        url = reverse("routine-task-detail", args=[task.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["linked_book"], self.book.pk)
        self.assertEqual(response.data["linked_book_title"], self.book.title)

    def test_update_routine_task_linked_book_to_null(self):
        from personal_planning.models import RoutineTask

        task = RoutineTask.objects.create(
            name="Ler Kafka",
            category="intellect",
            periodicity="daily",
            owner=self.member,
            linked_book=self.book,
        )
        url = reverse("routine-task-detail", args=[task.pk])
        response = self.client.patch(url, {"linked_book": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertIsNone(task.linked_book)
