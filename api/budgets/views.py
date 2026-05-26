from datetime import timedelta
from decimal import Decimal
from typing import Any, cast

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from budgets.models import Budget
from budgets.serializers import (
    BudgetHistorySerializer,
    BudgetSerializer,
    BudgetStatusSerializer,
)
from credit_cards.models import CreditCardBill
from expenses.models import Expense

BILLS_AND_SERVICES_CATEGORY = "bills and services"


class BudgetListCreateView(BaseListCreateView):
    serializer_class = BudgetSerializer

    def get_queryset(self) -> QuerySet[Budget]:
        user = cast(User, self.request.user)
        return Budget.objects.filter(
            created_by=user, is_deleted=False
        ).select_related("member")

    def perform_create(self, serializer: Any) -> None:
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class BudgetDetailView(BaseRetrieveUpdateDestroyView):
    serializer_class = BudgetSerializer

    def get_queryset(self) -> QuerySet[Budget]:
        user = cast(User, self.request.user)
        return Budget.objects.filter(
            created_by=user, is_deleted=False
        ).select_related("member")

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

        budgets = Budget.objects.filter(month=month, year=year).select_related(
            "member"
        )

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
        expense_map: dict = {e["category"]: e["total"] for e in expense_totals}

        # Include credit card bill interest/fees in "bills and services"
        # category
        bill_charges = CreditCardBill.objects.filter(
            payment_date__month=month,
            payment_date__year=year,
            status="paid",
            is_deleted=False,
        ).aggregate(
            total_interest=Sum("interest_charged"),
            total_late_fee=Sum("late_fee"),
        )
        extra_charges = (bill_charges["total_interest"] or Decimal("0")) + (
            bill_charges["total_late_fee"] or Decimal("0")
        )
        if extra_charges > 0:
            existing = expense_map.get(
                BILLS_AND_SERVICES_CATEGORY, Decimal("0")
            )
            expense_map[BILLS_AND_SERVICES_CATEGORY] = existing + extra_charges

        result = []
        for budget in budgets:
            actual_spent = expense_map.get(budget.category, Decimal("0.00"))
            rollover = (
                budget.rollover_amount
                if budget.rollover_enabled
                else Decimal("0")
            )
            limit = budget.limit_amount + rollover
            percentage = (
                float(actual_spent / limit * 100) if limit > 0 else 0.0
            )

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
                    "limit_amount": budget.limit_amount,
                    "rollover_amount": rollover,
                    "effective_limit": limit,
                    "actual_spent": actual_spent,
                    "percentage": round(percentage, 2),
                    "status": budget_status,
                    "member": budget.member_id,
                    "member_name": (
                        budget.member.name if budget.member else None
                    ),
                    "month": budget.month,
                    "year": budget.year,
                }
            )

        serializer = BudgetStatusSerializer(result, many=True)
        return Response(serializer.data)


class BudgetHistoryView(APIView):
    """
    GET /api/v1/budgets/history/?category=<cat>&months=6
    Retorna o histórico dos últimos N meses de limite vs gasto real
    para uma categoria específica.
    Parâmetros: category (obrigatório), months (opcional, padrão=6, máx=24).
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Budget.objects.none()  # Required for GlobalDefaultPermission

    def get(self, request: Request) -> Response:
        category = request.query_params.get("category")
        if not category:
            return Response(
                {"error": "O parâmetro 'category' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            months = int(request.query_params.get("months", 6))
        except (TypeError, ValueError):
            return Response(
                {"error": "O parâmetro 'months' deve ser um inteiro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        months = max(1, min(months, 24))

        now = timezone.now()
        # Build list of (month, year) for the last N months, oldest first
        month_list = []
        m, y = now.month, now.year
        for _ in range(months):
            month_list.append((m, y))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        month_list.reverse()

        user = cast(User, request.user)

        # Fetch budgets for this category/user over the period
        budget_qs = Budget.objects.filter(
            category=category,
            created_by=user,
            is_deleted=False,
        )
        budget_map = {(b.month, b.year): b.limit_amount for b in budget_qs}

        # Aggregate paid expenses by month for the period
        period_q = Q()
        for pm, py in month_list:
            period_q |= Q(date__month=pm, date__year=py)

        expense_totals = (
            Expense.objects.filter(
                period_q,
                category=category,
                payed=True,
            )
            .values("date__month", "date__year")
            .annotate(total=Sum("value"))
        )
        expense_map = {
            (e["date__month"], e["date__year"]): e["total"]
            for e in expense_totals
        }

        result = []
        for pm, py in month_list:
            limit = budget_map.get((pm, py))
            actual_spent = expense_map.get((pm, py), Decimal("0.00"))
            if limit is not None and limit > 0:
                percentage = float(actual_spent / limit * 100)
            else:
                percentage = 0.0
            result.append(
                {
                    "month": pm,
                    "year": py,
                    "limit_amount": limit,
                    "actual_spent": actual_spent,
                    "percentage": round(percentage, 2),
                }
            )

        serializer = BudgetHistorySerializer(result, many=True)
        return Response(serializer.data)


class BudgetSuggestView(APIView):
    """
    POST /api/v1/budgets/suggest/

    Analisa o histórico de despesas dos últimos 3 meses e usa o LLM
    para sugerir limites de orçamento por categoria.

    Body (opcional): { "include_llm_reasoning": true }
    Response: lista de sugestões por categoria com valor sugerido e
    justificativa.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        user = cast(User, request.user)
        include_reasoning = request.data.get("include_llm_reasoning", False)

        today = timezone.now().date()
        three_months_ago = (today.replace(day=1) - timedelta(days=1)).replace(
            day=1
        ) - timedelta(days=60)
        three_months_ago = three_months_ago.replace(day=1)

        # Agregar gastos por categoria nos últimos 3 meses
        expense_by_category = (
            Expense.objects.filter(
                created_by=user,
                payed=True,
                date__gte=three_months_ago,
                related_transfer__isnull=True,
                is_deleted=False,
            )
            .values("category")
            .annotate(total_3m=Sum("value"))
            .order_by("-total_3m")
        )

        if not expense_by_category:
            return Response(
                {"detail": "Sem histórico de despesas nos últimos 3 meses."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Calcular média mensal por categoria
        suggestions_base = []
        for row in expense_by_category:
            monthly_avg = float(row["total_3m"]) / 3
            # Sugerir 10% acima da média para folga; arredondar para 2 casas
            suggested = round(monthly_avg * 1.10, 2)
            suggestions_base.append(
                {
                    "category": row["category"],
                    "avg_monthly_spent": round(monthly_avg, 2),
                    "suggested_limit": suggested,
                    "reasoning": None,
                }
            )

        if not include_reasoning:
            return Response({"suggestions": suggestions_base})

        # Chamar LLM para enriquecer com justificativas
        try:
            from agents.core.llm_client import LLMClient

            lines = "\n".join(
                f"- {s['category']}: média R$ {s['avg_monthly_spent']:.2f}/mês"
                f" → sugestão R$ {s['suggested_limit']:.2f}"
                for s in suggestions_base
            )
            prompt = (
                "Você é um assistente financeiro pessoal."
                " Com base nos dados abaixo,"
                " forneça em 1 frase curta (máx. 20 palavras)"
                " a justificativa para cada"
                " sugestão de orçamento. Responda em JSON:"
                " lista de objetos com"
                ' {"category": str, "reasoning": str}.\n\n'
                f"Dados dos últimos 3 meses:\n{lines}"
            )
            llm_response = LLMClient.chat(
                [{"role": "user", "content": prompt}]
            )

            import json as _json

            start = llm_response.find("[")
            end = llm_response.rfind("]") + 1
            if start != -1 and end > start:
                reasonings = _json.loads(llm_response[start:end])
                reasoning_map = {
                    r["category"]: r.get("reasoning", "") for r in reasonings
                }
                for s in suggestions_base:
                    s["reasoning"] = reasoning_map.get(s["category"])
        except Exception:
            pass  # LLM opcional — retorna sem raciocínio em caso de falha

        return Response({"suggestions": suggestions_base})
