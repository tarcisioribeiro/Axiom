from decimal import Decimal
from typing import Any

from django.db.models import QuerySet, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from budgets.models import Budget
from budgets.serializers import BudgetSerializer, BudgetStatusSerializer
from expenses.models import Expense


class BudgetListCreateView(BaseListCreateView):
    serializer_class = BudgetSerializer

    def get_queryset(self) -> QuerySet[Budget]:
        return Budget.objects.select_related("member")

    def perform_create(self, serializer: Any) -> None:
        serializer.save(created_by=self.request.user, updated_by=self.request.user)


class BudgetDetailView(BaseRetrieveUpdateDestroyView):
    serializer_class = BudgetSerializer

    def get_queryset(self) -> QuerySet[Budget]:
        return Budget.objects.select_related("member")

    def perform_update(self, serializer: Any) -> None:
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance: Any) -> None:
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


class BudgetStatusView(APIView):
    """
    GET /api/v1/budgets/status/
    Retorna o status de cada orçamento (limite vs gasto real) para o mês/ano.
    Parâmetros opcionais: month, year (padrão: mês/ano atual).
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Budget.objects.none()  # Required for GlobalDefaultPermission

    def get(self, request: Request) -> Response:
        now = timezone.now()
        try:
            month = int(request.query_params.get("month", now.month))
            year = int(request.query_params.get("year", now.year))
        except (TypeError, ValueError):
            return Response(
                {"error": "Parâmetros month e year devem ser inteiros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (1 <= month <= 12):
            return Response(
                {"error": "month deve ser entre 1 e 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        budgets = Budget.objects.filter(month=month, year=year).select_related("member")

        # Aggregate actual expenses by category for the given month/year
        expense_totals = (
            Expense.objects.filter(
                date__month=month,
                date__year=year,
                payed=True,
            )
            .values("category")
            .annotate(total=Sum("value"))
        )
        expense_map = {e["category"]: e["total"] for e in expense_totals}

        result = []
        for budget in budgets:
            actual_spent = expense_map.get(budget.category, Decimal("0.00"))
            limit = budget.limit_amount
            percentage = float(actual_spent / limit * 100) if limit > 0 else 0.0

            if percentage >= 100:
                budget_status = "exceeded"
            elif percentage >= 80:
                budget_status = "warning"
            else:
                budget_status = "ok"

            result.append(
                {
                    "id": budget.id,
                    "category": budget.category,
                    "limit_amount": limit,
                    "actual_spent": actual_spent,
                    "percentage": round(percentage, 2),
                    "status": budget_status,
                    "member": budget.member_id,
                    "member_name": budget.member.name if budget.member else None,
                    "month": budget.month,
                    "year": budget.year,
                }
            )

        serializer = BudgetStatusSerializer(result, many=True)
        return Response(serializer.data)
