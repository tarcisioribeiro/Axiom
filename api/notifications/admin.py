from django.contrib import admin

from notifications.models import Notification


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
