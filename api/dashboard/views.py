"""
Dashboard Views

Endpoints otimizados para Dashboard que usam aggregations no banco de dados
em vez de buscar todos os registros e calcular no frontend.

PERF-02: Reduz de 6 requisições para 1 única requisição otimizada.
PERF-03: Cache Redis para reduzir carga no banco de dados.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, DecimalField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
from credit_cards.models import CreditCard, CreditCardBill, CreditCardInstallment
from expenses.models import Expense, FixedExpense
from loans.models import Loan
from members.models import Member
from payables.models import Payable
from revenues.models import Revenue


def get_cache_key(prefix: str, user_id: Optional[int] = None) -> str:
    """Gera chave de cache com prefixo e user_id opcional."""
    if user_id:
        return f"dashboard:{prefix}:user:{user_id}"
    return f"dashboard:{prefix}"


def invalidate_dashboard_cache():
    """
    Invalida todas as chaves de cache do dashboard.
    Chamar quando dados financeiros sao alterados (accounts, expenses, revenues, etc).
    """
    cache_keys = [
        get_cache_key("account_balances"),
        get_cache_key("stats"),
        get_cache_key("category_breakdown"),
        get_cache_key("balance_forecast"),
        get_cache_key("cash_flow_forecast:days:30"),
        get_cache_key("cash_flow_forecast:days:60"),
        get_cache_key("cash_flow_forecast:days:90"),
    ]
    cache.delete_many(cache_keys)


class AccountBalancesView(APIView):
    """
    GET /api/v1/dashboard/account-balances/

    Retorna lista de contas com saldo atual e saldo futuro.

    Saldo Futuro = Saldo Atual + Receitas Pendentes - Despesas Pendentes

    Response:
    [
        {
            "id": 1,
            "account_name": "Nubank",
            "institution_name": "NUB",
            "current_balance": 1000.00,
            "pending_revenues": 500.00,
            "pending_expenses": 200.00,
            "future_balance": 1300.00
        },
        ...
    ]
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Tenta buscar do cache
        cache_key = get_cache_key("account_balances")
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return Response(cached_result)

        # Subquery para receitas pendentes por conta
        pending_revenues_subquery = (
            Revenue.objects.filter(
                account=OuterRef("pk"),
                is_deleted=False,
                related_transfer__isnull=True,
                received=False,
            )
            .values("account")
            .annotate(total=Sum("value"))
            .values("total")
        )

        # Subquery para despesas pendentes por conta
        pending_expenses_subquery = (
            Expense.objects.filter(
                account=OuterRef("pk"),
                is_deleted=False,
                related_transfer__isnull=True,
                payed=False,
            )
            .values("account")
            .annotate(total=Sum("value"))
            .values("total")
        )

        # Query unica com annotate (evita N+1)
        accounts = (
            Account.objects.filter(is_deleted=False)
            .annotate(
                pending_revenues=Coalesce(
                    Subquery(pending_revenues_subquery),
                    Value(Decimal("0.00")),
                    output_field=DecimalField(),
                ),
                pending_expenses=Coalesce(
                    Subquery(pending_expenses_subquery),
                    Value(Decimal("0.00")),
                    output_field=DecimalField(),
                ),
            )
            .order_by("account_name")
        )

        result = []
        for account in accounts:
            current_balance = account.current_balance or Decimal("0.00")
            pending_rev = account.pending_revenues or Decimal("0.00")
            pending_exp = account.pending_expenses or Decimal("0.00")
            future_balance = current_balance + pending_rev - pending_exp

            result.append(
                {
                    "id": account.id,
                    "account_name": account.account_name,
                    "institution_name": account.institution_name,
                    "current_balance": float(current_balance),
                    "pending_revenues": float(pending_rev),
                    "pending_expenses": float(pending_exp),
                    "future_balance": float(future_balance),
                }
            )

        # Salva no cache com TTL de 30 segundos
        cache_ttl = getattr(settings, "CACHE_TTL_ACCOUNT_BALANCES", 30)
        cache.set(cache_key, result, cache_ttl)

        return Response(result)


class DashboardStatsView(APIView):
    """
    GET /api/v1/dashboard/stats/

    Retorna estatísticas agregadas para o Dashboard em uma única requisição.

    Usa aggregations do Django ORM (SUM, COUNT) que são executadas no banco
    de dados, muito mais rápido que buscar todos os registros e calcular no cliente.

    Performance:
    - ANTES: 6 requisições (accounts, expenses, revenues, credit_cards, etc)
    - DEPOIS: 1 requisição otimizada
    - Redução: ~80% no tempo de carregamento do dashboard

    Response:
    {
        "total_balance": 15000.00,
        "total_expenses": 5000.00,
        "total_revenues": 8000.00,
        "total_credit_limit": 20000.00,
        "used_credit_limit": 5000.00,
        "available_credit_limit": 15000.00,
        "accounts_count": 3,
        "credit_cards_count": 2
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Calcula todas as estatísticas do dashboard em aggregations do DB.
        """
        # Tenta buscar do cache
        cache_key = get_cache_key("stats")
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return Response(cached_result)

        # Filtrar apenas registros não deletados (soft delete)
        # E excluir transações relacionadas a transferências internas
        accounts_qs = Account.objects.filter(is_deleted=False)
        expenses_qs = Expense.objects.filter(
            is_deleted=False, related_transfer__isnull=True, payed=True
        )
        revenues_qs = Revenue.objects.filter(
            is_deleted=False, related_transfer__isnull=True, received=True
        )
        credit_cards_qs = CreditCard.objects.filter(is_deleted=False)

        # Aggregations no banco de dados (otimizado)
        accounts_agg = accounts_qs.aggregate(
            total_balance=Sum("current_balance"), count=Count("id")
        )

        expenses_agg = expenses_qs.aggregate(total=Sum("value"))

        revenues_agg = revenues_qs.aggregate(total=Sum("value"))

        credit_cards_agg = credit_cards_qs.aggregate(
            total_limit=Sum("credit_limit"), count=Count("id")
        )

        # Calcular crédito usado (parcelas não pagas de cartões ativos)
        used_credit = CreditCardInstallment.objects.filter(
            is_deleted=False,
            purchase__is_deleted=False,
            purchase__card__is_deleted=False,
            payed=False,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        total_credit_limit = credit_cards_agg["total_limit"] or Decimal("0.00")
        available_credit = total_credit_limit - used_credit

        # Construir response com valores padrão se None
        stats = {
            "total_balance": float(accounts_agg["total_balance"] or Decimal("0.00")),
            "total_expenses": float(expenses_agg["total"] or Decimal("0.00")),
            "total_revenues": float(revenues_agg["total"] or Decimal("0.00")),
            "total_credit_limit": float(total_credit_limit),
            "used_credit_limit": float(used_credit),
            "available_credit_limit": float(available_credit),
            "accounts_count": accounts_agg["count"] or 0,
            "credit_cards_count": credit_cards_agg["count"] or 0,
        }

        # Salva no cache com TTL de 1 minuto
        cache_ttl = getattr(settings, "CACHE_TTL_DASHBOARD_STATS", 60)
        cache.set(cache_key, stats, cache_ttl)

        return Response(stats)


class CreditCardExpensesByCategoryView(APIView):
    """
    GET /api/v1/dashboard/credit-card-expenses-by-category/

    Retorna agregação de despesas de cartão de crédito por categoria.

    Query params:
    - card: ID do cartão (opcional)
    - bill: ID da fatura (opcional)

    Response:
    [
        {
            "category": "food and drink",
            "total": 1500.00,
            "count": 15
        },
        ...
    ]
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Filtros opcionais
        card_id = request.query_params.get("card")
        bill_id = request.query_params.get("bill")

        # Base queryset - parcelas não deletadas de compras não deletadas
        queryset = CreditCardInstallment.objects.filter(
            is_deleted=False, purchase__is_deleted=False
        )

        # Aplicar filtros
        if card_id:
            queryset = queryset.filter(purchase__card_id=card_id)

        if bill_id:
            queryset = queryset.filter(bill_id=bill_id)

        # Agregar por categoria da compra
        aggregation = (
            queryset.values("purchase__category")
            .annotate(
                total=Coalesce(Sum("value"), Value(0), output_field=DecimalField()),
                count=Count("id"),
            )
            .order_by("-total")
        )

        result = [
            {
                "category": item["purchase__category"],
                "total": float(item["total"]),
                "count": item["count"],
            }
            for item in aggregation
        ]

        return Response(result)


class BalanceForecastView(APIView):
    """
    GET /api/v1/dashboard/balance-forecast/

    Retorna previsão de saldo considerando:
    - Despesas pendentes
    - Receitas pendentes
    - Faturas de cartão não pagas
    - Empréstimos a receber (usuário é credor)
    - Empréstimos a pagar (usuário é beneficiado)
    - Valores a pagar pendentes (payables)

    Response:
    {
        "current_total_balance": 15000.00,
        "forecast_balance": 12500.00,
        "pending_expenses": 1500.00,
        "pending_revenues": 800.00,
        "pending_card_bills": 2000.00,
        "loans_to_receive": 500.00,
        "loans_to_pay": 1300.00,
        "pending_payables": 500.00,
        "summary": {
            "total_income": 1300.00,
            "total_outcome": 5300.00,
            "net_change": -4000.00
        }
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Saldo atual total das contas
        current_balance = Account.objects.filter(is_deleted=False).aggregate(
            total=Sum("current_balance")
        )["total"] or Decimal("0.00")

        # Despesas pendentes (não pagas, excluindo transferências)
        pending_expenses = Expense.objects.filter(
            is_deleted=False, payed=False, related_transfer__isnull=True
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        # Receitas pendentes (não recebidas, excluindo transferências)
        pending_revenues = Revenue.objects.filter(
            is_deleted=False, received=False, related_transfer__isnull=True
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        # Faturas de cartão não pagas (total - valor pago)
        open_bills = CreditCardBill.objects.filter(is_deleted=False).exclude(
            status="paid"
        )
        pending_card_bills = Decimal("0.00")
        for bill in open_bills:
            total = bill.total_amount or Decimal("0.00")
            paid = bill.paid_amount or Decimal("0.00")
            pending_card_bills += total - paid

        # Obter o membro do usuário para calcular empréstimos
        member = Member.objects.filter(user=request.user).first()

        loans_to_receive = Decimal("0.00")
        loans_to_pay = Decimal("0.00")

        if member:
            # Empréstimos a receber (usuário é credor, empréstimo não pago)
            loans_as_creditor = Loan.objects.filter(
                is_deleted=False,
                creditor=member,
                payed=False,
                status__in=["active", "pending", "in_progress"],
            )
            for loan in loans_as_creditor:
                remaining = (loan.value or Decimal("0.00")) - (
                    loan.payed_value or Decimal("0.00")
                )
                loans_to_receive += remaining

            # Empréstimos a pagar (usuário é beneficiado, empréstimo não pago)
            loans_as_benefited = Loan.objects.filter(
                is_deleted=False,
                benefited=member,
                payed=False,
                status__in=["active", "pending", "in_progress"],
            )
            for loan in loans_as_benefited:
                remaining = (loan.value or Decimal("0.00")) - (
                    loan.payed_value or Decimal("0.00")
                )
                loans_to_pay += remaining

        # Valores a pagar pendentes (payables ativos ou em atraso)
        pending_payables = Payable.objects.filter(
            is_deleted=False, status__in=["active", "overdue"]
        ).aggregate(total=Sum("value") - Sum("paid_value"))["total"] or Decimal("0.00")

        # Calcular totais
        total_income = pending_revenues + loans_to_receive
        total_outcome = (
            pending_expenses + pending_card_bills + loans_to_pay + pending_payables
        )
        net_change = total_income - total_outcome
        forecast_balance = current_balance + net_change

        return Response(
            {
                "current_total_balance": float(current_balance),
                "forecast_balance": float(forecast_balance),
                "pending_expenses": float(pending_expenses),
                "pending_revenues": float(pending_revenues),
                "pending_card_bills": float(pending_card_bills),
                "loans_to_receive": float(loans_to_receive),
                "loans_to_pay": float(loans_to_pay),
                "pending_payables": float(pending_payables),
                "summary": {
                    "total_income": float(total_income),
                    "total_outcome": float(total_outcome),
                    "net_change": float(net_change),
                },
            }
        )


class MonthlyStatementView(APIView):
    """
    GET /api/v1/dashboard/monthly-statement/

    Returns consolidated monthly statement with revenues, expenses and balance.

    Query Parameters
    ----------------
    year : int
        Year (YYYY). Defaults to current year.
    month : int
        Month (1-12). Defaults to current month.

    Response
    --------
    {
        "period": "2026-02",
        "total_revenues": "5000.00",
        "total_expenses": "3200.00",
        "balance": "1800.00",
        "revenues_by_category": [
            {"category": "salary", "total": "5000.00", "count": 1}
        ],
        "expenses_by_category": [
            {"category": "food and drink", "total": "800.00", "count": 5}
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()

        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
        except (ValueError, TypeError):
            year = today.year
            month = today.month

        # Clamp month to valid range
        month = max(1, min(12, month))

        expenses_qs = Expense.objects.filter(
            is_deleted=False,
            date__year=year,
            date__month=month,
        )
        revenues_qs = Revenue.objects.filter(
            is_deleted=False,
            date__year=year,
            date__month=month,
        )

        total_expenses = expenses_qs.aggregate(total=Sum("value"))["total"] or Decimal(
            "0.00"
        )
        total_revenues = revenues_qs.aggregate(total=Sum("net_amount"))[
            "total"
        ] or Decimal("0.00")
        balance = total_revenues - total_expenses

        expenses_by_category = list(
            expenses_qs.values("category")
            .annotate(total=Sum("value"), count=Count("id"))
            .order_by("-total")
        )
        revenues_by_category = list(
            revenues_qs.values("category")
            .annotate(total=Sum("net_amount"), count=Count("id"))
            .order_by("-total")
        )

        return Response(
            {
                "period": f"{year:04d}-{month:02d}",
                "total_revenues": str(total_revenues.quantize(Decimal("0.01"))),
                "total_expenses": str(total_expenses.quantize(Decimal("0.01"))),
                "balance": str(balance.quantize(Decimal("0.01"))),
                "revenues_by_category": [
                    {
                        "category": item["category"],
                        "total": str(
                            (item["total"] or Decimal("0.00")).quantize(Decimal("0.01"))
                        ),
                        "count": item["count"],
                    }
                    for item in revenues_by_category
                ],
                "expenses_by_category": [
                    {
                        "category": item["category"],
                        "total": str(
                            (item["total"] or Decimal("0.00")).quantize(Decimal("0.01"))
                        ),
                        "count": item["count"],
                    }
                    for item in expenses_by_category
                ],
            }
        )


class CashFlowForecastView(APIView):
    """
    GET /api/v1/dashboard/cash-flow-forecast/?days=30

    Retorna projecao diaria do fluxo de caixa para os proximos
    30, 60 ou 90 dias considerando todas as entradas e saidas
    agendadas.

    O dia 0 corresponde ao saldo real atual. Despesas fixas ainda
    nao geradas como lancamentos avulsos tambem sao incluidas.

    Query Parameters
    ----------------
    days : int
        Periodo de projecao: 30, 60 ou 90 (default: 30).

    Response
    --------
    {
        "period_days": 30,
        "start_balance": 5000.00,
        "end_balance": 3200.00,
        "total_revenues": 1500.00,
        "total_expenses": 3300.00,
        "net_change": -1800.00,
        "min_balance": 2800.00,
        "min_balance_date": "2026-03-15",
        "daily_breakdown": [
            {
                "date": "2026-02-28",
                "revenues": 0.0,
                "expenses": 0.0,
                "balance": 5000.00
            },
            ...
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    VALID_DAYS = {30, 60, 90}

    def get(self, request) -> Response:
        try:
            days = int(request.query_params.get("days", 30))
        except (ValueError, TypeError):
            days = 30
        if days not in self.VALID_DAYS:
            days = 30

        cache_key = get_cache_key(f"cash_flow_forecast:days:{days}")
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        today = date.today()
        end_date = today + timedelta(days=days)

        # Saldo atual total de todas as contas
        current_balance = Account.objects.filter(is_deleted=False).aggregate(
            total=Sum("current_balance")
        )["total"] or Decimal("0.00")

        # Despesas pendentes no periodo (excluindo transferencias)
        scheduled_expenses = (
            Expense.objects.filter(
                is_deleted=False,
                payed=False,
                related_transfer__isnull=True,
                date__gte=today,
                date__lte=end_date,
            )
            .values("date")
            .annotate(total=Sum("value"))
        )
        expenses_by_date: dict = {
            item["date"]: item["total"] for item in scheduled_expenses
        }

        # Receitas pendentes no periodo (excluindo transferencias)
        scheduled_revenues = (
            Revenue.objects.filter(
                is_deleted=False,
                received=False,
                related_transfer__isnull=True,
                date__gte=today,
                date__lte=end_date,
            )
            .values("date")
            .annotate(total=Sum("value"))
        )
        revenues_by_date: dict = {
            item["date"]: item["total"] for item in scheduled_revenues
        }

        # Despesas fixas ainda nao geradas como lancamentos avulsos
        self._add_ungenerated_fixed_expenses(today, end_date, expenses_by_date)

        # Construir serie diaria (dia 0 = hoje com saldo atual)
        running_balance = current_balance
        daily_breakdown = [
            {
                "date": today.isoformat(),
                "revenues": 0.0,
                "expenses": 0.0,
                "balance": float(running_balance),
            }
        ]

        min_balance = running_balance
        min_balance_date = today

        for i in range(1, days + 1):
            current_date = today + timedelta(days=i)
            day_revenues = revenues_by_date.get(current_date, Decimal("0.00"))
            day_expenses = expenses_by_date.get(current_date, Decimal("0.00"))
            running_balance = running_balance + day_revenues - day_expenses
            if running_balance < min_balance:
                min_balance = running_balance
                min_balance_date = current_date
            daily_breakdown.append(
                {
                    "date": current_date.isoformat(),
                    "revenues": float(day_revenues),
                    "expenses": float(day_expenses),
                    "balance": float(running_balance),
                }
            )

        total_revenues = sum(revenues_by_date.values(), Decimal("0.00"))
        total_expenses = sum(expenses_by_date.values(), Decimal("0.00"))

        result = {
            "period_days": days,
            "start_balance": float(current_balance),
            "end_balance": float(running_balance),
            "total_revenues": float(total_revenues),
            "total_expenses": float(total_expenses),
            "net_change": float(running_balance - current_balance),
            "min_balance": float(min_balance),
            "min_balance_date": min_balance_date.isoformat(),
            "daily_breakdown": daily_breakdown,
        }

        cache_ttl = getattr(settings, "CACHE_TTL_CASH_FLOW_FORECAST", 300)
        cache.set(cache_key, result, cache_ttl)
        return Response(result)

    def _add_ungenerated_fixed_expenses(
        self, today: date, end_date: date, expenses_by_date: dict
    ) -> None:
        """
        Adiciona despesas fixas nao geradas ao dicionario de despesas.

        Para cada template de despesa fixa com conta bancaria, verifica
        quais meses dentro do janela de projecao ainda nao possuem
        lancamento avulso gerado e adiciona uma entrada virtual.
        """
        fixed_expenses = FixedExpense.objects.filter(
            is_deleted=False,
            is_active=True,
            account__isnull=False,
        ).select_related("account")

        if not fixed_expenses.exists():
            return

        # Pre-fetch lancamentos ja gerados no periodo para evitar N+1
        existing = set(
            Expense.objects.filter(
                is_deleted=False,
                fixed_expense_template__isnull=False,
                date__gte=today,
                date__lte=end_date,
            ).values_list(
                "fixed_expense_template_id",
                "date__year",
                "date__month",
            )
        )

        # Itera pelos meses dentro da janela
        months_in_range = []
        month_iter = today.replace(day=1)
        end_month = end_date.replace(day=1)
        while month_iter <= end_month:
            months_in_range.append(month_iter)
            # Avanca para o proximo mes
            if month_iter.month == 12:
                month_iter = month_iter.replace(year=month_iter.year + 1, month=1)
            else:
                month_iter = month_iter.replace(month=month_iter.month + 1)

        for fe in fixed_expenses:
            for month_start in months_in_range:
                year = month_start.year
                month = month_start.month
                month_key = f"{year:04d}-{month:02d}"

                # Ja foi marcado como gerado pelo template
                if fe.last_generated_month and fe.last_generated_month >= month_key:
                    continue

                # Ja existe lancamento avulso gerado para este mes
                if (fe.pk, year, month) in existing:
                    continue

                # Calcula a data de vencimento respeitando o ultimo dia
                max_day = calendar.monthrange(year, month)[1]
                due_day = min(fe.due_day, max_day)
                due_date = month_start.replace(day=due_day)

                if today <= due_date <= end_date:
                    prev = expenses_by_date.get(due_date, Decimal("0.00"))
                    expenses_by_date[due_date] = prev + fe.default_value
