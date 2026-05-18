from django.contrib import admin

from webhooks.models import Webhook, WebhookDelivery


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ["name", "url", "is_active", "created_by", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "url"]


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = [
        "webhook",
        "event",
        "status",
        "response_status_code",
        "attempt_number",
        "created_at",
    ]
    list_filter = ["status", "event"]
    search_fields = ["webhook__name", "event"]
