from rest_framework import serializers

from loans.models import Loan


class LoanSerializer(serializers.ModelSerializer):
    # Campos relacionados (nomes em vez de apenas IDs)
    account_name = serializers.CharField(source="account.account_name", read_only=True)
    benefited_name = serializers.CharField(source="benefited.name", read_only=True)
    creditor_name = serializers.CharField(source="creditor.name", read_only=True)
    guarantor_name = serializers.CharField(
        source="guarantor.name", read_only=True, allow_null=True
    )

    # Campos computados
    remaining_balance = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = "__all__"

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
