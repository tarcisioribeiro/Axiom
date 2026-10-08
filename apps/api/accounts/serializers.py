import os
from decimal import Decimal
from typing import Any

from rest_framework import serializers

from accounts.models import (
    WALLET_ACCOUNT_TYPE,
    Account,
    compute_account_number_hash,
)


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
    available_balance = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    deposited_in_vaults = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
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
            "available_balance",
            "deposited_in_vaults",
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
        request = self.context.get("request")
        account_number = attrs.get("account_number")
        number_hash: str | None
        if account_number:
            number_hash = compute_account_number_hash(
                account_number, os.getenv("ENCRYPTION_KEY", "")
            )
        else:
            number_hash = getattr(self.instance, "account_number_hash", None)
        institution = attrs.get(
            "institution_name",
            getattr(self.instance, "institution_name", None),
        )
        if number_hash and institution and request:
            duplicates = Account.objects.filter(
                created_by=request.user,
                institution_name=institution,
                account_number_hash=number_hash,
                is_deleted=False,
            )
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {
                        "account_number": (
                            "Já existe conta com esta instituição e número."
                        )
                    }
                )
        account_type = attrs.get(
            "account_type", getattr(self.instance, "account_type", None)
        )
        if account_type == WALLET_ACCOUNT_TYPE and request:
            wallets = Account.objects.filter(
                created_by=request.user,
                account_type=WALLET_ACCOUNT_TYPE,
                is_deleted=False,
            )
            if self.instance:
                wallets = wallets.exclude(pk=self.instance.pk)
            if wallets.exists():
                raise serializers.ValidationError(
                    {"account_type": "Só é permitida uma Carteira Móvel."}
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
