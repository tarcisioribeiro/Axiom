from django.urls import path

from notifications.views import (
    NotificationListView,
    NotificationUpdateView,
    mark_all_read,
    notification_summary,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path(
        "notifications/<int:pk>/",
        NotificationUpdateView.as_view(),
        name="notification-update",
    ),
    path(
        "notifications/mark-all-read/", mark_all_read, name="notification-mark-all-read"
    ),
    path("notifications/summary/", notification_summary, name="notification-summary"),
]
