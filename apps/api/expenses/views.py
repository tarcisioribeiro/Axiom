from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.utils.timezone import now
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django_filters import rest_framework as filters

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.export_utils import (
    build_csv_response,
    build_pdf_response,
    format_decimal,
)
from app.permissions import GlobalDefaultPermission
from app.throttles import CategorizationSuggestThrottle, ExportRateThrottle
from expenses.filters import ExpenseFilter
from expenses.models import (
    EXPENSES_CATEGORIES,
    AutomationRule,
    AutomationRuleLog,
    CategorizationRule,
    Expense,
    ExpenseSplit,
    FixedExpense,
    FixedExpenseGenerationLog,
    Tag,
)
from expenses.serializers import (
    AutomationRuleLogSerializer,
    AutomationRuleSerializer,
    BulkGenerateRequestSerializer,
    BulkGenerateResponseSerializer,
    BulkMarkPaidSerializer,
    CategorizationRuleSerializer,
    ExpenseSerializer,
    ExpenseSplitSerializer,
    FixedExpenseCreateUpdateSerializer,
    FixedExpenseGenerationLogSerializer,
    FixedExpenseSerializer,
    TagSerializer,
)
from expenses.services import (
    bulk_generate_fixed_expenses,
    get_fixed_expenses_stats,
    get_fully_generated_months,
)


class ExpenseCreateListView(BaseListCreateView):
    queryset = Expense.objects.all()  # GlobalDefaultPermission
    serializer_class = ExpenseSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = ExpenseFilter
    ordering = ["-date", "-id"]

    def get_queryset(self):
        return (
            Expense.objects.filter(created_by=self.request.user)
            .select_related("account", "member")
            .prefetch_related("tags")
        )

    def perform_create(self, serializer):
        from django.db import transaction

        from accounts.services import recalculate_account_balance

        with transaction.atomic():
            instance = serializer.save(
                created_by=self.request.user, updated_by=self.request.user
            )
            if instance.account_id:
                recalculate_account_balance(instance.account_id)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        data = dict(serializer.data)
        budget_warning = getattr(serializer, "_budget_warning", None)
        if budget_warning:
            data["budget_warning"] = budget_warning
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class ExpenseRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    queryset = Expense.objects.all()  # GlobalDefaultPermission
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return (
            Expense.objects.filter(created_by=self.request.user)
            .select_related("account", "member")
            .prefetch_related("tags")
        )

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

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        data = dict(serializer.data)
        budget_warning = getattr(serializer, "_budget_warning", None)
        if budget_warning:
            data["budget_warning"] = budget_warning
        return Response(data)


class FixedExpenseListCreateView(BaseListCreateView):
    queryset = (
        FixedExpense.objects.all()
    )  # Required for GlobalDefaultPermission

    def get_queryset(self):
        return (
            FixedExpense.objects.select_related(
                "account", "member", "credit_card"
            )
            .annotate(total_generated=Count("generated_expenses"))
            .order_by("due_day", "description")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FixedExpenseCreateUpdateSerializer
        return FixedExpenseSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class FixedExpenseDetailView(BaseRetrieveUpdateDestroyView):
    queryset = FixedExpense.objects.select_related(
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
    queryset = (
        FixedExpense.objects.none()
    )  # Required for GlobalDefaultPermission

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
        from django.db import transaction

        from accounts.services import recalculate_account_balance

        serializer = BulkMarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense_ids = serializer.validated_data["expense_ids"]

        account_ids = set(
            Expense.objects.filter(id__in=expense_ids)
            .values_list("account_id", flat=True)
            .distinct()
        )

        with transaction.atomic():
            updated = Expense.objects.filter(id__in=expense_ids).update(
                payed=True, updated_by=request.user
            )
            for account_id in account_ids:
                if account_id:
                    recalculate_account_balance(account_id)

        return Response(
            {"success": True, "updated_count": updated},
            status=status.HTTP_200_OK,
        )


class FixedExpensesStatsView(APIView):
    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = (
        FixedExpense.objects.none()
    )  # Required for GlobalDefaultPermission

    def get(self, request):
        return Response(get_fixed_expenses_stats(), status=status.HTTP_200_OK)


class FixedExpensesGeneratedMonthsView(APIView):
    """GET /api/v1/expenses/fixed-expenses/generated-months/

    Lista os meses (``YYYY-MM``) em que todos os templates de despesa fixa
    ativos já foram lançados, para o diálogo de lançamento remover essas
    opções. Aceita ``?months=`` (default 6, máx 24)."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = FixedExpense.objects.none()

    def get(self, request):
        months_ahead = request.query_params.get("months", 6)
        try:
            months_ahead = int(months_ahead)
        except (TypeError, ValueError):
            months_ahead = 6
        return Response(
            {
                "fully_generated_months": get_fully_generated_months(
                    months_ahead
                )
            }
        )


class CategorizationRuleListCreateView(BaseListCreateView):
    queryset = CategorizationRule.objects.all()
    serializer_class = CategorizationRuleSerializer

    def get_queryset(self):
        return CategorizationRule.objects.filter(
            owner=self.request.user
        ).order_by("created_at")

    def perform_create(self, serializer):
        serializer.save(
            owner=self.request.user,
            created_by=self.request.user,
            updated_by=self.request.user,
        )


class CategorizationRuleRetrieveUpdateDestroyView(
    BaseRetrieveUpdateDestroyView
):
    queryset = CategorizationRule.objects.all()
    serializer_class = CategorizationRuleSerializer

    def get_queryset(self):
        return CategorizationRule.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


class ExpenseSuggestCategoryView(APIView):
    """
    Sugere uma categoria para uma despesa via heurística + LLM fallback.

    POST /api/v1/expenses/suggest-category/

    Body:
        description (str, optional): descrição da despesa
        merchant    (str, optional): nome do estabelecimento
        value       (str|number, optional): valor da despesa

    Pelo menos um de description ou merchant deve ser fornecido.

    Response:
        category (str): chave de categoria sugerida
        method   (str): 'rule' | 'llm' | 'none'
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Expense.objects.none()
    throttle_classes = [CategorizationSuggestThrottle]

    def post(self, request):
        description = str(request.data.get("description", "") or "").strip()
        merchant = str(request.data.get("merchant", "") or "").strip()
        value = request.data.get("value")

        if not description and not merchant:
            return Response(
                {"detail": "Informe 'description' ou 'merchant'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from expenses.categorization_service import suggest_category

        result = suggest_category(
            request.user,
            description=description,
            merchant=merchant,
            value=value,
        )
        return Response(result)


class ApplyCategorizationRulesView(APIView):
    """
    Reaplica as regras de categorização em despesas elegíveis do usuário.

    POST /api/v1/categorization-rules/apply/

    Despesas elegíveis: auto_categorized=True ou category='others'.
    Usa bulk_update para evitar N+1 queries e fuzzy matching para maior
    cobertura. Retorna o número de despesas atualizadas, o total processado
    e score por match.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = CategorizationRule.objects.none()

    def post(self, request):
        from rapidfuzz import fuzz as _fuzz

        THRESHOLD = 80

        rules = list(
            CategorizationRule.objects.filter(
                owner=request.user, is_active=True
            ).order_by("priority", "created_at")
        )

        if not rules:
            return Response({"updated": 0, "total_processed": 0})

        expenses = list(
            Expense.objects.filter(
                created_by=request.user,
            ).filter(Q(auto_categorized=True) | Q(category="others"))
        )

        total_processed = len(expenses)
        to_update = []
        match_details = []

        for expense in expenses:
            if not expense.merchant:
                continue
            merchant_lower = expense.merchant.lower()
            for rule in rules:
                rule_lower = rule.merchant_contains.lower()
                score = _fuzz.partial_ratio(rule_lower, merchant_lower)
                if rule_lower in merchant_lower or score >= THRESHOLD:
                    expense.category = rule.category
                    expense.auto_categorized = True
                    to_update.append(expense)
                    match_details.append(
                        {
                            "expense_id": expense.id,
                            "rule_id": rule.id,
                            "score": score,
                        }
                    )
                    break

        if to_update:
            Expense.objects.bulk_update(
                to_update, ["category", "auto_categorized"]
            )

        return Response(
            {
                "updated": len(to_update),
                "total_processed": total_processed,
                "matches": match_details,
            }
        )


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
    throttle_classes = [ExportRateThrottle]
    queryset = Expense.objects.none()  # Required for GlobalDefaultPermission

    def get(self, request):
        format_type = request.query_params.get("export_format", "csv").lower()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        category = request.query_params.get("category")
        payed_param = request.query_params.get("payed")
        search = request.query_params.get("search")
        account_ids = request.query_params.getlist("account")

        qs = Expense.objects.select_related("account").order_by("-date", "-id")

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
            period_parts.append(
                f"até {date_to[8:10]}/{date_to[5:7]}/{date_to[:4]}"
            )
        period = " ".join(period_parts) if period_parts else "Todo o período"

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

        if format_type == "pdf":
            PDF_ROW_LIMIT = 10_000
            count = qs.count()
            if count > PDF_ROW_LIMIT:
                return Response(
                    {
                        "detail": (
                            f"O relatório contém {count} registros, que excede"
                            f" o limite de {PDF_ROW_LIMIT} para exportação em"
                            " PDF. Use um intervalo de datas menor ou exporte"
                            " em CSV."
                        )
                    },
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

            total = qs.aggregate(total=Sum("value"))["total"] or Decimal(
                "0.00"
            )

            rows = [
                [
                    exp.date.strftime("%d/%m/%Y"),
                    exp.description,
                    EXPENSES_CATEGORY_LABELS.get(exp.category, exp.category),
                    exp.account.account_name if exp.account else "",
                    format_decimal(exp.value),
                    "Sim" if exp.payed else "Não",
                    exp.merchant or "",
                ]
                for exp in qs
            ]

            totals_row = ["", "TOTAL", "", "", format_decimal(total), "", ""]
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

        def _csv_rows():
            for exp in qs.iterator(chunk_size=500):
                yield [
                    exp.date.strftime("%d/%m/%Y"),
                    exp.description,
                    EXPENSES_CATEGORY_LABELS.get(exp.category, exp.category),
                    exp.account.account_name if exp.account else "",
                    format_decimal(exp.value),
                    "Sim" if exp.payed else "Não",
                    exp.merchant or "",
                ]

        return build_csv_response(
            rows=_csv_rows(), headers=headers, filename=filename
        )


class TagListCreateView(BaseListCreateView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer

    def get_queryset(self):
        return (
            Tag.objects.filter(owner=self.request.user)
            .annotate(
                expense_count=Count(
                    "expenses", filter=Q(expenses__is_deleted=False)
                )
            )
            .order_by("name")
        )

    def perform_create(self, serializer):
        serializer.save(
            owner=self.request.user,
            created_by=self.request.user,
            updated_by=self.request.user,
        )


class TagDetailView(BaseRetrieveUpdateDestroyView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer

    def get_queryset(self):
        return Tag.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ExpenseSplitListCreateView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = ExpenseSplit.objects.none()

    def get(self, request, pk):
        expense = Expense.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not expense:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        splits = ExpenseSplit.objects.filter(expense=expense).select_related(
            "member"
        )
        serializer = ExpenseSplitSerializer(splits, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        expense = Expense.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not expense:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        from decimal import Decimal

        data = request.data.copy()
        data["expense"] = expense.id
        serializer = ExpenseSplitSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        # Validate total splits don't exceed expense value
        existing_total = sum(
            s.value for s in ExpenseSplit.objects.filter(expense=expense)
        )
        new_value = Decimal(str(serializer.validated_data["value"]))
        if existing_total + new_value > expense.value:
            return Response(
                {"detail": "Total dos splits excede o valor da despesa."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        split = serializer.save(
            expense=expense,
            created_by=request.user,
            updated_by=request.user,
        )
        return Response(
            ExpenseSplitSerializer(split).data, status=status.HTTP_201_CREATED
        )


class FixedExpenseGenerationLogListView(APIView):
    """
    GET /api/v1/expenses/fixed-expenses/generation-log/

    Returns the history of automatic fixed expense generation for the
    current user.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = FixedExpenseGenerationLog.objects.none()

    def get(self, request):
        logs = FixedExpenseGenerationLog.objects.filter(
            generated_by=request.user
        ).order_by("-month")[:24]
        serializer = FixedExpenseGenerationLogSerializer(logs, many=True)
        return Response(serializer.data)


class ExpenseOCRView(APIView):
    """
    POST /api/v1/expenses/ocr/

    Receives an image (multipart/form-data, field `image`), runs OCR via
    pytesseract and returns structured data for pre-filling the expense form.
    Returns an empty payload (all null) if OCR is unavailable or fails.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Expense.objects.none()

    _MERCHANT_PATTERNS = [
        r"(?:estabelecimento|loja|cnpj)[:\s]+([A-Za-zÀ-ÿ\s&\-'\.]{3,60})",
        r"^([A-Z][A-Za-zÀ-ÿ\s&\-'\.]{2,40})\s*$",
    ]
    _AMOUNT_PATTERNS = [
        r"(?:total|valor|v\.total|vlr\.?total)[:\s]*r?\$?\s*([\d\.,]+)",
        r"r\$\s*([\d\.,]+)",
    ]
    _DATE_PATTERNS = [
        r"(\d{2}/\d{2}/\d{4})",
        r"(\d{2}-\d{2}-\d{4})",
        r"(\d{4}-\d{2}-\d{2})",
    ]

    def _extract_amount(self, text: str) -> str | None:
        import re

        lower = text.lower()
        for pattern in self._AMOUNT_PATTERNS:
            match = re.search(pattern, lower)
            if match:
                raw = match.group(1).replace(".", "").replace(",", ".")
                try:
                    return str(round(float(raw), 2))
                except ValueError:
                    continue
        return None

    def _extract_date(self, text: str) -> str | None:
        import re

        for pattern in self._DATE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                raw = match.group(1)
                for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
                    try:
                        from datetime import datetime

                        return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
                    except ValueError:
                        continue
        return None

    def _extract_merchant(self, text: str) -> str | None:
        import re

        for pattern in self._MERCHANT_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                merchant = match.group(1).strip()
                if len(merchant) >= 3:
                    return merchant[:80]
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for line in lines[:5]:
            if len(line) >= 3 and not any(c.isdigit() for c in line[:3]):
                return line[:80]
        return None

    def post(self, request):
        empty = {"value": None, "date": None, "merchant": None, "error": None}
        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {
                    "value": None,
                    "date": None,
                    "merchant": None,
                    "error": "no_image",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            import pytesseract  # type: ignore[import-not-found]
            from PIL import Image  # type: ignore[import-not-found]

            image = Image.open(image_file).convert("RGB")
            text = pytesseract.image_to_string(
                image, lang="por+eng", config="--psm 6"
            )
        except ImportError:
            return Response({**empty, "error": "ocr_unavailable"})
        except Exception:
            return Response({**empty, "error": "ocr_failed"})

        return Response(
            {
                "value": self._extract_amount(text),
                "date": self._extract_date(text),
                "merchant": self._extract_merchant(text),
                "error": None,
            }
        )


class AutomationRuleListCreateView(BaseListCreateView):
    queryset = AutomationRule.objects.all()
    serializer_class = AutomationRuleSerializer

    def get_queryset(self):
        return AutomationRule.objects.filter(
            owner=self.request.user, is_deleted=False
        ).order_by("priority", "created_at")

    def perform_create(self, serializer):
        serializer.save(
            owner=self.request.user,
            created_by=self.request.user,
            updated_by=self.request.user,
        )


class AutomationRuleRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    queryset = AutomationRule.objects.all()
    serializer_class = AutomationRuleSerializer

    def get_queryset(self):
        return AutomationRule.objects.filter(
            owner=self.request.user, is_deleted=False
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


class AutomationRuleApplyView(APIView):
    """Aplica manualmente as regras de automação às despesas."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = AutomationRule.objects.none()

    def post(self, request):
        rules = AutomationRule.objects.filter(
            owner=request.user, is_active=True, is_deleted=False
        ).order_by("priority", "created_at")

        expenses = Expense.objects.filter(
            account__owner=request.user, is_deleted=False
        ).select_related("account")

        total_applied = 0
        for expense in expenses:
            for rule in rules:
                if rule.matches(expense):
                    applied = rule.apply(expense)
                    if applied:
                        expense.save(update_fields=["category"])
                        AutomationRuleLog.objects.create(
                            rule=rule,
                            expense=expense,
                            actions_applied=applied,
                            created_by=request.user,
                            updated_by=request.user,
                        )
                        AutomationRule.objects.filter(pk=rule.pk).update(
                            apply_count=rule.apply_count + 1
                        )
                        total_applied += 1

        return Response({"applied": total_applied}, status=status.HTTP_200_OK)


class AutomationRuleLogListView(APIView):
    """Retorna o histórico de aplicações das regras de automação."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = AutomationRuleLog.objects.none()

    def get(self, request, pk):
        rule = AutomationRule.objects.filter(
            pk=pk, owner=request.user, is_deleted=False
        ).first()
        if not rule:
            return Response(status=status.HTTP_404_NOT_FOUND)
        logs = AutomationRuleLog.objects.filter(rule=rule).order_by(
            "-created_at"
        )[:50]
        serializer = AutomationRuleLogSerializer(logs, many=True)
        return Response(serializer.data)
