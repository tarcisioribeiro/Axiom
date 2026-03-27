from rest_framework import serializers

from notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display", read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "uuid",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "is_read",
            "due_date",
            "content_type",
            "object_id",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "notification_type",
            "title",
            "message",
            "due_date",
            "content_type",
            "object_id",
            "created_at",
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display", read_only=True
    )
    channel_display = serializers.CharField(
        source="get_channel_display", read_only=True
    )

    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "uuid",
            "notification_type",
            "notification_type_display",
            "channel",
            "channel_display",
        ]
        read_only_fields = ["id", "uuid"]
