from rest_framework import serializers

from admin_panel.models import SystemConfig


class SystemConfigSerializer(serializers.ModelSerializer):
    masked_value = serializers.SerializerMethodField()
    is_configured = serializers.SerializerMethodField()
    updated_by_username = serializers.SerializerMethodField()

    class Meta:
        model = SystemConfig
        fields = [
            "key",
            "label",
            "description",
            "category",
            "is_secret",
            "is_editable",
            "requires_restart",
            "masked_value",
            "is_configured",
            "updated_at",
            "updated_by_username",
        ]
        read_only_fields = fields

    def get_masked_value(self, obj: SystemConfig) -> str | None:
        return obj.masked_value

    def get_is_configured(self, obj: SystemConfig) -> bool:
        return obj.is_configured

    def get_updated_by_username(self, obj: SystemConfig) -> str | None:
        return obj.updated_by.username if obj.updated_by else None
