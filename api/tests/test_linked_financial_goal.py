"""
Tests for the linked_financial_goal FK on RoutineTask.
Covers: create/update with goal, clear link, serializer read fields.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member
from personal_planning.models import RoutineTask
from vaults.models import FinancialGoal, Vault


class BaseLinkedGoalTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="linkedgoaltest",
            email="linkedgoal@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Linked Goal User",
            document_hash="l" * 64,
            phone="11999999977",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Goal Account",
            institution_name="TestBank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("10000.00"),
        )
        self.vault = Vault.objects.create(
            description="Vacation Vault",
            account=self.account,
            yield_rate=Decimal("0.001"),
            annual_yield_rate=Decimal("0.10"),
            is_active=True,
        )
        self.financial_goal = FinancialGoal.objects.create(
            description="Viagem Europa",
            category="travel",
            target_value=Decimal("15000.00"),
            is_active=True,
        )
        self.financial_goal.vaults.add(self.vault)

        self.task = RoutineTask.objects.create(
            name="Depositar no cofre",
            category="finance",
            periodicity="monthly",
            day_of_month=5,
            owner=self.member,
        )

    def _task_data(self, **kwargs):
        base = {
            "name": "Depositar no cofre",
            "category": "finance",
            "periodicity": "monthly",
            "day_of_month": 5,
            "is_active": True,
            "priority": "medium",
            "allowed_skips_per_month": 0,
            "target_quantity": 1,
            "unit": "vez",
            "daily_occurrences": 1,
            "owner": self.member.pk,
        }
        base.update(kwargs)
        return base


class LinkedFinancialGoalModelTest(BaseLinkedGoalTestCase):
    def test_link_via_model(self):
        self.task.linked_financial_goal = self.financial_goal
        self.task.save()
        self.task.refresh_from_db()
        self.assertEqual(
            self.task.linked_financial_goal_id, self.financial_goal.pk
        )

    def test_reverse_relation(self):
        self.task.linked_financial_goal = self.financial_goal
        self.task.save()
        self.assertIn(
            self.task, self.financial_goal.linked_routine_tasks.all()
        )

    def test_set_null_on_goal_delete(self):
        self.task.linked_financial_goal = self.financial_goal
        self.task.save()
        self.financial_goal.delete()
        self.task.refresh_from_db()
        self.assertIsNone(self.task.linked_financial_goal)


class LinkedFinancialGoalAPITest(BaseLinkedGoalTestCase):
    def test_create_task_with_linked_goal(self):
        url = reverse("routine-task-list-create")
        data = self._task_data(
            name="Deposito mensal",
            linked_financial_goal=self.financial_goal.pk,
        )
        resp = self.client.post(url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            resp.data["linked_financial_goal"], self.financial_goal.pk
        )

    def test_create_task_without_linked_goal(self):
        url = reverse("routine-task-list-create")
        data = self._task_data(name="Tarefa sem meta")
        resp = self.client.post(url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(resp.data["linked_financial_goal"])

    def test_update_task_adds_linked_goal(self):
        url = reverse("routine-task-detail", args=[self.task.pk])
        data = self._task_data(linked_financial_goal=self.financial_goal.pk)
        resp = self.client.put(url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resp.data["linked_financial_goal"], self.financial_goal.pk
        )

    def test_update_task_clears_linked_goal(self):
        self.task.linked_financial_goal = self.financial_goal
        self.task.save()
        url = reverse("routine-task-detail", args=[self.task.pk])
        data = self._task_data(linked_financial_goal=None)
        resp = self.client.put(url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.data["linked_financial_goal"])

    def test_retrieve_task_includes_goal_description(self):
        self.task.linked_financial_goal = self.financial_goal
        self.task.save()
        url = reverse("routine-task-detail", args=[self.task.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resp.data["linked_financial_goal_description"],
            self.financial_goal.description,
        )

    def test_retrieve_task_no_goal_description_is_null(self):
        url = reverse("routine-task-detail", args=[self.task.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.data.get("linked_financial_goal_description"))

    def test_list_tasks_includes_linked_goal_fields(self):
        self.task.linked_financial_goal = self.financial_goal
        self.task.save()
        url = reverse("routine-task-list-create")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data["results"]
        task_data = next(t for t in results if t["id"] == self.task.pk)
        self.assertEqual(
            task_data["linked_financial_goal"], self.financial_goal.pk
        )
        self.assertEqual(
            task_data["linked_financial_goal_description"],
            self.financial_goal.description,
        )
