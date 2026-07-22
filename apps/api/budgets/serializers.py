from rest_framework import serializers

from budgets.models import Budget


class BudgetSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(
        source="member.name", read_only=True, allow_null=True
    )

    class Meta:
        model = Budget
        fields = [
            "id",
            "uuid",
            "category",
            "limit_amount",
            "month",
            "year",
            "member",
            "member_name",
            "rollover_enabled",
            "rollover_amount",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        category = attrs.get(
            "category", getattr(self.instance, "category", None)
        )
        month = attrs.get("month", getattr(self.instance, "month", None))
        year = attrs.get("year", getattr(self.instance, "year", None))
        member = attrs.get("member", getattr(self.instance, "member", None))

        qs = Budget.objects.filter(
            category=category,
            month=month,
            year=year,
            member=member,
            is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                "Já existe um orçamento para esta categoria neste mês/ano."
            )
        return attrs


class BudgetStatusSerializer(serializers.Serializer):
    """Status do orçamento: limite vs gasto real."""

    id = serializers.IntegerField()
    category = serializers.CharField()
    limit_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    rollover_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    effective_limit = serializers.DecimalField(max_digits=10, decimal_places=2)
    actual_spent = serializers.DecimalField(max_digits=10, decimal_places=2)
    percentage = serializers.FloatField()
    status = serializers.CharField()  # 'ok', 'warning', 'exceeded'
    member = serializers.IntegerField(allow_null=True)
    member_name = serializers.CharField(allow_null=True)
    month = serializers.IntegerField()
    year = serializers.IntegerField()


class BudgetHistorySerializer(serializers.Serializer):
    """Histórico de orçamento: limite vs gasto real por mês."""

    month = serializers.IntegerField()
    year = serializers.IntegerField()
    limit_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True
    )
    actual_spent = serializers.DecimalField(max_digits=10, decimal_places=2)
    percentage = serializers.FloatField()
