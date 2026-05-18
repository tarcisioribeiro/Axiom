from rest_framework import serializers

from webhooks.models import WEBHOOK_EVENT_CHOICES, Webhook, WebhookDelivery


class WebhookSerializer(serializers.ModelSerializer):
    delivery_count = serializers.SerializerMethodField()
    last_delivery_status = serializers.SerializerMethodField()

    class Meta:
        model = Webhook
        fields = [
            "id",
            "uuid",
            "name",
            "url",
            "secret",
            "events",
            "is_active",
            "timeout_seconds",
            "max_retries",
            "delivery_count",
            "last_delivery_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "delivery_count",
            "last_delivery_status",
        ]
        extra_kwargs = {"secret": {"write_only": True}}

    def validate_events(self, value: list[str]) -> list[str]:
        valid = {choice[0] for choice in WEBHOOK_EVENT_CHOICES}
        invalid = set(value) - valid
        if invalid:
            raise serializers.ValidationError(
                f"Eventos inválidos: {', '.join(invalid)}"
            )
        return value

    def get_delivery_count(self, obj: Webhook) -> int:
        qs = obj.deliveries  # type: ignore[attr-defined]
        return int(qs.filter(is_deleted=False).count())

    def get_last_delivery_status(self, obj: Webhook) -> str | None:
        qs = obj.deliveries  # type: ignore[attr-defined]
        last = qs.filter(is_deleted=False).order_by("-created_at").first()
        return last.status if last else None


class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = [
            "id",
            "uuid",
            "event",
            "status",
            "response_status_code",
            "attempt_number",
            "duration_ms",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields
