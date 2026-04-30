from rest_framework import serializers

from agents.models import AgentConversation, EmbeddingDocument


class AgentAskSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=2000)
    session_id = serializers.CharField(max_length=64, default="default")
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    forecast_days = serializers.IntegerField(
        required=False, min_value=7, max_value=90, default=30
    )


class AgentResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    agent = serializers.CharField()
    sources = serializers.ListField(child=serializers.CharField())
    session_id = serializers.CharField()


class AgentConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConversation
        fields = ["id", "session_id", "role", "content", "agent_name", "created_at"]
        read_only_fields = fields


class EmbeddingDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmbeddingDocument
        fields = [
            "id",
            "source_type",
            "source_title",
            "content",
            "created_at",
            "updated_at",
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
