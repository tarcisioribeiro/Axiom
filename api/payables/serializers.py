from rest_framework import serializers

from payables.models import Payable


class PayableSerializer(serializers.ModelSerializer):
    """Serializer para Payable com campos calculados e relacionados."""

    member_name = serializers.CharField(
        source="member.name", read_only=True, allow_null=True
    )
    remaining_value = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Payable
        fields = "__all__"

    def get_remaining_value(self, obj):
        """Calcula o valor restante a pagar."""
        remaining = float(obj.value) - float(obj.paid_value)
        return f"{remaining:.2f}"
