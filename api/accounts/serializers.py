from rest_framework import serializers

from accounts.models import Account


class AccountSerializer(serializers.ModelSerializer):
    account_number_masked = serializers.ReadOnlyField()
    balance = serializers.DecimalField(
        max_digits=15, decimal_places=2, source="current_balance", required=False
    )
    institution = serializers.CharField(source="institution_name", required=True)
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

    def create(self, validated_data):
        account_number = validated_data.pop("account_number", None)
        instance = super().create(validated_data)
        if account_number:
            instance.account_number = account_number
            instance.save()
        return instance

    def update(self, instance, validated_data):
        account_number = validated_data.pop("account_number", None)
        instance = super().update(instance, validated_data)
        if account_number:
            instance.account_number = account_number
            instance.save()
        return instance
