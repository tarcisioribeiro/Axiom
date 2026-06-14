from rest_framework import serializers

from monthly_planning.models import MonthlyPlan


class MonthlyPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyPlan
        fields = [
            "id",
            "uuid",
            "month",
            "year",
            "extra_revenues",
            "extra_expenses",
            "budget_overrides",
            "fixed_revenue_overrides",
            "fixed_expense_overrides",
            "applied_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "month",
            "year",
            "applied_at",
            "created_at",
            "updated_at",
        ]
