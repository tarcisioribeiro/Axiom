from rest_framework import serializers

from receivables.models import Receivable, ReceivableInstallment


class ReceivableInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReceivableInstallment
        fields = [
            "id",
            "uuid",
            "receivable",
            "installment_number",
            "value",
            "due_date",
            "received",
            "receipt_revenue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "receivable",
            "installment_number",
            "value",
            "due_date",
            "created_at",
            "updated_at",
        ]


class ReceivableSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(
        source="member.name", read_only=True, allow_null=True
    )
    remaining_value = serializers.SerializerMethodField()
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Receivable
        fields = [
            "id",
            "uuid",
            "description",
            "value",
            "received_value",
            "date",
            "due_date",
            "category",
            "category_display",
            "member",
            "member_name",
            "notes",
            "status",
            "status_display",
            "remaining_value",
            "created_at",
            "updated_at",
        ]

    def get_remaining_value(self, obj):
        remaining = float(obj.value) - float(obj.received_value)
        return f"{remaining:.2f}"
