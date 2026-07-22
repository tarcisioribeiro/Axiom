"""
Tests for NotificationPreference CRUD API and dispatch_notification service.
"""

import uuid

from django.contrib.auth.models import User
from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from notifications.models import Notification, NotificationPreference
from notifications.services import dispatch_notification


def _make_member(user, name="Pref Test Member"):
    m = Member(
        name=name,
        user=user,
        phone="11999999999",
        sex="M",
        created_by=user,
    )
    m.document_hash = uuid.uuid4().hex
    m.save()
    return m


class BasePreferenceTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="pref_testuser",
            email="pref@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = _make_member(self.user)

    def _create_preference(
        self, notification_type="loan_overdue", channel="email"
    ):
        return NotificationPreference.objects.create(
            owner=self.member,
            notification_type=notification_type,
            channel=channel,
            created_by=self.user,
        )

    def _create_notification(self, notification_type="loan_overdue"):
        return Notification.objects.create(
            owner=self.member,
            notification_type=notification_type,
            title="Test Notification",
            message="Test message",
            content_type="loan",
            object_id=1,
            created_by=self.user,
        )


# ─── List / Create ───────────────────────────────────────────────────────────


class NotificationPreferenceListCreateTest(BasePreferenceTestCase):
    def test_list_empty(self):
        url = reverse("notification-preference-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)  # type: ignore

    def test_create_preference(self):
        url = reverse("notification-preference-list")
        payload = {"notification_type": "bill_overdue", "channel": "both"}
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(  # type: ignore
            response.data["notification_type"], "bill_overdue"
        )
        self.assertEqual(response.data["channel"], "both")  # type: ignore

    def test_create_preference_requires_auth(self):
        self.client.credentials()
        url = reverse("notification-preference-list")
        response = self.client.post(
            url, {"notification_type": "bill_overdue", "channel": "email"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_only_own_preferences(self):
        self._create_preference()
        other_user = User.objects.create_user(
            username="other_pref_user", password="pass", is_superuser=True
        )
        other_member = _make_member(other_user, name="Other Pref Member")
        NotificationPreference.objects.create(
            owner=other_member,
            notification_type="bill_overdue",
            channel="email",
            created_by=other_user,
        )
        url = reverse("notification-preference-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)  # type: ignore

    def test_create_duplicate_raises_400(self):
        self._create_preference(notification_type="loan_overdue")
        url = reverse("notification-preference-list")
        response = self.client.post(
            url, {"notification_type": "loan_overdue", "channel": "both"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_channel_raises_400(self):
        url = reverse("notification-preference-list")
        response = self.client.post(
            url, {"notification_type": "bill_due_soon", "channel": "sms"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ─── Retrieve / Update / Delete ──────────────────────────────────────────────


class NotificationPreferenceDetailTest(BasePreferenceTestCase):
    def test_retrieve_preference(self):
        pref = self._create_preference(channel="both")
        url = reverse("notification-preference-detail", kwargs={"pk": pref.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["channel"], "both")  # type: ignore

    def test_patch_channel(self):
        pref = self._create_preference(channel="in_app")
        url = reverse("notification-preference-detail", kwargs={"pk": pref.pk})
        response = self.client.patch(url, {"channel": "email"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pref.refresh_from_db()
        self.assertEqual(pref.channel, "email")

    def test_delete_soft_deletes(self):
        pref = self._create_preference()
        url = reverse("notification-preference-detail", kwargs={"pk": pref.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        pref.refresh_from_db()
        self.assertTrue(pref.is_deleted)

    def test_cannot_access_other_users_preference(self):
        other_user = User.objects.create_user(
            username="other_pref_user2", password="pass", is_superuser=True
        )
        other_member = _make_member(other_user, name="Other Pref Member 2")
        other_pref = NotificationPreference.objects.create(
            owner=other_member,
            notification_type="task_overdue",
            channel="email",
            created_by=other_user,
        )
        url = reverse(
            "notification-preference-detail", kwargs={"pk": other_pref.pk}
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ─── dispatch_notification service ───────────────────────────────────────────


class DispatchNotificationServiceTest(BasePreferenceTestCase):
    def test_in_app_does_not_send_email(self):
        self._create_preference(channel="in_app")
        notification = self._create_notification()
        dispatch_notification(notification)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_channel_sends_email(self):
        self._create_preference(channel="email")
        notification = self._create_notification()
        dispatch_notification(notification)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(notification.title, mail.outbox[0].subject)

    def test_both_channel_sends_email(self):
        self._create_preference(channel="both")
        notification = self._create_notification()
        dispatch_notification(notification)
        self.assertEqual(len(mail.outbox), 1)

    def test_no_preference_defaults_to_in_app(self):
        """No preference record → falls back to in_app → no email sent."""
        notification = self._create_notification()
        dispatch_notification(notification)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_not_sent_when_owner_has_no_email(self):
        self.user.email = ""
        self.user.save()
        self._create_preference(channel="email")
        notification = self._create_notification()
        dispatch_notification(notification)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_contains_html_alternative(self):
        self._create_preference(channel="email")
        notification = self._create_notification()
        dispatch_notification(notification)
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        content_types = [alt[1] for alt in msg.alternatives]
        self.assertIn("text/html", content_types)
