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
from typing import Any, Optional

from django.conf import settings
from django.core.cache import cache
from django.db.models import (
    Count,
    DecimalField,
    F,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
from budgets.models import Budget
from credit_cards.models import (
    CreditCard,
    CreditCardBill,
    CreditCardInstallment,
)
from expenses.models import Expense, FixedExpense
from loans.models import Loan
from members.models import Member
from payables.models import Payable
from revenues.models import Revenue
from transfers.models import Transfer


def get_cache_key(prefix: str, user_id: Optional[int] = None) -> str:
    """Gera chave de cache com prefixo e user_id opcional."""
    if user_id:
        return f"dashboard:{prefix}:user:{user_id}"
    return f"dashboard:{prefix}"


def invalidate_user_dashboard_cache(user_id: int) -> None:
    """Invalida todas as chaves de cache do dashboard para o usuário dado."""
    cache_keys = [
        get_cache_key("account_balances", user_id),
        get_cache_key("stats", user_id),
        get_cache_key("category_breakdown", user_id),
        get_cache_key("balance_forecast", user_id),
        get_cache_key("cash_flow_forecast:days:30", user_id),
        get_cache_key("cash_flow_forecast:days:60", user_id),
        get_cache_key("cash_flow_forecast:days:90", user_id),
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
        # Tenta buscar do cache (por usuário)
        cache_key = get_cache_key("account_balances", request.user.id)
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return Response(cached_result)

        # Subquery para receitas pendentes por conta
        pending_revenues_subquery = (
            Revenue.objects.filter(
                account=OuterRef("pk"),
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
                related_transfer__isnull=True,
                payed=False,
            )
            .values("account")
            .annotate(total=Sum("value"))
            .values("total")
        )

        # Subquery para transferências pendentes saindo da conta (origin)
        pending_transfers_out_subquery = (
            Transfer.objects.filter(
                origin_account=OuterRef("pk"),
                transfered=False,
                status__in=["pending", "processing"],
            )
            .values("origin_account")
            .annotate(total=Sum("value"))
            .values("total")
        )

        # Subquery para transferências pendentes chegando na conta (destiny)
        pending_transfers_in_subquery = (
            Transfer.objects.filter(
                destiny_account=OuterRef("pk"),
                transfered=False,
                status__in=["pending", "processing"],
            )
            .values("destiny_account")
            .annotate(total=Sum("value"))
            .values("total")
        )

        # Query unica com annotate (evita N+1) — apenas contas do usuário
        # autenticado
        accounts = (
            Account.objects.filter(
                created_by=request.user,
            )
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
                pending_transfers_out=Coalesce(
                    Subquery(pending_transfers_out_subquery),
                    Value(Decimal("0.00")),
                    output_field=DecimalField(),
                ),
                pending_transfers_in=Coalesce(
                    Subquery(pending_transfers_in_subquery),
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
            transfers_out = account.pending_transfers_out or Decimal("0.00")
            transfers_in = account.pending_transfers_in or Decimal("0.00")
            future_balance = (
                current_balance
                + pending_rev
                - pending_exp
                + transfers_in
                - transfers_out
            )

            result.append(
                {
                    "id": account.id,
                    "account_name": account.account_name,
                    "institution_name": account.institution_name,
                    "current_balance": float(current_balance),
                    "pending_revenues": float(pending_rev),
                    "pending_expenses": float(pending_exp),
                    "pending_transfers_in": float(transfers_in),
                    "pending_transfers_out": float(transfers_out),
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
    de dados, muito mais rápido que buscar todos os registros e calcular
    no cliente.

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
        # Tenta buscar do cache (por usuário)
        cache_key = get_cache_key("stats", request.user.id)
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return Response(cached_result)

        # Apenas dados do usuário autenticado
        accounts_qs = Account.objects.filter(created_by=request.user)
        expenses_qs = Expense.objects.filter(
            created_by=request.user,
            related_transfer__isnull=True,
            payed=True,
        )
        revenues_qs = Revenue.objects.filter(
            created_by=request.user,
            related_transfer__isnull=True,
            received=True,
        )
        credit_cards_qs = CreditCard.objects.filter(created_by=request.user)

        # Aggregations no banco de dados (otimizado)
        accounts_agg = accounts_qs.aggregate(
            total_balance=Sum("current_balance"), count=Count("id")
        )

        expenses_agg = expenses_qs.aggregate(total=Sum("value"))

        revenues_agg = revenues_qs.aggregate(total=Sum("value"))

        credit_cards_agg = credit_cards_qs.aggregate(
            total_limit=Sum("credit_limit"), count=Count("id")
        )

        # Calcular crédito usado (parcelas não pagas dos cartões do usuário)
        used_credit = CreditCardInstallment.objects.filter(
            payed=False,
            purchase__card__created_by=request.user,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        total_credit_limit = credit_cards_agg["total_limit"] or Decimal("0.00")
        available_credit = total_credit_limit - used_credit

        # Construir response com valores padrão se None
        stats = {
            "total_balance": float(
                accounts_agg["total_balance"] or Decimal("0.00")
            ),
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

        # Base queryset - apenas parcelas dos cartões do usuário autenticado
        queryset = CreditCardInstallment.objects.filter(
            purchase__card__created_by=request.user,
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
                total=Coalesce(
                    Sum("value"), Value(0), output_field=DecimalField()
                ),
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
        # Saldo atual total das contas do usuário
        current_balance = Account.objects.filter(
            created_by=request.user,
        ).aggregate(total=Sum("current_balance"))["total"] or Decimal("0.00")

        # Despesas pendentes (não pagas, excluindo transferências) do usuário
        pending_expenses = Expense.objects.filter(
            created_by=request.user,
            payed=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        # Receitas pendentes (não recebidas, excluindo transferências) do
        # usuário
        pending_revenues = Revenue.objects.filter(
            created_by=request.user,
            received=False,
            related_transfer__isnull=True,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        # Faturas de cartão não pagas dos cartões do usuário
        # (total - valor pago)
        open_bills = CreditCardBill.objects.filter(
            credit_card__created_by=request.user,
        ).exclude(status="paid")
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
                benefited=member,
                payed=False,
                status__in=["active", "pending", "in_progress"],
            )
            for loan in loans_as_benefited:
                remaining = (loan.value or Decimal("0.00")) - (
                    loan.payed_value or Decimal("0.00")
                )
                loans_to_pay += remaining

        # Valores a pagar pendentes (payables ativos ou em atraso) do usuário
        pending_payables = Payable.objects.filter(
            created_by=request.user,
            status__in=["active", "overdue"],
        ).aggregate(total=Sum("value") - Sum("paid_value"))[
            "total"
        ] or Decimal(
            "0.00"
        )

        # Calcular totais
        total_income = pending_revenues + loans_to_receive
        total_outcome = (
            pending_expenses
            + pending_card_bills
            + loans_to_pay
            + pending_payables
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
            created_by=request.user,
            date__year=year,
            date__month=month,
        )
        revenues_qs = Revenue.objects.filter(
            created_by=request.user,
            date__year=year,
            date__month=month,
        )

        total_expenses = expenses_qs.aggregate(total=Sum("value"))[
            "total"
        ] or Decimal("0.00")
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
                "total_revenues": str(
                    total_revenues.quantize(Decimal("0.01"))
                ),
                "total_expenses": str(
                    total_expenses.quantize(Decimal("0.01"))
                ),
                "balance": str(balance.quantize(Decimal("0.01"))),
                "revenues_by_category": [
                    {
                        "category": item["category"],
                        "total": str(
                            (item["total"] or Decimal("0.00")).quantize(
                                Decimal("0.01")
                            )
                        ),
                        "count": item["count"],
                    }
                    for item in revenues_by_category
                ],
                "expenses_by_category": [
                    {
                        "category": item["category"],
                        "total": str(
                            (item["total"] or Decimal("0.00")).quantize(
                                Decimal("0.01")
                            )
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
        self._user = request.user
        try:
            days = int(request.query_params.get("days", 30))
        except (ValueError, TypeError):
            days = 30
        if days not in self.VALID_DAYS:
            days = 30

        cache_key = get_cache_key(
            f"cash_flow_forecast:days:{days}", request.user.id
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        today = date.today()
        end_date = today + timedelta(days=days)

        # Saldo atual total das contas do usuário
        current_balance = Account.objects.filter(
            created_by=request.user,
        ).aggregate(total=Sum("current_balance"))["total"] or Decimal("0.00")

        # Despesas pendentes no periodo (excluindo transferencias) do usuário
        scheduled_expenses = (
            Expense.objects.filter(
                created_by=request.user,
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

        # Receitas pendentes no periodo (excluindo transferencias) do usuário
        scheduled_revenues = (
            Revenue.objects.filter(
                created_by=request.user,
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

        # Faturas de cartão de crédito não pagas com vencimento no periodo
        self._add_credit_card_bills(today, end_date, expenses_by_date)

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
            is_active=True,
            account__isnull=False,
            created_by=self._user,
        ).select_related("account")

        if not fixed_expenses.exists():
            return

        # Pre-fetch lancamentos ja gerados no periodo para evitar N+1
        existing = set(
            Expense.objects.filter(
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
                month_iter = month_iter.replace(
                    year=month_iter.year + 1, month=1
                )
            else:
                month_iter = month_iter.replace(month=month_iter.month + 1)

        for fe in fixed_expenses:
            for month_start in months_in_range:
                year = month_start.year
                month = month_start.month
                month_key = f"{year:04d}-{month:02d}"

                # Ja foi marcado como gerado pelo template
                if (
                    fe.last_generated_month
                    and fe.last_generated_month >= month_key
                ):
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

    def _add_credit_card_bills(
        self, today: date, end_date: date, expenses_by_date: dict
    ) -> None:
        """
        Adiciona o saldo devedor das faturas de cartao de credito nao pagas
        ao dicionario de despesas, agrupado pela data de vencimento.

        Para faturas com due_date explícito, usa a data real.
        Para faturas sem due_date (abertas), estima a data a partir do
        due_day configurado no cartão.
        """
        _MONTH_MAP = {
            "Jan": 1,
            "Feb": 2,
            "Mar": 3,
            "Apr": 4,
            "May": 5,
            "Jun": 6,
            "Jul": 7,
            "Aug": 8,
            "Sep": 9,
            "Oct": 10,
            "Nov": 11,
            "Dec": 12,
        }

        # Faturas com due_date explícito dentro da janela
        bills_with_date = CreditCardBill.objects.filter(
            credit_card__created_by=self._user,
            due_date__isnull=False,
            due_date__gte=today,
            due_date__lte=end_date,
        ).exclude(status="paid")

        for bill in bills_with_date:
            remaining = (bill.total_amount or Decimal("0.00")) - (
                bill.paid_amount or Decimal("0.00")
            )
            if remaining > Decimal("0.00"):
                prev = expenses_by_date.get(bill.due_date, Decimal("0.00"))
                expenses_by_date[bill.due_date] = prev + remaining

        # Faturas sem due_date: estima vencimento pelo due_day do cartão
        bills_no_date = (
            CreditCardBill.objects.filter(
                credit_card__created_by=self._user,
                due_date__isnull=True,
            )
            .exclude(status="paid")
            .select_related("credit_card")
        )

        for bill in bills_no_date:
            cc = bill.credit_card
            if not cc.due_day:
                continue
            month_num = _MONTH_MAP.get(bill.month, 0)
            if not month_num:
                continue
            year_num = int(bill.year)
            # Vencimento ocorre normalmente no mês seguinte ao fechamento
            if month_num == 12:
                due_month, due_year = 1, year_num + 1
            else:
                due_month, due_year = month_num + 1, year_num
            max_day = calendar.monthrange(due_year, due_month)[1]
            estimated_due = date(due_year, due_month, min(cc.due_day, max_day))
            if not (today <= estimated_due <= end_date):
                continue
            remaining = (bill.total_amount or Decimal("0.00")) - (
                bill.paid_amount or Decimal("0.00")
            )
            if remaining > Decimal("0.00"):
                prev = expenses_by_date.get(estimated_due, Decimal("0.00"))
                expenses_by_date[estimated_due] = prev + remaining


class FinancialAlertsView(APIView):
    """
    GET /api/v1/dashboard/financial-alerts/

    Retorna lista de alertas financeiros ativos ordenados por urgência.

    Verifica:
    - Orçamento acima de 80% do limite no mês atual
    - Fatura de cartão com vencimento em ≤ 3 dias
    - Saldo de conta abaixo do saldo mínimo configurado
    - Valor a pagar com vencimento em ≤ 5 dias
    - Empréstimo com vencimento em ≤ 7 dias

    Severidade: "danger" > "warning"
    """

    permission_classes = [IsAuthenticated]

    # Mapeamento de categorias para exibição em português
    CATEGORY_LABELS = {
        "food and drink": "Comida e Bebida",
        "bills and services": "Contas e Serviços",
        "entertainment": "Entretenimento",
        "transport": "Transporte",
        "health and care": "Saúde e Cuidados",
        "housing": "Moradia",
        "education": "Educação",
        "clothing": "Vestuário",
        "travel": "Viagem",
        "investments": "Investimentos",
        "gifts and donations": "Presentes e Doações",
        "taxes and fees": "Impostos e Taxas",
        "insurance": "Seguros",
        "pet": "Pet",
        "electronics": "Eletrônicos",
        "sports and hobbies": "Esportes e Hobbies",
        "beauty and personal care": "Beleza e Cuidados Pessoais",
        "childcare": "Cuidados Infantis",
        "maintenance and repairs": "Manutenção e Reparos",
        "others": "Outros",
    }

    def _category_label(self, category: str) -> str:
        return self.CATEGORY_LABELS.get(category, category)

    def get(self, request):
        today = timezone.now().date()
        user = request.user
        member = Member.objects.filter(user=user).first()
        alerts = []

        # 1. Orçamentos acima de 80% do limite
        alerts.extend(self._check_budgets(today, user, member))

        # 2. Faturas de cartão com vencimento em ≤ 3 dias
        alerts.extend(self._check_credit_card_bills(today, user))

        # 3. Contas com saldo abaixo do mínimo
        alerts.extend(self._check_account_balances(user))

        # 4. Valores a pagar com vencimento em ≤ 5 dias
        alerts.extend(self._check_payables(today, user))

        # 5. Empréstimos com vencimento em ≤ 7 dias
        alerts.extend(self._check_loans(today, member))

        # Ordenar: danger primeiro, depois warning
        severity_order = {"danger": 0, "warning": 1, "info": 2}
        alerts.sort(key=lambda a: severity_order.get(a["severity"], 9))

        return Response(alerts)

    def _check_budgets(self, today: date, user: Any, member: Any) -> list:
        alerts: list[Any] = []
        month = today.month
        year = today.year

        budgets_qs = Budget.objects.filter(month=month, year=year)
        if member:
            budgets_qs = budgets_qs.filter(member=member)
        else:
            budgets_qs = budgets_qs.none()
        budgets = budgets_qs.select_related("member")

        if not budgets.exists():
            return alerts

        expense_totals = (
            Expense.objects.filter(
                created_by=user,
                date__month=month,
                date__year=year,
                payed=True,
            )
            .values("category")
            .annotate(total=Sum("value"))
        )
        totals_map = {row["category"]: row["total"] for row in expense_totals}

        for budget in budgets:
            limit = budget.limit_amount or Decimal("0.00")
            if limit <= 0:
                continue
            spent = totals_map.get(budget.category, Decimal("0.00"))
            percentage = int((spent / limit) * 100)

            if percentage >= 80:
                severity = "danger" if percentage >= 100 else "warning"
                label = self._category_label(budget.category)
                alerts.append(
                    {
                        "type": "budget_limit",
                        "severity": severity,
                        "message": (
                            f"Orçamento de {label} atingiu"
                            f" {percentage}% do limite"
                        ),
                        "link": "/budgets",
                        "metadata": {
                            "budget_id": str(budget.id),
                            "category": budget.category,
                            "percentage": percentage,
                            "limit_amount": float(limit),
                            "spent_amount": float(spent),
                        },
                    }
                )
        return alerts

    def _check_credit_card_bills(self, today: date, user: Any) -> list:
        alerts = []
        deadline = today + timedelta(days=3)

        bills = CreditCardBill.objects.filter(
            credit_card__created_by=user,
            due_date__isnull=False,
            due_date__lte=deadline,
            status__in=["open", "closed", "overdue"],
        ).select_related("credit_card")

        for bill in bills:
            if bill.due_date is None:
                continue
            days_left = (bill.due_date - today).days
            name = bill.credit_card.name
            days_str = (
                f"{abs(days_left)} dia{'s' if abs(days_left) != 1 else ''}"
            )
            if days_left < 0:
                severity = "danger"
                msg = (
                    f"Fatura do cartão {name} está vencida"
                    f" (venceu há {days_str})"
                )
            elif days_left == 0:
                severity = "danger"
                msg = f"Fatura do cartão {name} vence hoje"
            elif days_left == 1:
                severity = "danger"
                msg = f"Fatura do cartão {name} vence amanhã"
            else:
                severity = "warning"
                msg = f"Fatura do cartão {name} vence em {days_left} dias"

            alerts.append(
                {
                    "type": "credit_card_bill_due",
                    "severity": severity,
                    "message": msg,
                    "link": "/credit-cards",
                    "metadata": {
                        "bill_id": str(bill.id),
                        "card_id": str(bill.credit_card.id),
                        "card_name": bill.credit_card.name,
                        "due_date": bill.due_date.isoformat(),
                        "days_left": days_left,
                        "total_amount": float(bill.total_amount or 0),
                    },
                }
            )
        return alerts

    def _check_account_balances(self, user: Any) -> list:
        alerts = []

        accounts = Account.objects.filter(
            created_by=user,
            is_active=True,
            minimum_balance__gt=0,
            current_balance__lt=F("minimum_balance"),
        )

        for account in accounts:
            current = account.current_balance or Decimal("0.00")
            minimum = account.minimum_balance or Decimal("0.00")
            severity = "danger" if current < 0 else "warning"
            alerts.append(
                {
                    "type": "low_balance",
                    "severity": severity,
                    "message": (
                        f"Saldo da conta {account.account_name}"
                        f" está abaixo do mínimo"
                        f" (R$ {float(current):,.2f}"
                        f" / mín R$ {float(minimum):,.2f})"
                    ),
                    "link": "/accounts",
                    "metadata": {
                        "account_id": str(account.id),
                        "account_name": account.account_name,
                        "current_balance": float(current),
                        "minimum_balance": float(minimum),
                    },
                }
            )
        return alerts

    def _check_payables(self, today: date, user: Any) -> list:
        alerts = []
        deadline = today + timedelta(days=5)

        payables = Payable.objects.filter(
            created_by=user,
            due_date__isnull=False,
            due_date__lte=deadline,
            status__in=["active", "overdue"],
        )

        for payable in payables:
            if payable.due_date is None:
                continue
            days_left = (payable.due_date - today).days
            days_str = (
                f"{abs(days_left)} dia{'s' if abs(days_left) != 1 else ''}"
            )
            desc = payable.description
            if days_left < 0:
                severity = "danger"
                msg = f"{desc} está vencido (venceu há {days_str})"
            elif days_left == 0:
                severity = "danger"
                msg = f"{desc} vence hoje"
            elif days_left <= 2:
                severity = "danger"
                msg = (
                    f"{desc} vence em"
                    f" {days_left} dia{'s' if days_left != 1 else ''}"
                )
            else:
                severity = "warning"
                msg = f"{desc} vence em {days_left} dias"

            alerts.append(
                {
                    "type": "payable_due",
                    "severity": severity,
                    "message": msg,
                    "link": "/payables",
                    "metadata": {
                        "payable_id": str(payable.id),
                        "description": payable.description,
                        "due_date": payable.due_date.isoformat(),
                        "days_left": days_left,
                        "value": float(payable.value or 0),
                    },
                }
            )
        return alerts

    def _check_loans(self, today: date, member: Any) -> list:
        alerts = []
        deadline = today + timedelta(days=7)

        loans_qs = Loan.objects.filter(
            due_date__isnull=False,
            due_date__lte=deadline,
            payed=False,
            status__in=["active", "in_progress", "pending", "overdue"],
        )
        if member:
            loans_qs = loans_qs.filter(
                Q(creditor=member) | Q(benefited=member)
            )
        else:
            loans_qs = loans_qs.none()
        loans = loans_qs

        for loan in loans:
            if loan.due_date is None:
                continue
            days_left = (loan.due_date - today).days
            days_str = (
                f"{abs(days_left)} dia{'s' if abs(days_left) != 1 else ''}"
            )
            desc = loan.description
            if days_left < 0:
                severity = "danger"
                msg = (
                    f"Empréstimo '{desc}' está vencido"
                    f" (venceu há {days_str})"
                )
            elif days_left == 0:
                severity = "danger"
                msg = f"Empréstimo '{desc}' vence hoje"
            elif days_left <= 3:
                severity = "danger"
                msg = (
                    f"Empréstimo '{desc}' vence em"
                    f" {days_left} dia{'s' if days_left != 1 else ''}"
                )
            else:
                severity = "warning"
                msg = f"Empréstimo '{desc}' vence em {days_left} dias"

            alerts.append(
                {
                    "type": "loan_due",
                    "severity": severity,
                    "message": msg,
                    "link": "/loans",
                    "metadata": {
                        "loan_id": str(loan.id),
                        "description": loan.description,
                        "due_date": loan.due_date.isoformat(),
                        "days_left": days_left,
                        "value": float(loan.value or 0),
                    },
                }
            )
        return alerts


class AnomalyDetectionView(APIView):
    """Detects spending anomalies using statistical z-score per category."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from math import sqrt

        user = request.user
        today = timezone.now().date()
        current_month = today.month
        current_year = today.year

        # Current month spending per category
        current_spending = (
            Expense.objects.filter(
                created_by=user,
                date__month=current_month,
                date__year=current_year,
                payed=True,
                is_deleted=False,
            )
            .values("category")
            .annotate(total=Sum("value"))
        )
        current_map = {
            row["category"]: float(row["total"]) for row in current_spending
        }

        anomalies = []
        for category, current_amount in current_map.items():
            # Collect last 6 months of data (excluding current)
            history = []
            for offset in range(1, 7):
                d = today.replace(day=1)
                total_months = d.month - offset
                year = (
                    d.year + total_months // 12 if total_months < 0 else d.year
                )
                month = (
                    total_months % 12 + 1
                    if total_months < 0
                    else total_months % 12 or 12
                )
                if total_months <= 0:
                    year = d.year - 1
                    month = 12 + total_months

                agg = Expense.objects.filter(
                    created_by=user,
                    date__month=month,
                    date__year=year,
                    category=category,
                    payed=True,
                    is_deleted=False,
                ).aggregate(total=Sum("value"))
                if agg["total"]:
                    history.append(float(agg["total"]))

            if len(history) < 3:
                continue

            avg = sum(history) / len(history)
            variance = sum((x - avg) ** 2 for x in history) / len(history)
            std = sqrt(variance) if variance > 0 else 0

            if std == 0:
                continue

            z_score = (current_amount - avg) / std
            if z_score > 1.5:
                anomalies.append(
                    {
                        "category": category,
                        "current_amount": current_amount,
                        "average": round(avg, 2),
                        "std_dev": round(std, 2),
                        "z_score": round(z_score, 2),
                        "message": (
                            f"Gasto em '{category}' está"
                            f" {round(z_score, 1)}σ acima da média."
                        ),
                    }
                )

        return Response({"anomalies": anomalies})


class AccountReconciliationView(APIView):
    """Compare system balance vs imported bank statement entries."""

    permission_classes = (IsAuthenticated,)

    def get(self, request, account_id):
        try:
            account = Account.objects.get(pk=account_id, is_deleted=False)
        except Account.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        system_balance = float(account.current_balance or 0)

        # Try to use bank_reconciliation entries if available
        try:
            from bank_reconciliation.models import BankStatementEntry

            entries = BankStatementEntry.objects.filter(
                account=account, is_deleted=False
            )
            unmatched = entries.filter(matched=False).count()
            statement_balance = float(
                entries.aggregate(total=Sum("amount"))["total"] or 0
            )
        except Exception:
            unmatched = 0
            statement_balance = system_balance

        return Response(
            {
                "account_id": account_id,
                "account_name": account.account_name,
                "system_balance": system_balance,
                "statement_balance": statement_balance,
                "difference": round(system_balance - statement_balance, 2),
                "unmatched_entries_count": unmatched,
            }
        )


class LGPDExportView(APIView):
    """Export all user data as a ZIP file (LGPD compliance)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        import io
        import json
        import zipfile
        from datetime import datetime

        from django.core.cache import cache
        from django.http import HttpResponse

        user = request.user
        rate_key = f"lgpd_export:{user.id}"
        if cache.get(rate_key):
            return Response(
                {"detail": "Exportação limitada a 1 por dia."},
                status=429,
            )

        def serialize_qs(qs):
            result = []
            for obj in qs.values():
                row = {}
                for k, v in obj.items():
                    if hasattr(v, "isoformat"):
                        row[k] = v.isoformat()
                    else:
                        row[k] = str(v) if v is not None else None
                result.append(row)
            return result

        modules = {
            "expenses": Expense.objects.filter(
                created_by=user, is_deleted=False
            ),
            "revenues": Revenue.objects.filter(
                created_by=user, is_deleted=False
            ),
            "loans": Loan.objects.filter(created_by=user, is_deleted=False),
            "payables": Payable.objects.filter(
                created_by=user, is_deleted=False
            ),
            "accounts": Account.objects.filter(
                created_by=user, is_deleted=False
            ),
        }

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for name, qs in modules.items():
                data = serialize_qs(qs)
                zf.writestr(
                    f"{name}.json",
                    json.dumps(data, ensure_ascii=False, indent=2),
                )

        buf.seek(0)
        cache.set(rate_key, True, 60 * 60 * 24)

        filename = f"axiom_export_{datetime.now().strftime('%Y%m%d')}.zip"
        response = HttpResponse(buf.read(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class IRReportView(APIView):
    """Structured Income Tax report for a given year."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        year = request.query_params.get("year")
        if not year:
            from django.utils import timezone

            year = str(timezone.now().year)

        try:
            year_int = int(year)
        except ValueError:
            return Response(
                {"detail": "year must be a valid integer."}, status=400
            )

        user = request.user

        revenues_by_category = (
            Revenue.objects.filter(
                created_by=user,
                date__year=year_int,
                received=True,
                is_deleted=False,
            )
            .values("category")
            .annotate(total=Sum("value"))
        )

        deductible_categories = ["health", "education", "donation"]
        deductible = (
            Expense.objects.filter(
                created_by=user,
                date__year=year_int,
                payed=True,
                category__in=deductible_categories,
                is_deleted=False,
            )
            .values("category")
            .annotate(total=Sum("value"))
        )

        loans = Loan.objects.filter(
            created_by=user,
            date__year=year_int,
            is_deleted=False,
        ).values("description", "value", "payed_value", "status")

        return Response(
            {
                "year": year_int,
                "revenues": list(revenues_by_category),
                "deductible_expenses": list(deductible),
                "loans": list(loans),
            }
        )


class AlertsStreamView(APIView):
    """Server-Sent Events stream for financial alerts."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        import json
        import time

        from django.http import StreamingHttpResponse

        alerts_view = FinancialAlertsView()

        def event_stream():
            last_data = None
            for _ in range(20):  # max 20 iterations (~10 min)
                try:
                    response = alerts_view.get(request)
                    data = json.dumps(response.data)
                    if data != last_data:
                        last_data = data
                        yield f"data: {data}\n\n"
                    else:
                        yield ": ping\n\n"
                except Exception:
                    yield ": error\n\n"
                time.sleep(30)

        response = StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class AuditLogView(APIView):
    """Return audit log entries for a specific object."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from django.contrib.contenttypes.models import ContentType

        from app.audit import ChangeLog

        object_type = request.query_params.get("object_type")
        object_id = request.query_params.get("object_id")

        qs = ChangeLog.objects.filter(user=request.user)

        if object_type:
            ct = ContentType.objects.filter(model=object_type.lower()).first()
            if ct:
                qs = qs.filter(content_type=ct)

        if object_id:
            qs = qs.filter(object_id=object_id)

        qs = qs.select_related("user", "content_type")[:100]

        data = [
            {
                "id": entry.id,
                "action": entry.action,
                "object_type": (
                    entry.content_type.model if entry.content_type else None
                ),
                "object_id": entry.object_id,
                "changes": entry.changes,
                "timestamp": entry.timestamp.isoformat(),
                "ip_address": entry.ip_address,
            }
            for entry in qs
        ]
        return Response({"results": data, "count": len(data)})


class FinancialHealthScoreView(APIView):
    """
    GET /api/v1/dashboard/health-score/

    Retorna score de saúde financeira de 0-100 com breakdown por dimensão.

    Dimensões (25 pontos cada):
    - Liquidez:      total_saldo / (média_despesas_mensais_últimos_3m × 3)
                     — ideal ≥ 1×
    - Endividamento: 1 - (empréstimos_ativos / receita_anual)
                     — ideal: dívidas < receita
    - Poupança:      (receitas_recebidas - despesas_pagas)
                     / receitas_recebidas × 100
    - Adimplência:   1 - (compromissos_vencidos / total_compromissos)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        three_months_ago = today.replace(day=1) - timedelta(days=90)
        year_start = date(today.year, 1, 1)

        # --- Liquidez ---
        total_balance = Account.objects.filter(
            created_by=user, is_deleted=False
        ).aggregate(
            total=Coalesce(
                Sum("current_balance"),
                Value(Decimal("0")),
                output_field=DecimalField(),
            )
        )[
            "total"
        ]
        monthly_expenses_avg = Expense.objects.filter(
            created_by=user,
            payed=True,
            date__gte=three_months_ago,
            related_transfer__isnull=True,
            is_deleted=False,
        ).aggregate(
            total=Coalesce(
                Sum("value"), Value(Decimal("0")), output_field=DecimalField()
            )
        )[
            "total"
        ] / Decimal(
            "3"
        )
        if monthly_expenses_avg > 0:
            liquidity_ratio = float(total_balance / monthly_expenses_avg)
            # Score: 0 pts se < 0.5×; 25 pts se ≥ 3×
            liquidity_score = min(25.0, max(0.0, (liquidity_ratio / 3) * 25))
        else:
            liquidity_score = 25.0 if total_balance > 0 else 0.0
            liquidity_ratio = float("inf") if total_balance > 0 else 0.0

        # --- Endividamento ---
        annual_revenue = Revenue.objects.filter(
            created_by=user,
            received=True,
            date__gte=year_start,
            related_transfer__isnull=True,
            is_deleted=False,
        ).aggregate(
            total=Coalesce(
                Sum("value"), Value(Decimal("0")), output_field=DecimalField()
            )
        )[
            "total"
        ]
        active_loans_total = Loan.objects.filter(
            created_by=user,
            status__in=["active", "overdue"],
            is_deleted=False,
        ).aggregate(
            total=Coalesce(
                Sum(
                    F("value")
                    - Coalesce(
                        F("payed_value"),
                        Value(Decimal("0")),
                        output_field=DecimalField(),
                    )
                ),
                Value(Decimal("0")),
                output_field=DecimalField(),
            )
        )[
            "total"
        ]
        if annual_revenue > 0:
            debt_ratio = float(active_loans_total / annual_revenue)
            # Score: 25 pts se dívida = 0; 0 pts se dívida ≥ 100%
            # da receita anual
            debt_score = min(25.0, max(0.0, (1 - min(debt_ratio, 1)) * 25))
        else:
            debt_score = 25.0 if active_loans_total == 0 else 0.0
            debt_ratio = 0.0

        # --- Poupança (taxa de poupança no ano corrente) ---
        annual_expenses = Expense.objects.filter(
            created_by=user,
            payed=True,
            date__gte=year_start,
            related_transfer__isnull=True,
            is_deleted=False,
        ).aggregate(
            total=Coalesce(
                Sum("value"), Value(Decimal("0")), output_field=DecimalField()
            )
        )[
            "total"
        ]
        if annual_revenue > 0:
            savings_rate = float(
                (annual_revenue - annual_expenses) / annual_revenue
            )
            # Score: 25 pts se taxa ≥ 20%; 0 pts se negativa
            savings_score = min(25.0, max(0.0, (savings_rate / 0.20) * 25))
        else:
            savings_score = 0.0
            savings_rate = 0.0

        # --- Adimplência ---
        overdue_payables = Payable.objects.filter(
            member__user=user,
            status="overdue",
            is_deleted=False,
        ).count()
        overdue_loans = Loan.objects.filter(
            created_by=user,
            status="overdue",
            is_deleted=False,
        ).count()
        overdue_bills = CreditCardBill.objects.filter(
            credit_card__created_by=user,
            status="overdue",
        ).count()
        total_overdue = overdue_payables + overdue_loans + overdue_bills

        total_payables = Payable.objects.filter(
            member__user=user,
            is_deleted=False,
            status__in=["active", "overdue", "paid"],
        ).count()
        total_loans = Loan.objects.filter(
            created_by=user,
            is_deleted=False,
            status__in=["active", "overdue", "paid"],
        ).count()
        total_bills = CreditCardBill.objects.filter(
            credit_card__created_by=user,
            status__in=["open", "closed", "paid", "overdue"],
        ).count()
        total_commitments = total_payables + total_loans + total_bills

        if total_commitments > 0:
            on_time_rate = 1 - (total_overdue / total_commitments)
            compliance_score = min(25.0, max(0.0, on_time_rate * 25))
        else:
            compliance_score = 25.0
            on_time_rate = 1.0

        total_score = round(
            liquidity_score + debt_score + savings_score + compliance_score, 1
        )

        return Response(
            {
                "score": total_score,
                "grade": self._grade(total_score),
                "dimensions": {
                    "liquidity": {
                        "score": round(liquidity_score, 1),
                        "max": 25,
                        "ratio": (
                            round(liquidity_ratio, 2)
                            if liquidity_ratio != float("inf")
                            else None
                        ),
                        "label": "Liquidez",
                        "description": (
                            "Saldo disponível vs. despesas mensais médias"
                        ),
                    },
                    "debt": {
                        "score": round(debt_score, 1),
                        "max": 25,
                        "ratio": round(debt_ratio, 2),
                        "label": "Endividamento",
                        "description": "Dívidas ativas vs. receita anual",
                    },
                    "savings": {
                        "score": round(savings_score, 1),
                        "max": 25,
                        "rate": round(savings_rate * 100, 1),
                        "label": "Poupança",
                        "description": (
                            "Percentual da receita que sobra após despesas"
                        ),
                    },
                    "compliance": {
                        "score": round(compliance_score, 1),
                        "max": 25,
                        "overdue_count": total_overdue,
                        "total_commitments": total_commitments,
                        "on_time_rate": round(on_time_rate * 100, 1),
                        "label": "Adimplência",
                        "description": (
                            "Compromissos em dia vs. total de compromissos"
                        ),
                    },
                },
            }
        )

    @staticmethod
    def _grade(score: float) -> str:
        if score >= 90:
            return "A"
        if score >= 75:
            return "B"
        if score >= 60:
            return "C"
        if score >= 40:
            return "D"
        return "F"
