from decimal import Decimal
from typing import Any

from rest_framework import serializers

from accounts.models import Account


class AccountSerializer(serializers.ModelSerializer):
    account_number_masked = serializers.ReadOnlyField()
    balance = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        source="current_balance",
        required=False,
    )
    institution = serializers.CharField(
        source="institution_name", required=True
    )
    account_number = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = Account
        fields = [
            "id",
            "uuid",
            "account_name",
            "account_type",
            "institution",
            "account_number",
            "account_number_masked",
            "balance",
            "minimum_balance",
            "overdraft_limit",
            "opening_date",
            "description",
            "owner",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "uuid",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        balance = attrs.get("current_balance", Decimal("0.00"))
        overdraft_limit = attrs.get("overdraft_limit", Decimal("0.00"))
        if balance < -overdraft_limit:
            raise serializers.ValidationError(
                {
                    "balance": (
                        f"Saldo não pode ser menor que -{overdraft_limit} "
                        f"(limite do cheque especial)."
                    )
                }
            )
        return attrs

    def create(self, validated_data: dict[str, Any]) -> Account:
        account_number = validated_data.pop("account_number", None)
        instance: Account = super().create(  # type: ignore[assignment]
            validated_data
        )
        if account_number:
            instance.account_number = account_number
            instance.save()
        return instance

    def update(
        self, instance: Account, validated_data: dict[str, Any]
    ) -> Account:
        account_number = validated_data.pop("account_number", None)
        instance = super().update(  # type: ignore[assignment]
            instance, validated_data
        )
        if account_number:
            instance.account_number = account_number
            instance.save()
        return instance
