import uuid
from datetime import date
from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from notifications.models import Notification

# Content type not cleaned up by _generate_notifications; keeps test
# notifications visible (ActiveManager filters is_deleted=False).
TEST_CONTENT_TYPE = "other"


def _make_member(user, name="Test Member"):
    """Creates a Member with a unique document_hash (required unique CharField)."""
    m = Member(
        name=name,
        user=user,
        phone="11999999999",
        sex="M",
        created_by=user,
    )
    m.document_hash = uuid.uuid4().hex  # bypass unique constraint in tests
    m.save()
    return m


class BaseNotificationTestCase(APITestCase):
    """Base class for notification tests — requires a Member linked to the user."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="notif_testuser",
            email="notif@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        self.member = _make_member(self.user)

    def _create_notification(self, **kwargs):
        defaults = {
            "owner": self.member,
            "notification_type": "task_today",
            "title": "Test Notification",
            "message": "Test message",
            "content_type": TEST_CONTENT_TYPE,
            "object_id": 1,
            "is_read": False,
            "created_by": self.user,
        }
        defaults.update(kwargs)
        return Notification.objects.create(**defaults)


class NotificationListViewTest(BaseNotificationTestCase):
    """Tests for GET /api/v1/notifications/"""

    def test_list_notifications_empty(self):
        """Returns 200 with empty results when no notifications exist."""
        url = reverse("notification-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The view auto-generates notifications; without related objects there are none
        self.assertIn("count", response.data)  # type: ignore

    def test_list_notifications_returns_own_notifications(self):
        """Returns only notifications belonging to the requesting user's member."""
        self._create_notification(title="My Notification")
        url = reverse("notification-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [n["title"] for n in response.data["results"]]  # type: ignore
        self.assertIn("My Notification", titles)

    def test_list_notifications_excludes_other_users(self):
        """Does not return notifications belonging to another user's member."""
        other_user = User.objects.create_user(
            username="other_notif_user", password="pass", is_superuser=True
        )
        other_member = _make_member(other_user, name="Other Member")
        Notification.objects.create(
            owner=other_member,
            notification_type="task_today",
            title="Other User Notification",
            content_type=TEST_CONTENT_TYPE,
            object_id=99,
            created_by=other_user,
        )
        url = reverse("notification-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [n["title"] for n in response.data["results"]]  # type: ignore
        self.assertNotIn("Other User Notification", titles)

    def test_list_notifications_requires_authentication(self):
        """Returns 401 when not authenticated."""
        self.client.credentials()
        url = reverse("notification-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class NotificationUpdateViewTest(BaseNotificationTestCase):
    """Tests for PATCH /api/v1/notifications/<pk>/"""

    def test_mark_notification_as_read(self):
        """PATCH with is_read=true marks the notification as read."""
        notif = self._create_notification(is_read=False)
        url = reverse("notification-update", kwargs={"pk": notif.pk})
        response = self.client.patch(url, {"is_read": True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_cannot_update_other_users_notification(self):
        """Returns 404 when trying to update another user's notification."""
        other_user = User.objects.create_user(
            username="other_notif_user2", password="pass", is_superuser=True
        )
        other_member = _make_member(other_user, name="Other Member 2")
        other_notif = Notification.objects.create(
            owner=other_member,
            notification_type="task_today",
            title="Other Notif",
            content_type=TEST_CONTENT_TYPE,
            object_id=42,
            created_by=other_user,
        )
        url = reverse("notification-update", kwargs={"pk": other_notif.pk})
        response = self.client.patch(url, {"is_read": True})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class MarkAllReadViewTest(BaseNotificationTestCase):
    """Tests for POST /api/v1/notifications/mark-all-read/"""

    def test_mark_all_read(self):
        """Marks all unread notifications as read and returns count."""
        self._create_notification(title="Notif 1", object_id=1, is_read=False)
        self._create_notification(
            title="Notif 2",
            object_id=2,
            notification_type="task_overdue",
            is_read=False,
        )
        url = reverse("notification-mark-all-read")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_read"], 2)  # type: ignore
        unread_count = Notification.objects.filter(
            owner=self.member, is_read=False
        ).count()
        self.assertEqual(unread_count, 0)

    def test_mark_all_read_when_all_already_read(self):
        """Returns 0 when all notifications are already read."""
        self._create_notification(is_read=True)
        url = reverse("notification-mark-all-read")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_read"], 0)  # type: ignore


class NotificationSummaryViewTest(BaseNotificationTestCase):
    """Tests for GET /api/v1/notifications/summary/"""

    def test_summary_returns_unread_count(self):
        """Returns the correct unread_count for the authenticated user."""
        self._create_notification(title="Unread 1", object_id=1, is_read=False)
        self._create_notification(title="Unread 2", object_id=2, is_read=False)
        self._create_notification(title="Read 1", object_id=3, is_read=True)
        url = reverse("notification-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 2)  # type: ignore

    def test_summary_returns_zero_when_no_unread(self):
        """Returns 0 when there are no unread notifications."""
        self._create_notification(is_read=True)
        url = reverse("notification-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 0)  # type: ignore

    def test_summary_requires_authentication(self):
        """Returns 401 when not authenticated."""
        self.client.credentials()
        url = reverse("notification-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class BudgetNotificationCommandTest(BaseNotificationTestCase):
    """Tests for budget_warning / budget_exceeded in send_due_notifications."""

    def setUp(self):
        super().setUp()
        from accounts.models import Account
        from budgets.models import Budget
        from expenses.models import Expense

        self.today = date.today()
        self.account = Account.objects.create(
            account_name="Test Account",
            institution_name="Bank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("50000.00"),
        )
        self.budget = Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("200.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )
        # Create a prior expense at 85% of limit (R$170)
        Expense.objects.create(
            description="Prior expense",
            value=Decimal("170.00"),
            date=self.today,
            horary="08:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def _run_command(self, dry_run=False):
        from django.core.management import call_command

        out = StringIO()
        args = ["send_due_notifications", f"--member-id={self.member.pk}"]
        if dry_run:
            args.append("--dry-run")
        call_command(*args, stdout=out)
        return out.getvalue()

    def test_budget_warning_created_at_80_percent(self):
        """Creates budget_warning notification when spending >= 80% of limit."""
        self._run_command()
        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="budget_warning",
                content_type="budget",
                object_id=self.budget.id,
            ).exists()
        )

    def test_budget_exceeded_created_when_over_limit(self):
        """Creates budget_exceeded notification when spending exceeds the limit."""
        from expenses.models import Expense

        Expense.objects.create(
            description="Over limit",
            value=Decimal("50.00"),
            date=self.today,
            horary="09:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        self._run_command()
        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="budget_exceeded",
                content_type="budget",
                object_id=self.budget.id,
            ).exists()
        )
        # Warning should not be created alongside exceeded
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                notification_type="budget_warning",
                content_type="budget",
                object_id=self.budget.id,
            ).exists()
        )

    def test_no_notification_below_80_percent(self):
        """No notification when spending is below 80% of limit."""
        from budgets.models import Budget
        from expenses.models import Expense

        low_budget = Budget.objects.create(
            category="health",
            limit_amount=Decimal("500.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Small health expense",
            value=Decimal("50.00"),
            date=self.today,
            horary="10:00:00",
            category="health",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        self._run_command()
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                content_type="budget",
                object_id=low_budget.id,
            ).exists()
        )

    def test_idempotent_does_not_duplicate(self):
        """Running the command twice does not create duplicate notifications."""
        self._run_command()
        self._run_command()
        self.assertEqual(
            Notification.objects.filter(
                owner=self.member,
                notification_type="budget_warning",
                content_type="budget",
                object_id=self.budget.id,
            ).count(),
            1,
        )

    def test_dry_run_does_not_persist(self):
        """--dry-run prints what would be dispatched without saving."""
        output = self._run_command(dry_run=True)
        self.assertIn("dry-run", output)
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                content_type="budget",
            ).exists()
        )


class FinancialGoalNotificationCommandTest(BaseNotificationTestCase):
    """Tests for financial_goal_reached / financial_goal_approaching."""

    def setUp(self):
        super().setUp()
        from decimal import Decimal

        from accounts.models import Account
        from vaults.models import FinancialGoal, Vault

        self.today = date.today()

        self.account = Account.objects.create(
            account_name="Goal Test Account",
            institution_name="Bank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("200000.00"),
        )
        self.vault = Vault.objects.create(
            description="Test Vault",
            account=self.account,
            current_balance=Decimal("0.00"),
            created_by=self.user,
        )
        self.goal = FinancialGoal.objects.create(
            description="Casa própria",
            target_value=Decimal("100000.00"),
            created_by=self.user,
        )
        self.goal.vaults.add(self.vault)

    def _run_command(self, dry_run=False):
        from django.core.management import call_command

        out = StringIO()
        args = ["send_due_notifications", f"--member-id={self.member.pk}"]
        if dry_run:
            args.append("--dry-run")
        call_command(*args, stdout=out)
        return out.getvalue()

    def test_financial_goal_reached_notification_created(self):
        """Creates financial_goal_reached when current_value >= target_value."""
        from decimal import Decimal

        self.vault.current_balance = Decimal("100000.00")
        self.vault.save()

        self._run_command()

        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_reached",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).exists()
        )

    def test_financial_goal_approaching_created_within_30_days(self):
        """Creates financial_goal_approaching when target_date <= 30 days away."""
        from datetime import timedelta

        self.goal.target_date = self.today + timedelta(days=15)
        self.goal.save()

        self._run_command()

        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_approaching",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).exists()
        )

    def test_no_approaching_notification_when_far_away(self):
        """No approaching notification when target_date is more than 30 days away."""
        from datetime import timedelta

        self.goal.target_date = self.today + timedelta(days=60)
        self.goal.save()

        self._run_command()

        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_approaching",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).exists()
        )

    def test_reached_takes_priority_over_approaching(self):
        """When goal is reached and target_date is close, only reached is created."""
        from datetime import timedelta
        from decimal import Decimal

        self.vault.current_balance = Decimal("100000.00")
        self.vault.save()
        self.goal.target_date = self.today + timedelta(days=10)
        self.goal.save()

        self._run_command()

        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_reached",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_approaching",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).exists()
        )

    def test_completed_goals_are_skipped(self):
        """Goals marked is_completed=True are not processed."""
        from decimal import Decimal

        self.vault.current_balance = Decimal("100000.00")
        self.vault.save()
        self.goal.is_completed = True
        self.goal.save()

        self._run_command()

        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_reached",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).exists()
        )

    def test_idempotent_does_not_duplicate(self):
        """Running the command twice does not create duplicate notifications."""
        from decimal import Decimal

        self.vault.current_balance = Decimal("100000.00")
        self.vault.save()

        self._run_command()
        self._run_command()

        self.assertEqual(
            Notification.objects.filter(
                owner=self.member,
                notification_type="financial_goal_reached",
                content_type="financial_goal",
                object_id=self.goal.id,
            ).count(),
            1,
        )

    def test_dry_run_does_not_persist(self):
        """--dry-run does not save notifications."""
        from decimal import Decimal

        self.vault.current_balance = Decimal("100000.00")
        self.vault.save()

        output = self._run_command(dry_run=True)

        self.assertIn("dry-run", output)
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                content_type="financial_goal",
            ).exists()
        )


class AgentInsightNotificationCommandTest(BaseNotificationTestCase):
    """Tests for agent_insight notifications in send_due_notifications."""

    def setUp(self):
        super().setUp()
        from accounts.models import Account
        from budgets.models import Budget
        from expenses.models import Expense

        self.today = date.today()
        self.account = Account.objects.create(
            account_name="Agent Insight Account",
            institution_name="Bank",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("50000.00"),
        )
        self.budget = Budget.objects.create(
            category="food and drink",
            limit_amount=Decimal("200.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )
        # Spend 85% of limit to trigger critical insight
        Expense.objects.create(
            description="Food expense",
            value=Decimal("170.00"),
            date=self.today,
            horary="08:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )

    def _run_command(self, dry_run=False):
        from django.core.management import call_command

        out = StringIO()
        args = ["send_due_notifications", f"--member-id={self.member.pk}"]
        if dry_run:
            args.append("--dry-run")
        call_command(*args, stdout=out)
        return out.getvalue()

    def test_agent_insight_created_for_critical_budget(self):
        """Creates agent_insight when spending is >= 80% of budget limit."""
        self._run_command()
        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="agent_insight",
                content_type="budget",
                object_id=self.budget.id,
            ).exists()
        )

    def test_agent_insight_created_for_overbudget(self):
        """Creates agent_insight when spending exceeds the budget limit."""
        from expenses.models import Expense

        Expense.objects.create(
            description="Over limit",
            value=Decimal("50.00"),
            date=self.today,
            horary="09:00:00",
            category="food and drink",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        self._run_command()
        self.assertTrue(
            Notification.objects.filter(
                owner=self.member,
                notification_type="agent_insight",
                content_type="budget",
                object_id=self.budget.id,
            ).exists()
        )

    def test_no_agent_insight_below_80_percent(self):
        """No agent_insight created when spending is below 80% of budget limit."""
        from budgets.models import Budget
        from expenses.models import Expense

        low_budget = Budget.objects.create(
            category="health",
            limit_amount=Decimal("500.00"),
            month=self.today.month,
            year=self.today.year,
            created_by=self.user,
        )
        Expense.objects.create(
            description="Small health expense",
            value=Decimal("50.00"),
            date=self.today,
            horary="10:00:00",
            category="health",
            account=self.account,
            payed=True,
            created_by=self.user,
        )
        self._run_command()
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                notification_type="agent_insight",
                content_type="budget",
                object_id=low_budget.id,
            ).exists()
        )

    def test_idempotent_does_not_duplicate(self):
        """Running the command twice does not create duplicate agent_insight entries."""
        self._run_command()
        self._run_command()
        self.assertEqual(
            Notification.objects.filter(
                owner=self.member,
                notification_type="agent_insight",
                content_type="budget",
                object_id=self.budget.id,
            ).count(),
            1,
        )

    def test_dry_run_does_not_persist(self):
        """--dry-run prints what would be dispatched without saving."""
        output = self._run_command(dry_run=True)
        self.assertIn("dry-run", output)
        self.assertFalse(
            Notification.objects.filter(
                owner=self.member,
                notification_type="agent_insight",
            ).exists()
        )
