from rest_framework import serializers

from payables.models import Payable, PayableInstallment


class PayableInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayableInstallment
        fields = [
            "id",
            "uuid",
            "payable",
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
            "payable",
            "installment_number",
            "value",
            "due_date",
            "created_at",
            "updated_at",
        ]


class PayableSerializer(serializers.ModelSerializer):
    """Serializer para Payable com campos calculados e relacionados."""

    member_name = serializers.CharField(
        source="member.name", read_only=True, allow_null=True
    )
    remaining_value = serializers.SerializerMethodField()
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Payable
        fields = [
            "id",
            "uuid",
            "description",
            "value",
            "paid_value",
            "date",
            "due_date",
            "category",
            "category_display",
            "member",
            "member_name",
            "notes",
            "status",
            "status_display",
            "remaining_value",
            "installments",
            "is_cumulative",
            "payment_frequency",
            "created_at",
            "updated_at",
        ]

    def get_remaining_value(self, obj):
        """Calcula o valor restante a pagar."""
        remaining = float(obj.value) - float(obj.paid_value)
        return f"{remaining:.2f}"


class RecalculationPreviewSerializer(serializers.Serializer):
    """Serializa payables.services.RecalculationPreview — reusado pelos
    endpoints de plano de pagamento, aumento de valor, recálculo de
    parcelas e redistribuição após pagamento manual."""

    payable_id = serializers.IntegerField()
    mode = serializers.CharField()
    old_installment_count = serializers.IntegerField()
    new_installment_count = serializers.IntegerField()
    old_value_per_installment = serializers.DecimalField(
        max_digits=10, decimal_places=2
    )
    new_value_per_installment = serializers.DecimalField(
        max_digits=10, decimal_places=2
    )
    remaining_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    installments_preview = serializers.ListField(child=serializers.DictField())
