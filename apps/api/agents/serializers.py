from rest_framework import serializers

from agents.models import AgentConversation

_VALID_AGENT_NAMES = {
    "personal",
    "financial",
    "security",
    "intellect",
    "finance",
    "budget",
    "forecast",
    "planning",
    "library",
    "insight",
}


class AgentAskSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=2000)
    session_id = serializers.CharField(max_length=64, default="default")
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    forecast_days = serializers.IntegerField(
        required=False, min_value=7, max_value=90, default=30
    )
    language = serializers.CharField(
        max_length=10, required=False, default="pt-BR"
    )
    agent_name = serializers.CharField(
        max_length=32,
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
    )
    book_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
    )

    def validate_agent_name(self, value: str | None) -> str | None:
        if not value:
            return None
        if value not in _VALID_AGENT_NAMES:
            raise serializers.ValidationError(
                f"Agente '{value}' inválido."
                f" Opções: {sorted(_VALID_AGENT_NAMES)}"
            )
        return value


class AgentResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    agent = serializers.CharField()
    sources = serializers.ListField(child=serializers.CharField())
    session_id = serializers.CharField()


class AgentConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "session_id",
            "role",
            "content",
            "agent_name",
            "created_at",
        ]
        read_only_fields = fields


class AgentStatusSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    provider = serializers.CharField()
    models = serializers.ListField(child=serializers.CharField())
    agents = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        default=list,
    )


class CategoryClassifySerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    site = serializers.CharField(
        max_length=500, required=False, allow_blank=True
    )
    username = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    notes = serializers.CharField(required=False, allow_blank=True)
