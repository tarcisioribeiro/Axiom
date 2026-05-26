from rest_framework import serializers

from expenses.serializers import TagSerializer
from revenues.models import FixedRevenue, Revenue


class RevenueSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(
        source="account.account_name", read_only=True
    )
    current_balance = serializers.DecimalField(
        source="account.current_balance",
        max_digits=15,
        decimal_places=2,
        read_only=True,
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        required=False,
        source="tags",
        queryset=__import__(
            "expenses.models", fromlist=["Tag"]
        ).Tag.objects.all(),
    )

    class Meta:
        model = Revenue
        fields = [
            "id",
            "uuid",
            "description",
            "value",
            "date",
            "horary",
            "category",
            "account",
            "account_name",
            "current_balance",
            "received",
            "source",
            "tax_amount",
            "net_amount",
            "member",
            "receipt",
            "recurring",
            "frequency",
            "notes",
            "currency_code",
            "is_initial_balance",
            "tags",
            "tag_ids",
            "related_transfer",
            "related_loan",
        ]
        read_only_fields = ["id", "uuid", "net_amount"]


class FixedRevenueSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(
        source="account.account_name", read_only=True
    )
    member_name = serializers.CharField(
        source="member.name", read_only=True, allow_null=True
    )
    total_generated = serializers.IntegerField(
        read_only=True, required=False, default=0
    )

    class Meta:
        model = FixedRevenue
        fields = [
            "id",
            "uuid",
            "description",
            "default_value",
            "category",
            "account",
            "account_name",
            "due_day",
            "is_active",
            "allow_value_edit",
            "member",
            "member_name",
            "last_generated_month",
            "notes",
            "total_generated",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "last_generated_month",
            "created_at",
            "updated_at",
        ]


class FixedRevenueCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedRevenue
        exclude = [
            "last_generated_month",
            "uuid",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
            "deleted_by",
        ]

    def validate_due_day(self, value):
        if not 1 <= value <= 31:
            raise serializers.ValidationError("O dia deve estar entre 1 e 31")
        return value


class FixedRevenueValueSerializer(serializers.Serializer):
    fixed_revenue_id = serializers.IntegerField()
    value = serializers.DecimalField(max_digits=10, decimal_places=2)


class BulkGenerateRevenuesRequestSerializer(serializers.Serializer):
    month = serializers.CharField(max_length=7, help_text="Formato: YYYY-MM")
    revenue_values = serializers.ListField(
        child=FixedRevenueValueSerializer(), allow_empty=False
    )

    def validate_month(self, value):
        import re

        if not re.match(r"^\d{4}-\d{2}$", value):
            raise serializers.ValidationError("Formato inválido. Use YYYY-MM")
        year, month = value.split("-")
        if not 1 <= int(month) <= 12:
            raise serializers.ValidationError("Mês deve estar entre 01 e 12")
        return value


class BulkGenerateRevenuesResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    created_count = serializers.IntegerField()
    month = serializers.CharField()
    revenues = RevenueSerializer(many=True)
