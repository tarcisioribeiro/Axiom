from django.contrib import admin

from notifications.models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "notification_type",
        "owner",
        "is_read",
        "due_date",
        "created_at",
    )
    list_filter = ("notification_type", "is_read")
    search_fields = ("title", "message")
    ordering = ("-created_at",)


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "notification_type",
        "channel",
        "created_at",
    )
    list_filter = ("notification_type", "channel")
    search_fields = ("owner__name",)
    ordering = ("owner", "notification_type")
