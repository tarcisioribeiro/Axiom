from rest_framework import serializers

from transfers.models import Transfer


class TransferSerializer(serializers.ModelSerializer):
    """
    Serializer para o modelo Transfer.

    Exclui campos de auditoria e soft delete que são gerenciados automaticamente.
    """

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
        read_only_fields = [
            "id",
            "uuid",
            "origin_account_name",
            "destiny_account_name",
            "created_at",
            "updated_at",
        ]
