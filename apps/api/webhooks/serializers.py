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
        extra_kwargs = {
            "secret": {
                "write_only": True,
                "required": False,
                "allow_blank": True,
            }
        }

    def validate_secret(self, value: str) -> str:
        if self.instance is None and not value:
            raise serializers.ValidationError("Este campo é obrigatório.")
        return value

    def validate(self, attrs: dict) -> dict:
        if self.instance is None and not attrs.get("secret"):
            raise serializers.ValidationError(
                {"secret": ["Este campo é obrigatório."]}
            )
        return attrs

    def update(self, instance: Webhook, validated_data: dict) -> Webhook:
        # O secret não volta da API: em branco na edição mantém o atual.
        if not validated_data.get("secret"):
            validated_data.pop("secret", None)
        updated: Webhook = super().update(instance, validated_data)
        return updated

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
