from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django_filters import rest_framework as filters

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from expenses.filters import ExpenseFilter
from expenses.models import Expense, FixedExpense
from expenses.serializers import (
    BulkGenerateRequestSerializer,
    BulkGenerateResponseSerializer,
    BulkMarkPaidSerializer,
    ExpenseSerializer,
    FixedExpenseCreateUpdateSerializer,
    FixedExpenseSerializer,
)
from expenses.services import bulk_generate_fixed_expenses, get_fixed_expenses_stats


class ExpenseCreateListView(BaseListCreateView):
    queryset = Expense.objects.filter(is_deleted=False).select_related("account")
    serializer_class = ExpenseSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = ExpenseFilter
    ordering = ["-date", "-id"]


class ExpenseRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    queryset = Expense.objects.filter(is_deleted=False).select_related("account")
    serializer_class = ExpenseSerializer


class FixedExpenseListCreateView(BaseListCreateView):
    queryset = FixedExpense.objects.all()  # Required for GlobalDefaultPermission

    def get_queryset(self):
        return (
            FixedExpense.objects.filter(is_deleted=False)
            .select_related("account", "member", "credit_card")
            .annotate(total_generated=Count("generated_expenses"))
            .order_by("due_day", "description")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FixedExpenseCreateUpdateSerializer
        return FixedExpenseSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)


class FixedExpenseDetailView(BaseRetrieveUpdateDestroyView):
    queryset = FixedExpense.objects.filter(is_deleted=False).select_related(
        "account", "member", "credit_card"
    )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return FixedExpenseCreateUpdateSerializer
        return FixedExpenseSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()


class BulkGenerateFixedExpensesView(APIView):
    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = FixedExpense.objects.none()  # Required for GlobalDefaultPermission

    def post(self, request):
        serializer = BulkGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = bulk_generate_fixed_expenses(
                month=serializer.validated_data["month"],
                expense_values=serializer.validated_data["expense_values"],
                user=request.user,
            )
            return Response(
                BulkGenerateResponseSerializer(result).data,
                status=status.HTTP_201_CREATED,
            )
        except FixedExpense.DoesNotExist:
            return Response(
                {
                    "error": (
                        "Uma ou mais despesas fixas não foram"
                        " encontradas ou estão inativas"
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"error": f"Erro ao gerar despesas: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class BulkMarkPaidView(APIView):
    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = Expense.objects.none()  # Required for GlobalDefaultPermission

    def post(self, request):
        serializer = BulkMarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = Expense.objects.filter(
            id__in=serializer.validated_data["expense_ids"],
            is_deleted=False,
        ).update(payed=True, updated_by=request.user)
        return Response(
            {"success": True, "updated_count": updated}, status=status.HTTP_200_OK
        )


class FixedExpensesStatsView(APIView):
    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = FixedExpense.objects.none()  # Required for GlobalDefaultPermission

    def get(self, request):
        return Response(get_fixed_expenses_stats(), status=status.HTTP_200_OK)
