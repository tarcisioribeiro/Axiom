import logging
from decimal import Decimal
from typing import Any, cast

from django.contrib.auth.models import User
from django.db.models import QuerySet, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
from app.base_views import BaseRetrieveUpdateDestroyView
from budgets.models import Budget
from credit_cards.models import CreditCardBill, CreditCardInstallment
from expenses.models import Expense, FixedExpense
from monthly_planning.models import MonthlyPlan
from monthly_planning.serializers import MonthlyPlanSerializer
from revenues.models import FixedRevenue, Revenue

logger = logging.getLogger("axiom")


def _get_budget_suggestions(user: User, month: int, year: int) -> list:
    """Average of last 3 months × 1.10, no LLM."""
    from datetime import timedelta

    today = timezone.now().date().replace(day=1)
    three_months_ago = (today - timedelta(days=1)).replace(day=1)
    three_months_ago = (three_months_ago - timedelta(days=1)).replace(
        day=1
    ) - timedelta(days=60)
    three_months_ago = three_months_ago.replace(day=1)

    rows = (
        Expense.objects.filter(
            created_by=user,
            payed=True,
            date__gte=three_months_ago,
            related_transfer__isnull=True,
            is_deleted=False,
        )
        .values("category")
        .annotate(total_3m=Sum("value"))
    )

    suggestions = []
    for row in rows:
        monthly_avg = float(row["total_3m"]) / 3
        suggestions.append(
            {
                "category": row["category"],
                "avg_monthly_spent": round(monthly_avg, 2),
                "suggested_limit": round(monthly_avg * 1.10, 2),
            }
        )
    return suggestions


def _fixed_revenues_data(user: User) -> list:
    return [
        {
            "id": r.id,
            "description": r.description,
            "default_value": str(r.default_value),
            "category": r.category,
            "due_day": r.due_day,
            "account_name": r.account.account_name if r.account else "",
            "allow_value_edit": r.allow_value_edit,
        }
        for r in FixedRevenue.objects.filter(
            created_by=user, is_active=True, is_deleted=False
        ).select_related("account")
    ]


def _is_fixed_expense_already_posted(
    fe: FixedExpense, month: int, year: int, date_from: str, date_to: str
) -> bool:
    """
    Checks whether this FixedExpense template has already been posted for
    the given month, either as a credit card installment (bill.dispatch)
    or as a standalone checking-account Expense. Mirrors the lookup logic
    in expenses.services.bulk_generate_fixed_expenses so the summary never
    counts a template that has already turned into a real transaction.
    """
    if fe.credit_card:
        return CreditCardInstallment.objects.filter(
            purchase__description=fe.description,
            purchase__card=fe.credit_card,
            bill__year=str(year),
            bill__month=_MONTH_ABBREVS[month - 1],
            is_deleted=False,
            purchase__is_deleted=False,
        ).exists()

    return Expense.objects.filter(
        fixed_expense_template=fe,
        date__gte=date_from,
        date__lt=date_to,
        is_deleted=False,
    ).exists()


def _fixed_expenses_data(
    user: User, month: int, year: int, date_from: str, date_to: str
) -> list:
    return [
        {
            "id": e.id,
            "description": e.description,
            "default_value": str(e.default_value),
            "category": e.category,
            "due_day": e.due_day,
            "account_name": e.account.account_name if e.account else "",
            "credit_card_name": (e.credit_card.name if e.credit_card else ""),
            "payment_method": e.payment_method or "",
            "allow_value_edit": e.allow_value_edit,
            "already_posted": _is_fixed_expense_already_posted(
                e, month, year, date_from, date_to
            ),
        }
        for e in FixedExpense.objects.filter(
            created_by=user, is_active=True, is_deleted=False
        ).select_related("account", "credit_card")
    ]


def _opening_balance(user: User, date_from: str) -> Decimal:
    """
    Balance of the user's checking accounts at the start of date_from
    (day 1 of the target month), reconstructed the same way
    accounts.services.recalculate_account_balance() computes
    current_balance — sum of received revenues minus paid expenses — but
    restricted to entries dated before the target month, so it reflects
    the balance actually carried into that month rather than today's
    live balance.
    """
    total_revenues = Revenue.objects.filter(
        account__created_by=user,
        account__is_active=True,
        account__is_deleted=False,
        received=True,
        is_deleted=False,
        date__lt=date_from,
    ).aggregate(total=Sum("value"))["total"] or Decimal("0")

    total_expenses = Expense.objects.filter(
        account__created_by=user,
        account__is_active=True,
        account__is_deleted=False,
        payed=True,
        is_deleted=False,
        date__lt=date_from,
    ).aggregate(total=Sum("value"))["total"] or Decimal("0")

    return total_revenues - total_expenses


_MONTH_ABBREVS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


def _credit_card_bills_data(user: User, month: int, year: int) -> list:
    return [
        {
            "id": b.id,
            "credit_card_name": (b.credit_card.name if b.credit_card else ""),
            "total_amount": str(b.total_amount),
            "due_date": str(b.due_date) if b.due_date else None,
            "status": b.status,
            "paid_amount": str(b.paid_amount),
        }
        for b in CreditCardBill.objects.filter(
            credit_card__created_by=user,
            due_date__year=year,
            due_date__month=month,
            is_deleted=False,
        ).select_related("credit_card")
    ]


class MonthlyPlanSummaryView(APIView):
    """
    GET /api/v1/monthly-plan/summary/?month=7&year=2026

    Returns the monthly plan with aggregated data.
    Auto-creates the plan if it does not exist yet.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        now = timezone.now()
        try:
            month = int(request.query_params.get("month", now.month))
            year = int(request.query_params.get("year", now.year))
        except (TypeError, ValueError):
            return Response(
                {"error": "month and year must be integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan, _ = MonthlyPlan.objects.get_or_create(
            month=month,
            year=year,
            created_by=user,
            defaults={"updated_by": user},
        )

        existing_budgets = list(
            Budget.objects.filter(
                created_by=user,
                month=month,
                year=year,
                is_deleted=False,
            ).values("id", "category", "limit_amount", "rollover_enabled")
        )

        date_from = f"{year}-{month:02d}-01"
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        date_to = f"{next_year}-{next_month:02d}-01"

        opening_balance = _opening_balance(user, date_from)

        revenue_qs = Revenue.objects.filter(
            created_by=user,
            date__gte=date_from,
            date__lt=date_to,
            is_deleted=False,
            related_transfer__isnull=True,
        ).order_by("-date")
        actual_revenues = (
            revenue_qs.aggregate(total=Sum("value"))["total"] or Decimal("0")
        ) + opening_balance
        actual_revenue_items = [
            {
                "id": r.id,
                "description": r.description,
                "value": str(r.value),
                "category": r.category,
                "date": str(r.date),
            }
            for r in revenue_qs[:50]
        ]
        if opening_balance != Decimal("0"):
            actual_revenue_items.append(
                {
                    "id": 0,
                    "description": "Saldo em contas no início do mês",
                    "value": str(opening_balance),
                    "category": "deposit",
                    "date": date_from,
                }
            )

        expense_qs = Expense.objects.filter(
            created_by=user,
            date__gte=date_from,
            date__lt=date_to,
            is_deleted=False,
            related_transfer__isnull=True,
        ).order_by("-date")
        actual_expenses = expense_qs.aggregate(total=Sum("value"))[
            "total"
        ] or Decimal("0")
        actual_expense_items = [
            {
                "id": e.id,
                "description": e.description,
                "value": str(e.value),
                "category": e.category,
                "date": str(e.date),
                "payed": e.payed,
            }
            for e in expense_qs[:50]
        ]

        # Registered expenses that are not already represented elsewhere in
        # the plan's totals: bill-payment expenses are already inside
        # credit_card_bills' total_amount, and fixed-expense-linked expenses
        # are already inside the (always-counted) fixed_expenses total. Only
        # the remainder — ad-hoc expenses posted directly outside the
        # planner — should be added to the projected "Total Despesas".
        registered_expenses_net = expense_qs.filter(
            related_bill_payment__isnull=True,
            fixed_expense_template__isnull=True,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0")

        account_aggregates = Account.objects.filter(
            created_by=user,
            is_active=True,
            is_deleted=False,
        ).aggregate(
            total_balance=Sum("current_balance"),
            total_overdraft=Sum("overdraft_limit"),
        )
        total_balance = account_aggregates["total_balance"] or Decimal("0")
        total_overdraft = account_aggregates["total_overdraft"] or Decimal("0")

        expense_cat_qs = (
            Expense.objects.filter(
                created_by=user,
                date__gte=date_from,
                date__lt=date_to,
                is_deleted=False,
                related_transfer__isnull=True,
            )
            .values("category")
            .annotate(total=Sum("value"))
        )
        actual_expenses_by_category = {
            row["category"]: str(row["total"]) for row in expense_cat_qs
        }

        return Response(
            {
                "plan": MonthlyPlanSerializer(plan).data,
                "fixed_revenues": _fixed_revenues_data(user),
                "fixed_expenses": _fixed_expenses_data(
                    user, month, year, date_from, date_to
                ),
                "credit_card_bills": _credit_card_bills_data(
                    user, month, year
                ),
                "existing_budgets": existing_budgets,
                "budget_suggestions": _get_budget_suggestions(
                    user, month, year
                ),
                "actual": {
                    "revenues": str(actual_revenues),
                    "expenses": str(actual_expenses),
                },
                "actual_revenue_items": actual_revenue_items,
                "actual_expense_items": actual_expense_items,
                "total_account_balance": str(total_balance),
                "total_overdraft_limit": str(total_overdraft),
                "opening_balance": str(opening_balance),
                "registered_expenses_net": str(registered_expenses_net),
                "actual_expenses_by_category": actual_expenses_by_category,
            }
        )


class MonthlyPlanDetailView(BaseRetrieveUpdateDestroyView):
    """PATCH /api/v1/monthly-plan/<id>/ — save plan edits."""

    serializer_class = MonthlyPlanSerializer

    def get_queryset(self) -> QuerySet[MonthlyPlan]:
        return MonthlyPlan.objects.filter(
            created_by=self.request.user, is_deleted=False
        )

    def perform_update(self, serializer: Any) -> None:
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance: Any) -> None:
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


class MonthlyPlanApplyView(APIView):
    """
    POST /api/v1/monthly-plan/<pk>/apply/

    Generates fixed revenues/expenses and creates budgets.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, pk: int) -> Response:
        user = cast(User, request.user)
        try:
            plan = MonthlyPlan.objects.get(
                pk=pk, created_by=user, is_deleted=False
            )
        except MonthlyPlan.DoesNotExist:
            return Response(
                {"error": "Plan not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_reapply = bool(plan.applied_at)
        month_str = f"{plan.year}-{plan.month:02d}"
        results: dict = {}

        from revenues.services import bulk_generate_fixed_revenues

        fixed_revenues = list(
            FixedRevenue.objects.filter(
                created_by=user, is_active=True, is_deleted=False
            )
        )
        if fixed_revenues:
            revenue_values = [
                {"fixed_revenue_id": r.id, "value": float(r.default_value)}
                for r in fixed_revenues
            ]
            try:
                result = bulk_generate_fixed_revenues(
                    month=month_str,
                    revenue_values=revenue_values,
                    user=user,
                    upsert=is_reapply,
                )
                results["revenues_created"] = result.get("created_count", 0)
            except Exception:
                logger.exception(
                    "Failed to generate fixed revenues for plan %s", pk
                )
                results["revenues_created"] = 0

        from expenses.services import bulk_generate_fixed_expenses

        fixed_expenses = list(
            FixedExpense.objects.filter(
                created_by=user, is_active=True, is_deleted=False
            )
        )
        if fixed_expenses:
            expense_values = [
                {"fixed_expense_id": e.id, "value": float(e.default_value)}
                for e in fixed_expenses
            ]
            try:
                result = bulk_generate_fixed_expenses(
                    month=month_str,
                    expense_values=expense_values,
                    user=user,
                    upsert=is_reapply,
                )
                results["expenses_created"] = result.get("created_count", 0)
            except Exception:
                logger.exception(
                    "Failed to generate fixed expenses for plan %s", pk
                )
                results["expenses_created"] = 0

        budget_overrides = plan.budget_overrides or {}
        budgets_created = 0
        for category, amount in budget_overrides.items():
            try:
                _, created = Budget.objects.update_or_create(
                    category=category,
                    month=plan.month,
                    year=plan.year,
                    created_by=user,
                    is_deleted=False,
                    defaults={"limit_amount": amount, "updated_by": user},
                )
                if created:
                    budgets_created += 1
            except Exception:
                logger.exception(
                    "Failed to create budget for category %s", category
                )
        results["budgets_created"] = budgets_created

        plan.applied_at = timezone.now()
        plan.updated_by = user
        plan.save(update_fields=["applied_at", "updated_by", "updated_at"])

        return Response(
            {
                "status": "reapplied" if is_reapply else "applied",
                "results": results,
            },
            status=status.HTTP_200_OK,
        )
