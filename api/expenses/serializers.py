from rest_framework import serializers

from expenses.models import Expense, FixedExpense


class ExpenseSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.account_name", read_only=True)
    current_balance = serializers.DecimalField(
        source="account.current_balance",
        max_digits=15,
        decimal_places=2,
        read_only=True,
    )
    payable_description = serializers.CharField(
        source="related_payable.description", read_only=True, allow_null=True
    )

    class Meta:
        model = Expense
        fields = "__all__"


# Fixed Expense Serializers


class FixedExpenseSerializer(serializers.ModelSerializer):
    """Serializer para leitura de despesas fixas (templates)"""

    account_name = serializers.SerializerMethodField()
    member_name = serializers.CharField(
        source="member.member_name", read_only=True, allow_null=True
    )
    credit_card_name = serializers.CharField(
        source="credit_card.name", read_only=True, allow_null=True
    )
    total_generated = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = FixedExpense
        fields = "__all__"

    def get_account_name(self, obj):
        """
        Retorna o nome da conta associada.
        Se for despesa em conta, retorna o nome da conta.
        Se for despesa em cartão, retorna o nome da conta associada ao cartão.
        """
        if obj.account:
            return obj.account.account_name
        elif obj.credit_card and obj.credit_card.associated_account:
            return (
                f"{obj.credit_card.associated_account.account_name}"
                f" (via {obj.credit_card.name})"
            )
        return None


class FixedExpenseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de despesas fixas"""

    class Meta:
        model = FixedExpense
        exclude = [
            "last_generated_month",
            "uuid",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
        ]

    def validate_due_day(self, value):
        if not 1 <= value <= 31:
            raise serializers.ValidationError("O dia deve estar entre 1 e 31")
        return value

    def validate(self, attrs):
        """
        Valida exclusividade mútua entre account e credit_card.
        Também garante que pelo menos um seja fornecido na criação.
        """
        account = attrs.get("account")
        credit_card = attrs.get("credit_card")

        # Na criação, verificar se pelo menos um foi fornecido
        if self.instance is None:
            if not account and not credit_card:
                _msg = "Selecione uma conta bancária ou um cartão de crédito."
                raise serializers.ValidationError(
                    {
                        "account": _msg,
                        "credit_card": _msg,
                    }
                )
            if account and credit_card:
                _msg2 = (
                    "Não é possível selecionar tanto conta quanto"
                    " cartão de crédito. Escolha apenas um."
                )
                raise serializers.ValidationError(
                    {
                        "account": _msg2,
                        "credit_card": _msg2,
                    }
                )

        return attrs

    def update(self, instance, validated_data):
        """
        Garante exclusividade mútua entre account e credit_card durante update.
        Quando um é fornecido, o outro é automaticamente limpo.
        """
        # Se credit_card foi fornecido (e não é None explícito), limpar account
        if "credit_card" in validated_data:
            if validated_data["credit_card"] is not None:
                validated_data["account"] = None
        # Se account foi fornecido (e não é None explícito), limpar credit_card
        elif "account" in validated_data:
            if validated_data["account"] is not None:
                validated_data["credit_card"] = None

        # Atualizar campos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


# Bulk Operations Serializers


class FixedExpenseValueSerializer(serializers.Serializer):
    """Serializer para valores de despesa fixa no bulk generate"""

    fixed_expense_id = serializers.IntegerField()
    value = serializers.DecimalField(max_digits=10, decimal_places=2)


class BulkGenerateRequestSerializer(serializers.Serializer):
    """Request para geração em lote de despesas fixas"""

    month = serializers.CharField(max_length=7, help_text="Formato: YYYY-MM")
    expense_values = serializers.ListField(
        child=FixedExpenseValueSerializer(), allow_empty=False
    )

    def validate_month(self, value):
        """Valida formato do mês YYYY-MM"""
        import re

        if not re.match(r"^\d{4}-\d{2}$", value):
            raise serializers.ValidationError("Formato inválido. Use YYYY-MM")

        # Valida se o mês é válido (01-12)
        year, month = value.split("-")
        month_int = int(month)
        if not 1 <= month_int <= 12:
            raise serializers.ValidationError("Mês deve estar entre 01 e 12")

        return value


class BulkGenerateResponseSerializer(serializers.Serializer):
    """Response da geração em lote"""

    success = serializers.BooleanField()
    created_count = serializers.IntegerField()
    month = serializers.CharField()
    expenses = ExpenseSerializer(many=True)


class BulkMarkPaidSerializer(serializers.Serializer):
    """Request para marcar múltiplas despesas como pagas"""

    expense_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
