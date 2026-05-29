from rest_framework import serializers

from loans.models import Loan, LoanInstallment


class LoanInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanInstallment
        fields = [
            "id",
            "uuid",
            "loan",
            "installment_number",
            "value",
            "due_date",
            "payed",
            "payment_expense",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "loan",
            "installment_number",
            "value",
            "due_date",
            "created_at",
            "updated_at",
        ]


class LoanSerializer(serializers.ModelSerializer):
    # Campos relacionados (nomes em vez de apenas IDs)
    account_name = serializers.CharField(
        source="account.account_name", read_only=True
    )
    benefited_name = serializers.CharField(
        source="benefited.name", read_only=True
    )
    creditor_name = serializers.CharField(
        source="creditor.name", read_only=True
    )
    guarantor_name = serializers.CharField(
        source="guarantor.name", read_only=True, allow_null=True
    )

    # Campos computados
    remaining_balance = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            "id",
            "uuid",
            "description",
            "value",
            "payed_value",
            "date",
            "horary",
            "category",
            "account",
            "account_name",
            "benefited",
            "benefited_name",
            "creditor",
            "creditor_name",
            "payed",
            "interest_rate",
            "installments",
            "due_date",
            "contract_document",
            "payment_frequency",
            "late_fee",
            "guarantor",
            "guarantor_name",
            "notes",
            "currency_code",
            "status",
            "remaining_balance",
            "created_at",
            "updated_at",
        ]

    def get_remaining_balance(self, obj):
        """
        Calcula o saldo restante do empréstimo.

        Returns
        -------
        str
            Saldo restante formatado como string
        """
        remaining = float(obj.value) - float(obj.payed_value)
        return f"{remaining:.2f}"
