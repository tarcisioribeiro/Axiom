from django.urls import path

from notifications.views import (
    NotificationListView,
    NotificationPreferenceListCreateView,
    NotificationPreferenceRetrieveUpdateDestroyView,
    NotificationUpdateView,
    mark_all_read,
    notification_summary,
)

urlpatterns = [
    path(
        "notifications/",
        NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/<int:pk>/",
        NotificationUpdateView.as_view(),
        name="notification-update",
    ),
    path(
        "notifications/mark-all-read/",
        mark_all_read,
        name="notification-mark-all-read",
    ),
    path(
        "notifications/summary/",
        notification_summary,
        name="notification-summary",
    ),
    path(
        "notification-preferences/",
        NotificationPreferenceListCreateView.as_view(),
        name="notification-preference-list",
    ),
    path(
        "notification-preferences/<int:pk>/",
        NotificationPreferenceRetrieveUpdateDestroyView.as_view(),
        name="notification-preference-detail",
    ),
]
