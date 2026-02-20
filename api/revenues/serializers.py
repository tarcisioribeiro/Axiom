from rest_framework import serializers

from revenues.models import Revenue


class RevenueSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.account_name", read_only=True)
    current_balance = serializers.DecimalField(
        source="account.current_balance",
        max_digits=15,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Revenue
        fields = [
            "id",
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
        ]
        read_only_fields = ["id", "net_amount", "account_name", "current_balance"]
