from decimal import Decimal

from django.db.models import Count
from django.utils import timezone
from django.utils.timezone import now
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.export_utils import (
    build_csv_response,
    build_pdf_response,
    format_decimal,
)
from app.permissions import GlobalDefaultPermission
from app.throttles import ExportRateThrottle
from revenues.filters import RevenueFilter
from revenues.models import REVENUES_CATEGORIES, FixedRevenue, Revenue
from revenues.serializers import (
    BulkGenerateRevenuesRequestSerializer,
    BulkGenerateRevenuesResponseSerializer,
    FixedRevenueCreateUpdateSerializer,
    FixedRevenueSerializer,
    RevenueSerializer,
)
from revenues.services import (
    bulk_generate_fixed_revenues,
    get_fixed_revenues_stats,
)

# Build a lookup dict for category display names
REVENUES_CATEGORY_LABELS = dict(REVENUES_CATEGORIES)


class RevenueCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar receitas.

    Permite:
    - GET: Lista todas as receitas ordenadas por data decrescente
    - POST: Cria uma nova receita

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de todas as receitas (exclui deletadas) com relação
        account pré-carregada
    serializer_class : class
        Serializer usado para validação e serialização
    ordering : list
        Ordenação padrão por data e ID decrescente
    """

    queryset = Revenue.objects.all()  # GlobalDefaultPermission
    serializer_class = RevenueSerializer
    filterset_class = RevenueFilter
    ordering = ["-date", "-id"]

    def get_queryset(self):
        return Revenue.objects.filter(
            created_by=self.request.user
        ).select_related("account")

    def perform_create(self, serializer):
        from django.db import transaction

        from accounts.services import recalculate_account_balance

        with transaction.atomic():
            instance = serializer.save(
                created_by=self.request.user, updated_by=self.request.user
            )
            if instance.account_id:
                recalculate_account_balance(instance.account_id)


class RevenueRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em receitas.

    Permite:
    - GET: Recupera uma receita específica
    - PUT/PATCH: Atualiza uma receita existente
    - DELETE: Remove uma receita

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de todas as receitas (exclui deletadas) com relação
        account pré-carregada
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Revenue.objects.all()  # GlobalDefaultPermission
    serializer_class = RevenueSerializer

    def get_queryset(self):
        return Revenue.objects.filter(
            created_by=self.request.user
        ).select_related("account")

    def perform_update(self, serializer):
        from django.db import transaction

        from accounts.services import recalculate_account_balance

        with transaction.atomic():
            instance = serializer.save(updated_by=self.request.user)
            if instance.account_id:
                recalculate_account_balance(instance.account_id)

    def perform_destroy(self, instance):
        from django.db import transaction

        from accounts.services import recalculate_account_balance

        account_id = instance.account_id
        with transaction.atomic():
            instance.delete()
            if account_id:
                recalculate_account_balance(account_id)


class FixedRevenueListCreateView(BaseListCreateView):
    queryset = FixedRevenue.objects.all()

    def get_queryset(self):
        return (
            FixedRevenue.objects.select_related("account", "member")
            .annotate(total_generated=Count("id"))
            .order_by("due_day", "description")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FixedRevenueCreateUpdateSerializer
        return FixedRevenueSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class FixedRevenueDetailView(BaseRetrieveUpdateDestroyView):
    queryset = FixedRevenue.objects.select_related("account", "member")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return FixedRevenueCreateUpdateSerializer
        return FixedRevenueSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()


class BulkGenerateFixedRevenuesView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = FixedRevenue.objects.none()

    def post(self, request):
        serializer = BulkGenerateRevenuesRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = bulk_generate_fixed_revenues(
            month=serializer.validated_data["month"],
            revenue_values=serializer.validated_data["revenue_values"],
            user=request.user,
        )

        response_serializer = BulkGenerateRevenuesResponseSerializer(result)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED
        )


class FixedRevenuesStatsView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = FixedRevenue.objects.none()

    def get(self, request):
        stats = get_fixed_revenues_stats()
        return Response(stats)


class ExportRevenuesView(APIView):
    """
    Export revenues as CSV or PDF.

    GET /api/v1/revenues/export/

    Query Parameters
    ----------------
    format : str
        'csv' (default) or 'pdf'
    date_from : str
        Start date filter (YYYY-MM-DD)
    date_to : str
        End date filter (YYYY-MM-DD)
    category : str
        Revenue category key
    received : str
        'true' or 'false'
    search : str
        Description search term
    account : list[int]
        One or more account IDs (repeatable param)
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    throttle_classes = [ExportRateThrottle]
    queryset = Revenue.objects.none()  # Required for GlobalDefaultPermission

    def get(self, request):
        format_type = request.query_params.get("export_format", "csv").lower()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        category = request.query_params.get("category")
        received_param = request.query_params.get("received")
        search = request.query_params.get("search")
        account_ids = request.query_params.getlist("account")

        qs = Revenue.objects.select_related("account").order_by("-date", "-id")

        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if category:
            qs = qs.filter(category=category)
        if received_param is not None and received_param != "":
            qs = qs.filter(received=(received_param.lower() == "true"))
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
            period_parts.append(
                f"até {date_to[8:10]}/{date_to[5:7]}/{date_to[:4]}"
            )
        period = " ".join(period_parts) if period_parts else "Todo o período"

        total = (
            sum(r.net_amount for r in qs) if qs.exists() else Decimal("0.00")
        )

        user_name = ""
        if hasattr(request.user, "get_full_name"):
            user_name = request.user.get_full_name() or request.user.username
        else:
            user_name = getattr(request.user, "username", "")

        filename = f"receitas_{now().strftime('%Y-%m-%d')}"

        headers = [
            "Data",
            "Descrição",
            "Categoria",
            "Conta",
            "Valor",
            "Valor Líquido",
            "Recebido",
            "Fonte",
        ]

        rows = []
        for rev in qs:
            rows.append(
                [
                    rev.date.strftime("%d/%m/%Y"),
                    rev.description,
                    REVENUES_CATEGORY_LABELS.get(rev.category, rev.category),
                    rev.account.account_name if rev.account else "",
                    format_decimal(rev.value),
                    format_decimal(rev.net_amount),
                    "Sim" if rev.received else "Não",
                    rev.source or "",
                ]
            )

        if format_type == "pdf":
            totals_row = [
                "",
                "TOTAL",
                "",
                "",
                format_decimal(
                    sum(Decimal(str(r.value)) for r in qs)
                    if qs.exists()
                    else 0
                ),
                format_decimal(total),
                "",
                "",
            ]
            return build_pdf_response(
                title="Relatório de Receitas",
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

        # Default: CSV
        return build_csv_response(
            rows=rows, headers=headers, filename=filename
        )
