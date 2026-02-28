from decimal import Decimal

from django.db.models import Count
from django.utils import timezone
from django.utils.timezone import now
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django_filters import rest_framework as filters

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.export_utils import build_csv_response, build_pdf_response, format_decimal
from app.permissions import GlobalDefaultPermission
from expenses.filters import ExpenseFilter
from expenses.models import EXPENSES_CATEGORIES, Expense, FixedExpense
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


# Build a lookup dict for category display names
EXPENSES_CATEGORY_LABELS = dict(EXPENSES_CATEGORIES)


class ExportExpensesView(APIView):
    """
    Export expenses as CSV or PDF.

    GET /api/v1/expenses/export/

    Query Parameters
    ----------------
    format : str
        'csv' (default) or 'pdf'
    date_from : str
        Start date filter (YYYY-MM-DD)
    date_to : str
        End date filter (YYYY-MM-DD)
    category : str
        Expense category key
    payed : str
        'true' or 'false'
    search : str
        Description search term
    account : list[int]
        One or more account IDs (repeatable param)
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Expense.objects.none()  # Required for GlobalDefaultPermission

    def get(self, request):
        format_type = request.query_params.get("export_format", "csv").lower()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        category = request.query_params.get("category")
        payed_param = request.query_params.get("payed")
        search = request.query_params.get("search")
        account_ids = request.query_params.getlist("account")

        qs = (
            Expense.objects.filter(is_deleted=False)
            .select_related("account")
            .order_by("-date", "-id")
        )

        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if category:
            qs = qs.filter(category=category)
        if payed_param is not None and payed_param != "":
            qs = qs.filter(payed=(payed_param.lower() == "true"))
        if search:
            qs = qs.filter(description__icontains=search)
        if account_ids:
            try:
                ids = [int(a) for a in account_ids if a]
                if ids:
                    qs = qs.filter(account__id__in=ids)
            except (ValueError, TypeError):
                pass

        # Build period string for report header
        period_parts = []
        if date_from:
            period_parts.append(
                f"De {date_from[8:10]}/{date_from[5:7]}/{date_from[:4]}"
            )
        if date_to:
            period_parts.append(f"até {date_to[8:10]}/{date_to[5:7]}/{date_to[:4]}")
        period = " ".join(period_parts) if period_parts else "Todo o período"

        total = (
            sum(Decimal(str(e.value)) for e in qs) if qs.exists() else Decimal("0.00")
        )

        user_name = ""
        if hasattr(request.user, "get_full_name"):
            user_name = request.user.get_full_name() or request.user.username
        else:
            user_name = getattr(request.user, "username", "")

        filename = f"despesas_{now().strftime('%Y-%m-%d')}"

        headers = [
            "Data",
            "Descrição",
            "Categoria",
            "Conta",
            "Valor",
            "Pago",
            "Merchant",
        ]

        rows = []
        for exp in qs:
            rows.append(
                [
                    exp.date.strftime("%d/%m/%Y"),
                    exp.description,
                    EXPENSES_CATEGORY_LABELS.get(exp.category, exp.category),
                    exp.account.account_name if exp.account else "",
                    format_decimal(exp.value),
                    "Sim" if exp.payed else "Não",
                    exp.merchant or "",
                ]
            )

        if format_type == "pdf":
            totals_row = [
                "",
                "TOTAL",
                "",
                "",
                format_decimal(total),
                "",
                "",
            ]
            return build_pdf_response(
                title="Relatório de Despesas",
                headers=headers,
                rows=rows,
                totals_row=totals_row,
                meta={
                    "user_name": user_name,
                    "period": period,
                    "total": format_decimal(total),
                },
                filename=filename,
            )

        return build_csv_response(rows=rows, headers=headers, filename=filename)
