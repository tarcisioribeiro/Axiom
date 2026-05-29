from rest_framework import serializers

from transfers.models import FixedTransfer, Transfer


class TransferSerializer(serializers.ModelSerializer):
    origin_account_name = serializers.CharField(
        source="origin_account.account_name", read_only=True
    )
    destiny_account_name = serializers.CharField(
        source="destiny_account.account_name", read_only=True
    )

    class Meta:
        model = Transfer
        fields = [
            "id",
            "uuid",
            "description",
            "value",
            "date",
            "horary",
            "category",
            "origin_account",
            "origin_account_name",
            "destiny_account",
            "destiny_account_name",
            "transfered",
            "status",
            "currency_code",
            "transaction_id",
            "fee",
            "exchange_rate",
            "processed_at",
            "confirmation_code",
            "notes",
            "receipt",
            "member",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "uuid", "created_at", "updated_at"]


class FixedTransferSerializer(serializers.ModelSerializer):
    origin_account_name = serializers.CharField(
        source="origin_account.account_name", read_only=True
    )
    destiny_account_name = serializers.CharField(
        source="destiny_account.account_name", read_only=True
    )
    total_generated = serializers.IntegerField(
        read_only=True, required=False, default=0
    )

    class Meta:
        model = FixedTransfer
        fields = [
            "id",
            "uuid",
            "description",
            "value",
            "category",
            "origin_account",
            "origin_account_name",
            "destiny_account",
            "destiny_account_name",
            "due_day",
            "is_active",
            "fee",
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


class FixedTransferCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedTransfer
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

    def validate(self, attrs):
        origin = attrs.get("origin_account")
        destiny = attrs.get("destiny_account")
        if origin and destiny and origin == destiny:
            raise serializers.ValidationError(
                {
                    "destiny_account": (
                        "A conta de destino deve ser diferente da de origem."
                    )
                }
            )
        return attrs


class BulkGenerateTransfersRequestSerializer(serializers.Serializer):
    month = serializers.CharField(max_length=7, help_text="Formato: YYYY-MM")

    def validate_month(self, value):
        import re

        if not re.match(r"^\d{4}-\d{2}$", value):
            raise serializers.ValidationError("Formato inválido. Use YYYY-MM")
        year, month = value.split("-")
        if not 1 <= int(month) <= 12:
            raise serializers.ValidationError("Mês deve estar entre 01 e 12")
        return value


class BulkGenerateTransfersResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    created_count = serializers.IntegerField()
    month = serializers.CharField()
    transfers = TransferSerializer(many=True)
