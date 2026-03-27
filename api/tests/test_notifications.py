import uuid

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
