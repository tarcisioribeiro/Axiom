"""
Dashboard Views

Endpoints otimizados para Dashboard que usam aggregations no banco de dados
em vez de buscar todos os registros e calcular no frontend.

PERF-02: Reduz de 6 requisições para 1 única requisição otimizada.
PERF-03: Cache Redis para reduzir carga no banco de dados.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
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
from loans.models import Loan, LoanInstallment
from members.models import Member
from payables.models import Payable, PayableInstallment
from receivables.models import Receivable
from revenues.models import FixedRevenue, Revenue
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
        get_cache_key("debt_payoff_plan:strategy:snowball:extra:0", user_id),
        get_cache_key("debt_payoff_plan:strategy:avalanche:extra:0", user_id),
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
        today = timezone.now().date()
        accounts_qs = Account.objects.filter(created_by=request.user)
        expenses_qs = Expense.objects.filter(
            created_by=request.user,
            related_transfer__isnull=True,
            payed=True,
            date__year=today.year,
            date__month=today.month,
        )
        revenues_qs = Revenue.objects.filter(
            created_by=request.user,
            related_transfer__isnull=True,
            received=True,
            date__year=today.year,
            date__month=today.month,
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
            related_transfer__isnull=True,
        )
        revenues_qs = Revenue.objects.filter(
            created_by=request.user,
            date__year=year,
            date__month=month,
            related_transfer__isnull=True,
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


def _add_ungenerated_fixed_expenses(
    user: Any, today: date, end_date: date, expenses_by_date: dict
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
        created_by=user,
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
            month_iter = month_iter.replace(year=month_iter.year + 1, month=1)
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


def _add_ungenerated_fixed_revenues(
    user: Any, today: date, end_date: date, revenues_by_date: dict
) -> None:
    """
    Adiciona receitas fixas nao geradas ao dicionario de receitas.

    Espelha `_add_ungenerated_fixed_expenses` para o lado de receitas:
    para cada template de receita fixa, verifica quais meses dentro da
    janela de projecao ainda nao possuem lancamento avulso gerado e
    adiciona uma entrada virtual.
    """
    fixed_revenues = FixedRevenue.objects.filter(
        is_active=True,
        account__isnull=False,
        created_by=user,
    ).select_related("account")

    if not fixed_revenues.exists():
        return

    existing = set(
        Revenue.objects.filter(
            fixed_revenue_template__isnull=False,
            date__gte=today,
            date__lte=end_date,
        ).values_list(
            "fixed_revenue_template_id",
            "date__year",
            "date__month",
        )
    )

    months_in_range = []
    month_iter = today.replace(day=1)
    end_month = end_date.replace(day=1)
    while month_iter <= end_month:
        months_in_range.append(month_iter)
        if month_iter.month == 12:
            month_iter = month_iter.replace(year=month_iter.year + 1, month=1)
        else:
            month_iter = month_iter.replace(month=month_iter.month + 1)

    for fr in fixed_revenues:
        for month_start in months_in_range:
            year = month_start.year
            month = month_start.month
            month_key = f"{year:04d}-{month:02d}"

            if (
                fr.last_generated_month
                and fr.last_generated_month >= month_key
            ):
                continue

            if (fr.pk, year, month) in existing:
                continue

            max_day = calendar.monthrange(year, month)[1]
            due_day = min(fr.due_day, max_day)
            due_date = month_start.replace(day=due_day)

            if today <= due_date <= end_date:
                prev = revenues_by_date.get(due_date, Decimal("0.00"))
                revenues_by_date[due_date] = prev + fr.default_value


def _add_credit_card_bills(
    user: Any, today: date, end_date: date, expenses_by_date: dict
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
        credit_card__created_by=user,
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
            credit_card__created_by=user,
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
        _add_ungenerated_fixed_expenses(
            self._user, today, end_date, expenses_by_date
        )

        # Faturas de cartão de crédito não pagas com vencimento no periodo
        _add_credit_card_bills(self._user, today, end_date, expenses_by_date)

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


class DebtPayoffPlanView(APIView):
    """
    GET /api/v1/dashboard/debt-payoff-plan/

    Retorna um plano de quitação de dívidas (empréstimos tomados e
    valores a pagar) baseado na sobra de caixa REAL projetada mês a
    mês, em vez de um valor de "extra mensal" digitado manualmente.

    Sobra provável de cada mês = saldo atual das contas
        + receitas fixas que vencem naquele mês
        + valores a receber (Receivable) com vencimento naquele mês
        - despesas fixas que vencem naquele mês
        - faturas de cartão de crédito que vencem naquele mês (valor
          integral - faturas NÃO entram na lista de dívidas do
          planejador, pois presume-se que são sempre pagas por
          completo, nunca "roladas")

    Essa sobra mensal alimenta a mesma mecânica de simulação
    snowball/avalanche do planejador: ordena as dívidas (por saldo ou
    por taxa de juros), aplica o pagamento mínimo em todas e destina a
    sobra daquele mês para acelerar a quitação da dívida prioritária,
    realocando o mínimo liberado quando uma dívida é quitada. Se a
    data de vencimento de uma dívida não for alcançável com a sobra
    projetada, a data de quitação é recalculada (empurrada para uma
    data viável) e sinalizada na resposta via `date_recalculated`.

    Query Parameters
    ----------------
    strategy : str
        "snowball" (default) ou "avalanche" - define apenas a ordem
        usada nos campos `priority`/`urgency` retornados; a resposta
        sempre inclui os dois planos completos (`snowball`/
        `avalanche`) para permitir alternar sem nova requisição.
    extra_monthly : decimal
        Valor extra opcional somado à sobra real de cada mês (ex: um
        bônus esperado). Default 0.
    """

    permission_classes = [IsAuthenticated]

    VALID_STRATEGIES = {"snowball", "avalanche"}
    URGENCY_TIERS = ["low", "medium", "high", "critical", "overdue"]
    URGENCY_ORDER = {tier: idx for idx, tier in enumerate(URGENCY_TIERS)}
    # Meses de folga alem do vencimento mais distante, para dar espaco
    # a simulacao encontrar uma data de quitacao viavel quando a
    # original nao for alcancavel.
    HORIZON_BUFFER_MONTHS = 24
    MAX_HORIZON_MONTHS = 120  # teto de seguranca (10 anos)
    DEFAULT_HORIZON_MONTHS = 24

    def get(self, request) -> Response:
        user = request.user
        strategy_param = request.query_params.get("strategy", "snowball")
        strategy = (
            strategy_param
            if strategy_param in self.VALID_STRATEGIES
            else "snowball"
        )

        try:
            extra_monthly = Decimal(
                str(request.query_params.get("extra_monthly", "0"))
            ).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError, TypeError):
            extra_monthly = Decimal("0.00")

        cache_key = get_cache_key(
            f"debt_payoff_plan:strategy:{strategy}:extra:{extra_monthly}",
            user.id,
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        today = date.today()
        member = Member.objects.filter(user=user).first()
        debts = self._collect_debts(user, member)

        current_balance = Account.objects.filter(
            created_by=user, is_active=True
        ).aggregate(total=Sum("current_balance"))["total"] or Decimal("0.00")

        cache_ttl = getattr(settings, "CACHE_TTL_DEBT_PAYOFF_PLAN", 300)

        if not debts:
            result: dict[str, Any] = {
                "current_total_balance": float(current_balance),
                "extra_monthly": float(extra_monthly),
                "surplus_at_due_dates": float(current_balance),
                "surplus_at_due_dates_month": None,
                "surplus_projection": [],
                "snowball": {
                    "debts": [],
                    "total_interest": 0.0,
                    "last_payoff_date": None,
                },
                "avalanche": {
                    "debts": [],
                    "total_interest": 0.0,
                    "last_payoff_date": None,
                },
            }
            cache.set(cache_key, result, cache_ttl)
            return Response(result)

        months_to_furthest_due = self._months_to_furthest_due_date(
            today, debts
        )
        horizon_months = min(
            months_to_furthest_due + self.HORIZON_BUFFER_MONTHS,
            self.MAX_HORIZON_MONTHS,
        )
        horizon_end = self._add_months(today, horizon_months)

        surplus_by_month = self._project_monthly_surplus(
            user, today, horizon_end, current_balance, extra_monthly, debts
        )

        snowball_plan = self._simulate_payoff(
            debts, surplus_by_month, "snowball", current_balance
        )
        avalanche_plan = self._simulate_payoff(
            debts, surplus_by_month, "avalanche", current_balance
        )

        self._apply_urgency(snowball_plan, today)
        self._apply_urgency(avalanche_plan, today)

        # Sobra na data de vencimento mais distante ENTRE AS DÍVIDAS
        # ATUAIS (sem o buffer de recalculo) - esse é o número que
        # representa de fato "quanto sobra até o vencimento da
        # quitação", em vez do total acumulado até o fim do horizonte
        # de simulação (que inclui meses extras só para achar uma data
        # viável, e por isso soma renda demais para ser uma sobra
        # realista de se mostrar como destaque).
        due_date_index = min(months_to_furthest_due, len(surplus_by_month) - 1)
        surplus_at_due_dates = surplus_by_month[due_date_index]

        result = {
            "current_total_balance": float(current_balance),
            "extra_monthly": float(extra_monthly),
            "surplus_at_due_dates": float(
                surplus_at_due_dates["cumulative_surplus"]
            ),
            "surplus_at_due_dates_month": {
                "year": surplus_at_due_dates["year"],
                "month": surplus_at_due_dates["month"],
            },
            "surplus_projection": [
                self._serialize_surplus_month(m) for m in surplus_by_month
            ],
            "snowball": self._serialize_plan(snowball_plan),
            "avalanche": self._serialize_plan(avalanche_plan),
        }

        cache.set(cache_key, result, cache_ttl)
        return Response(result)

    def _collect_debts(self, user: Any, member: Any) -> list:
        """
        Coleta as dívidas planejáveis do usuário: empréstimos tomados
        (não pagos) e valores a pagar ativos/em atraso. Faturas de
        cartão de crédito NÃO entram aqui - ver docstring da classe.
        """
        debts: list = []

        loans_qs = Loan.objects.filter(
            payed=False,
            status__in=["active", "overdue"],
        )
        loans_qs = (
            loans_qs.filter(benefited=member) if member else loans_qs.none()
        )

        for loan in loans_qs:
            # `loan_type` pode nao estar gravado na coluna (dados
            # legados ou inferencia dinamica) - usar o fallback do
            # model, o mesmo aplicado em LoanSerializer, em vez do
            # valor cru do banco.
            if loan.effective_loan_type != "borrowed":
                continue
            balance = (loan.value or Decimal("0.00")) - (
                loan.payed_value or Decimal("0.00")
            )
            if balance <= 0:
                continue
            installments = max(loan.installments or 1, 1)
            installments_paid = LoanInstallment.objects.filter(
                loan=loan, payed=True
            ).count()
            debts.append(
                {
                    "id": f"loan-{loan.id}",
                    "raw_id": loan.id,
                    "type": "loan",
                    "name": loan.description,
                    "balance": balance,
                    "interest_rate": loan.interest_rate or Decimal("0.00"),
                    "minimum_payment": (balance / installments).quantize(
                        Decimal("0.01")
                    ),
                    "due_date": loan.due_date,
                    "date": loan.date,
                    "installments_total": installments,
                    "installments_paid": installments_paid,
                    "payment_plan_exists": installments > 1,
                }
            )

        payables_qs = Payable.objects.filter(
            created_by=user,
            status__in=["active", "overdue"],
        )
        for payable in payables_qs:
            remaining = payable.remaining_value or Decimal("0.00")
            if remaining <= 0:
                continue
            installments = max(payable.installments or 1, 1)
            installments_paid = PayableInstallment.objects.filter(
                payable=payable, payed=True
            ).count()
            debts.append(
                {
                    "id": f"payable-{payable.id}",
                    "raw_id": payable.id,
                    "type": "payable",
                    "name": payable.description,
                    "balance": remaining,
                    "interest_rate": Decimal("0.00"),
                    "minimum_payment": remaining,
                    "due_date": payable.due_date,
                    "date": payable.date,
                    "installments_total": installments,
                    "installments_paid": installments_paid,
                    "payment_plan_exists": installments > 1,
                }
            )

        return debts

    def _months_to_furthest_due_date(self, today: date, debts: list) -> int:
        """
        Meses entre hoje e o vencimento mais distante entre as dívidas
        coletadas - SEM o buffer de recalculo. Representa a janela que
        o usuário realmente pediu ("sobra até o vencimento da
        quitação da dívida"), diferente do horizonte de simulação
        (que precisa de folga extra para achar uma data viável quando
        a original não é alcançável).
        """
        due_dates = [d["due_date"] for d in debts if d["due_date"]]
        if not due_dates:
            return self.DEFAULT_HORIZON_MONTHS
        furthest = max(due_dates)
        return max(
            (furthest.year - today.year) * 12 + (furthest.month - today.month),
            0,
        )

    def _determine_horizon_months(self, today: date, debts: list) -> int:
        months_to_furthest = self._months_to_furthest_due_date(today, debts)
        return min(
            months_to_furthest + self.HORIZON_BUFFER_MONTHS,
            self.MAX_HORIZON_MONTHS,
        )

    @staticmethod
    def _add_months(d: date, months: int) -> date:
        total_month = d.month - 1 + months
        year = d.year + total_month // 12
        month = total_month % 12 + 1
        max_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(d.day, max_day))

    @staticmethod
    def _month_range(today: date, end_date: date) -> list:
        months = []
        month_iter = today.replace(day=1)
        end_month = end_date.replace(day=1)
        while month_iter <= end_month:
            months.append((month_iter.year, month_iter.month))
            if month_iter.month == 12:
                month_iter = month_iter.replace(
                    year=month_iter.year + 1, month=1
                )
            else:
                month_iter = month_iter.replace(month=month_iter.month + 1)
        return months

    @staticmethod
    def _sum_in_month(day_dict: dict, year: int, month: int) -> Decimal:
        total = Decimal("0.00")
        for d, value in day_dict.items():
            if d.year == year and d.month == month:
                total += value
        return total

    def _project_monthly_surplus(
        self,
        user: Any,
        today: date,
        horizon_end: date,
        current_balance: Decimal,
        extra_monthly: Decimal,
        debts: list,
    ) -> list:
        loan_ids = [d["raw_id"] for d in debts if d["type"] == "loan"]
        payable_ids = [d["raw_id"] for d in debts if d["type"] == "payable"]

        # Despesas fixas: lancamentos ja existentes (nao pagos), exceto
        # os que ja pertencem a uma das dividas planejadas - o principal
        # dessas dividas ja e amortizado dentro da propria simulacao,
        # contabiliza-lo aqui de novo dobraria a subtracao.
        fixed_expenses_by_date: dict = {}
        scheduled_expenses = (
            Expense.objects.filter(
                created_by=user,
                payed=False,
                related_transfer__isnull=True,
                date__gte=today,
                date__lte=horizon_end,
            )
            .exclude(related_loan_id__in=loan_ids)
            .exclude(related_payable_id__in=payable_ids)
            .values("date")
            .annotate(total=Sum("value"))
        )
        for item in scheduled_expenses:
            fixed_expenses_by_date[item["date"]] = item["total"]
        _add_ungenerated_fixed_expenses(
            user, today, horizon_end, fixed_expenses_by_date
        )

        # Faturas de cartao: sempre pagas integralmente, nunca fazem
        # parte da lista de dividas do planejador.
        card_bills_by_date: dict = {}
        _add_credit_card_bills(user, today, horizon_end, card_bills_by_date)

        # Receitas ja lancadas + fixas ainda nao geradas
        revenues_by_date: dict = {}
        scheduled_revenues = (
            Revenue.objects.filter(
                created_by=user,
                received=False,
                related_transfer__isnull=True,
                date__gte=today,
                date__lte=horizon_end,
            )
            .values("date")
            .annotate(total=Sum("value"))
        )
        for item in scheduled_revenues:
            revenues_by_date[item["date"]] = item["total"]
        _add_ungenerated_fixed_revenues(
            user, today, horizon_end, revenues_by_date
        )

        # Valores a receber
        receivables_by_date: dict = {}
        receivables = Receivable.objects.filter(
            created_by=user,
            status__in=["active", "overdue"],
            due_date__isnull=False,
            due_date__gte=today,
            due_date__lte=horizon_end,
        )
        for receivable in receivables:
            remaining = (receivable.value or Decimal("0.00")) - (
                receivable.received_value or Decimal("0.00")
            )
            if remaining > 0:
                prev = receivables_by_date.get(
                    receivable.due_date, Decimal("0.00")
                )
                receivables_by_date[receivable.due_date] = prev + remaining

        months = self._month_range(today, horizon_end)
        surplus_by_month = []
        cumulative = current_balance
        for year, month in months:
            month_revenues = self._sum_in_month(revenues_by_date, year, month)
            month_receivables = self._sum_in_month(
                receivables_by_date, year, month
            )
            month_fixed_expenses = self._sum_in_month(
                fixed_expenses_by_date, year, month
            )
            month_card_bills = self._sum_in_month(
                card_bills_by_date, year, month
            )
            delta = (
                month_revenues
                + month_receivables
                - month_fixed_expenses
                - month_card_bills
                + extra_monthly
            )
            cumulative += delta
            surplus_by_month.append(
                {
                    "year": year,
                    "month": month,
                    "revenues": month_revenues,
                    "receivables": month_receivables,
                    "fixed_expenses": month_fixed_expenses,
                    "credit_card_bills": month_card_bills,
                    "surplus_delta": delta,
                    "cumulative_surplus": cumulative,
                }
            )

        return surplus_by_month

    def _simulate_payoff(
        self,
        debts: list,
        surplus_by_month: list,
        strategy: str,
        current_balance: Decimal,
    ) -> list:
        """
        Simulacao snowball/avalanche mes a mes.

        Mantem uma posicao de caixa cumulativa (`cash_position`,
        comecando do saldo atual das contas) que cresce/diminui com a
        sobra projetada de cada mes. Todo pagamento de divida - tanto
        o minimo quanto o extra que acelera a divida prioritaria - sai
        dessa MESMA posicao de caixa, na ordem de prioridade da
        estrategia; nada e pago com dinheiro que a projecao nao indica
        existir (`available` nunca ultrapassa `cash_position`, que por
        sua vez nunca fica negativo por causa de pagamento de divida -
        se nao ha caixa suficiente para pagar nem o minimo de uma
        divida em um dado mes, ela simplesmente nao recebe pagamento
        naquele mes e os juros continuam acumulando).
        """
        if strategy == "snowball":
            sorted_debts = sorted(debts, key=self._snowball_sort_key)
        else:
            sorted_debts = sorted(debts, key=self._avalanche_sort_key)

        state = [
            {
                "debt": debt,
                "remaining": debt["balance"],
                "total_paid": Decimal("0.00"),
                "total_interest": Decimal("0.00"),
                "payoff_date": None,
                "priority": 0,
                "monthly_payment": None,
            }
            for debt in sorted_debts
        ]

        cash_position = current_balance
        payoff_order = 0

        for month_index, month_data in enumerate(surplus_by_month):
            if all(s["remaining"] <= 0 for s in state):
                break

            cash_position += month_data["surplus_delta"]
            available = max(cash_position, Decimal("0.00"))
            spent_this_month = Decimal("0.00")
            payments_this_month: dict = {}

            # Juros do mes em todas as dividas ainda ativas
            for s in state:
                if s["remaining"] <= 0:
                    continue
                monthly_rate = (
                    s["debt"]["interest_rate"] / Decimal("100")
                ) / 12
                interest = s["remaining"] * monthly_rate
                s["total_interest"] += interest
                s["remaining"] += interest

            # 1) pagamento minimo em todas as dividas ativas, na ordem
            # de prioridade da estrategia - se o caixa nao alcancar
            # todos os minimos, as dividas de menor prioridade ficam
            # sem pagamento naquele mes.
            for s in state:
                if s["remaining"] <= 0 or available <= 0:
                    continue
                payment = min(
                    s["debt"]["minimum_payment"], s["remaining"], available
                )
                if payment <= 0:
                    continue
                s["remaining"] -= payment
                s["total_paid"] += payment
                available -= payment
                spent_this_month += payment
                payments_this_month[s["debt"]["id"]] = (
                    payments_this_month.get(s["debt"]["id"], Decimal("0.00"))
                    + payment
                )

            # 2) caixa restante acelera a divida prioritaria (primeira
            # ainda ativa, na ordem da estrategia)
            if available > 0:
                top = next((s for s in state if s["remaining"] > 0), None)
                if top is not None:
                    extra_payment = min(available, top["remaining"])
                    top["remaining"] -= extra_payment
                    top["total_paid"] += extra_payment
                    available -= extra_payment
                    spent_this_month += extra_payment
                    payments_this_month[top["debt"]["id"]] = (
                        payments_this_month.get(
                            top["debt"]["id"], Decimal("0.00")
                        )
                        + extra_payment
                    )

            cash_position -= spent_this_month

            # O valor de parcela mensal exibido reflete o que e de
            # fato pago no primeiro mes do plano - unico jeito de
            # refletir tanto a estrategia (quem recebe o extra
            # primeiro) quanto o valor extra informado pelo usuario.
            if month_index == 0:
                for s in state:
                    s["monthly_payment"] = payments_this_month.get(
                        s["debt"]["id"], Decimal("0.00")
                    )

            for s in state:
                if (
                    s["remaining"] <= Decimal("0.01")
                    and s["payoff_date"] is None
                ):
                    s["remaining"] = Decimal("0.00")
                    year = month_data["year"]
                    month = month_data["month"]
                    last_day = calendar.monthrange(year, month)[1]
                    s["payoff_date"] = date(year, month, last_day)
                    payoff_order += 1
                    s["priority"] = payoff_order

        result = []
        for idx, s in enumerate(state):
            debt = s["debt"]
            result.append(
                {
                    **debt,
                    "payoff_date": s["payoff_date"],
                    "total_paid": s["total_paid"],
                    "total_interest": s["total_interest"],
                    "monthly_payment": (
                        s["monthly_payment"]
                        if s["monthly_payment"] is not None
                        else debt["minimum_payment"]
                    ),
                    "priority": s["priority"] or (idx + 1),
                }
            )
        return result

    @staticmethod
    def _snowball_sort_key(debt: dict):
        """
        Bola de Neve: menor saldo devedor primeiro. Empate: dividas
        com juros primeiro (quitar antes reduz mais o total pago),
        depois o registro mais antigo primeiro.
        """
        has_interest = debt["interest_rate"] > 0
        return (debt["balance"], 0 if has_interest else 1, debt["date"])

    @staticmethod
    def _avalanche_sort_key(debt: dict):
        """
        Avalanche: maior saldo devedor primeiro. Empate: dividas com
        juros primeiro, depois o registro mais antigo primeiro.
        """
        has_interest = debt["interest_rate"] > 0
        return (-debt["balance"], 0 if has_interest else 1, debt["date"])

    @staticmethod
    def _elevate_urgency(tier: str, tiers: list) -> str:
        idx = tiers.index(tier)
        return tiers[min(idx + 1, len(tiers) - 1)]

    def _apply_urgency(self, plan: list, today: date) -> None:
        for entry in plan:
            due_date = entry["due_date"]
            if due_date is None:
                tier = "low"
            else:
                days_left = (due_date - today).days
                if days_left < 0:
                    tier = "overdue"
                elif days_left <= 7:
                    tier = "critical"
                elif days_left <= 30:
                    tier = "high"
                elif days_left <= 90:
                    tier = "medium"
                else:
                    tier = "low"

            # A divida so e recalculada se a quitacao efetivamente cair
            # em um MES posterior ao vencimento - comparar por dia exato
            # geraria falsos positivos, ja que `payoff_date` e sempre o
            # ultimo dia do mes em que o caixa acumulado deu conta da
            # divida (granularidade mensal da simulacao), mesmo quando
            # o dinheiro esteve disponivel desde o inicio daquele mes.
            payoff_date = entry["payoff_date"]
            date_recalculated = bool(
                due_date
                and payoff_date
                and (payoff_date.year, payoff_date.month)
                > (due_date.year, due_date.month)
            )
            if date_recalculated:
                tier = self._elevate_urgency(tier, self.URGENCY_TIERS)

            entry["urgency"] = tier
            entry["date_recalculated"] = date_recalculated
            entry["original_target_date"] = due_date
            entry["feasible_date"] = payoff_date if date_recalculated else None

        plan.sort(
            key=lambda e: (
                self.URGENCY_ORDER.get(e["urgency"], len(self.URGENCY_TIERS)),
                e["priority"],
            )
        )

    def _serialize_plan(self, plan: list) -> dict:
        total_interest = sum(
            (entry["total_interest"] for entry in plan), Decimal("0.00")
        )
        payoff_dates = [e["payoff_date"] for e in plan if e["payoff_date"]]
        last_payoff_date = max(payoff_dates) if payoff_dates else None

        return {
            "debts": [self._serialize_debt(entry) for entry in plan],
            "total_interest": float(total_interest),
            "last_payoff_date": (
                last_payoff_date.isoformat() if last_payoff_date else None
            ),
        }

    @staticmethod
    def _serialize_debt(entry: dict) -> dict:
        return {
            "id": entry["id"],
            "type": entry["type"],
            "name": entry["name"],
            "balance": float(entry["balance"]),
            "interest_rate": float(entry["interest_rate"]),
            "minimum_payment": float(entry["minimum_payment"]),
            "due_date": (
                entry["due_date"].isoformat() if entry["due_date"] else None
            ),
            "payoff_date": (
                entry["payoff_date"].isoformat()
                if entry["payoff_date"]
                else None
            ),
            "total_paid": float(entry["total_paid"]),
            "total_interest": float(entry["total_interest"]),
            "monthly_payment": float(entry["monthly_payment"]),
            "priority": entry["priority"],
            "urgency": entry["urgency"],
            "date_recalculated": entry["date_recalculated"],
            "original_target_date": (
                entry["original_target_date"].isoformat()
                if entry["original_target_date"]
                else None
            ),
            "feasible_date": (
                entry["feasible_date"].isoformat()
                if entry["feasible_date"]
                else None
            ),
            "installments_total": entry["installments_total"],
            "installments_paid": entry["installments_paid"],
            "payment_plan_exists": entry["payment_plan_exists"],
        }

    @staticmethod
    def _serialize_surplus_month(month_data: dict) -> dict:
        return {
            "year": month_data["year"],
            "month": month_data["month"],
            "revenues": float(month_data["revenues"]),
            "receivables": float(month_data["receivables"]),
            "fixed_expenses": float(month_data["fixed_expenses"]),
            "credit_card_bills": float(month_data["credit_card_bills"]),
            "surplus_delta": float(month_data["surplus_delta"]),
            "cumulative_surplus": float(month_data["cumulative_surplus"]),
        }


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


def _anomaly_severity(z_score: float) -> str:
    if z_score >= 3.0:
        return "critical"
    if z_score >= 2.0:
        return "warning"
    return "info"


def _enrich_anomaly_with_llm(
    category: str,
    current_amount: float,
    avg: float,
    z_score: float,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Returns (explanation, suggested_action, suggested_action_type)."""
    try:
        import json as _json

        from agents.core.llm_client import LLMClient

        prompt = (
            f"Gasto em '{category}' este mês: R$ {current_amount:.2f} "
            f"(média histórica: R$ {avg:.2f}, {z_score:.1f}σ acima).\n"
            "Em 1 frase curta: (1) explique por que isso pode ter acontecido. "
            "Em outra frase: (2) sugira uma ação concreta.\n"
            "Responda SOMENTE com JSON: "
            '{"explanation": "...", "action": "...", '
            '"action_type": "create_budget|create_alert|view_expenses"}'
        )
        resp = LLMClient.chat([{"role": "user", "content": prompt}])
        start, end = resp.find("{"), resp.rfind("}") + 1
        if start != -1 and end > start:
            data = _json.loads(resp[start:end])
            return (
                data.get("explanation"),
                data.get("action"),
                data.get("action_type", "view_expenses"),
            )
    except Exception:
        pass
    return None, None, "view_expenses"


class AnomalyDetectionView(APIView):
    """Detects spending anomalies using statistical z-score per category."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from math import sqrt

        user = request.user
        today = timezone.now().date()
        current_month = today.month
        current_year = today.year
        enrich = (
            request.query_params.get("enrich_llm", "false").lower() == "true"
        )

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
                severity = _anomaly_severity(z_score)
                explanation: Optional[str] = None
                suggested_action: Optional[str] = None
                suggested_action_type: Optional[str] = "view_expenses"
                if enrich:
                    explanation, suggested_action, suggested_action_type = (
                        _enrich_anomaly_with_llm(
                            category, current_amount, avg, z_score
                        )
                    )
                anomalies.append(
                    {
                        "category": category,
                        "current_amount": current_amount,
                        "average": round(avg, 2),
                        "std_dev": round(std, 2),
                        "z_score": round(z_score, 2),
                        "severity": severity,
                        "message": (
                            f"Gasto em '{category}' está"
                            f" {round(z_score, 1)}σ acima da média."
                        ),
                        "explanation": explanation,
                        "suggested_action": suggested_action,
                        "suggested_action_type": suggested_action_type,
                    }
                )

        return Response({"anomalies": anomalies})


class SpendingInsightsView(APIView):
    """
    GET /api/v1/dashboard/spending-insights/

    Analisa padrões de gastos dos últimos 6 meses e retorna insights
    estruturados sobre tendências, categorias problemáticas e oportunidades
    de economia.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        months_data = []
        for offset in range(6):
            d = today.replace(day=1)
            total_months = d.month - offset
            if total_months <= 0:
                year = d.year - 1
                month = 12 + total_months
            else:
                year = d.year
                month = total_months

            month_expenses = (
                Expense.objects.filter(
                    created_by=user,
                    date__month=month,
                    date__year=year,
                    payed=True,
                    is_deleted=False,
                    related_transfer__isnull=True,
                )
                .values("category")
                .annotate(total=Sum("value"))
            )
            months_data.append(
                {
                    "month": month,
                    "year": year,
                    "period": f"{year:04d}-{month:02d}",
                    "categories": {
                        row["category"]: float(row["total"])
                        for row in month_expenses
                    },
                }
            )

        # Calculate total per month
        for m in months_data:
            m["total"] = sum(m["categories"].values())

        # Trend: compare last month vs average of prior 5
        current = months_data[0]
        prior = months_data[1:]
        prior_avg = sum(m["total"] for m in prior) / len(prior) if prior else 0
        trend_pct = (
            ((current["total"] - prior_avg) / prior_avg * 100)
            if prior_avg > 0
            else 0
        )

        # Top categories this month
        top_categories = sorted(
            current["categories"].items(), key=lambda x: x[1], reverse=True
        )[:5]

        # Categories growing fastest (current vs prior avg)
        all_cats = set()
        for m in months_data:
            all_cats.update(m["categories"].keys())

        growing = []
        for cat in all_cats:
            curr_val = current["categories"].get(cat, 0)
            prior_vals = [m["categories"].get(cat, 0) for m in prior]
            p_avg = sum(prior_vals) / len(prior_vals) if prior_vals else 0
            if p_avg > 0 and curr_val > p_avg * 1.1:
                growth = (curr_val - p_avg) / p_avg * 100
                growing.append(
                    {
                        "category": cat,
                        "current": round(curr_val, 2),
                        "prior_avg": round(p_avg, 2),
                        "pct_change": round(growth, 1),
                    }
                )
        growing.sort(key=lambda x: x["pct_change"], reverse=True)

        return Response(
            {
                "period": {
                    "month": current["month"],
                    "year": current["year"],
                },
                "current_month": {
                    "total_expenses": round(current["total"], 2),
                    "month": current["month"],
                    "year": current["year"],
                },
                "trend": {
                    "direction": (
                        "up"
                        if trend_pct > 5
                        else "down" if trend_pct < -5 else "stable"
                    ),
                    "pct_change": round(trend_pct, 1),
                    "prior_avg": round(prior_avg, 2),
                },
                "top_categories": [
                    {"category": cat, "total": round(val, 2)}
                    for cat, val in top_categories
                ],
                "growing_categories": growing[:5],
                "monthly_breakdown": [
                    {
                        "month": m["period"],
                        "total": round(m["total"], 2),
                        "categories": {
                            k: round(v, 2) for k, v in m["categories"].items()
                        },
                    }
                    for m in months_data
                ],
            }
        )


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
                statement_import__account=account, is_deleted=False
            )
            unmatched = entries.exclude(status="matched").count()
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


class DashboardSummaryView(APIView):
    """
    GET /api/v1/dashboard/summary/

    Agrega stats + saldos de contas + alertas financeiros + status de
    orçamentos do mês atual em uma única requisição, reduzindo round-trips
    do frontend.

    Response:
    {
        "stats": { ...DashboardStatsView response... },
        "account_balances": [ ...AccountBalancesView response... ],
        "financial_alerts": [ ...FinancialAlertsView response... ],
        "budget_status": [ ...BudgetStatusView response (mês atual)... ]
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from budgets.views import BudgetStatusView

        cache_key = get_cache_key("dashboard_summary", request.user.id)
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        stats_view = DashboardStatsView()
        balances_view = AccountBalancesView()
        alerts_view = FinancialAlertsView()
        budget_view = BudgetStatusView()

        stats_resp = stats_view.get(request)
        balances_resp = balances_view.get(request)
        alerts_resp = alerts_view.get(request)
        budget_resp = budget_view.get(request)

        result = {
            "stats": stats_resp.data,
            "account_balances": balances_resp.data,
            "financial_alerts": alerts_resp.data,
            "budget_status": budget_resp.data,
        }

        cache_ttl = getattr(settings, "CACHE_TTL_ACCOUNT_BALANCES", 30)
        cache.set(cache_key, result, cache_ttl)

        return Response(result)
