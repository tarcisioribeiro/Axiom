"""
Management command: send_due_notifications

Iterates over all active members, generates their pending notifications
(same logic as the API list view), and dispatches any new ones to the
configured channel (in_app / email / both) based on the member's
NotificationPreference settings.

Also generates proactive agent_insight notifications by running the
InsightAgent's budget-detection logic for each member without requiring
user interaction. One insight is created per budget per month; the
unique_together constraint prevents duplicates across runs.

Recommended cron schedules (BRT):
    # Standard due/overdue alerts — daily at 08:00
    0 8 * * * docker compose exec api python manage.py send_due_notifications
    # Agent insights — daily at 07:00 (before the main run)
    0 7 * * * docker compose exec api python manage.py send_due_notifications
"""

import calendar
import logging
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from members.models import Member
from notifications.models import Notification
from notifications.services import dispatch_notification

logger = logging.getLogger("axiom")


def _get_or_create_notification(
    member, notification_type, content_type, object_id, defaults
):
    """Wrapper that returns (notification, created)
    and only dispatches when created."""
    notification, created = Notification.objects.get_or_create(
        owner=member,
        notification_type=notification_type,
        content_type=content_type,
        object_id=object_id,
        defaults={**defaults, "created_by": member.user},
    )
    return notification, created


class Command(BaseCommand):
    help = (
        "Generate and dispatch due/overdue notifications"
        " for all active members. "
        "Only newly-created notifications are dispatched"
        " via email to avoid duplicates."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "Print what would be dispatched"
                " without sending emails or saving."
            ),
        )
        parser.add_argument(
            "--member-id",
            type=int,
            help="Restrict dispatch to a single member ID (for debugging).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        member_id = options.get("member_id")

        today = timezone.now().date()
        soon = today + timedelta(days=3)

        members_qs = Member.objects.filter(is_deleted=False).select_related(
            "user"
        )
        if member_id:
            members_qs = members_qs.filter(pk=member_id)

        total_dispatched = 0

        for member in members_qs:
            dispatched = self._process_member(member, today, soon, dry_run)
            total_dispatched += dispatched

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] Would have dispatched"
                    f" {total_dispatched} notifications."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dispatched {total_dispatched} notifications."
                )
            )

    def _process_member(self, member, today, soon, dry_run: bool) -> int:
        dispatched = 0

        # --- TaskInstance ---
        from personal_planning.models import TaskInstance

        task_pairs = [
            (
                TaskInstance.objects.filter(
                    owner=member,
                    scheduled_date=today,
                    status__in=["pending", "in_progress"],
                ),
                "task_today",
                lambda t: {
                    "title": f"Tarefa do dia: {t.task_name}",
                    "message": t.task_description or "",
                    "due_date": t.scheduled_date,
                },
            ),
            (
                TaskInstance.objects.filter(
                    owner=member,
                    scheduled_date__lt=today,
                    status__in=["pending", "in_progress"],
                ),
                "task_overdue",
                lambda t: {
                    "title": f"Tarefa atrasada: {t.task_name}",
                    "message": (
                        f"Programada para"
                        f' {t.scheduled_date.strftime("%d/%m/%Y")}'
                    ),
                    "due_date": t.scheduled_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in task_pairs:
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member,
                    ntype,
                    "task_instance",
                    obj.id,
                    make_defaults(obj),
                    dry_run,
                )

        # --- Payable ---
        from payables.models import Payable

        payable_pairs = [
            (
                Payable.objects.filter(
                    member=member,
                    due_date__range=[today, soon],
                    status="active",
                ),
                "payable_due_soon",
                lambda p: {
                    "title": f"Vencimento próximo: {p.description}",
                    "message": f'Vence em {p.due_date.strftime("%d/%m/%Y")}',
                    "due_date": p.due_date,
                },
            ),
            (
                Payable.objects.filter(
                    member=member,
                    due_date__lt=today,
                    status__in=["active", "overdue"],
                ),
                "payable_overdue",
                lambda p: {
                    "title": f"Valor a pagar atrasado: {p.description}",
                    "message": f'Venceu em {p.due_date.strftime("%d/%m/%Y")}',
                    "due_date": p.due_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in payable_pairs:  # type: ignore[assignment]  # noqa: E501
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member,
                    ntype,
                    "payable",
                    obj.id,
                    make_defaults(obj),
                    dry_run,
                )

        # --- Loan ---
        from loans.models import Loan

        member_loans = Loan.objects.filter(
            Q(benefited=member) | Q(creditor=member)
        )
        loan_pairs = [
            (
                member_loans.filter(
                    due_date__range=[today, soon], status="active"
                ),
                "loan_due_soon",
                lambda ln: {
                    "title": (
                        f"Empréstimo próximo do vencimento:"
                        f" {ln.description}"
                    ),
                    "message": f'Vence em {ln.due_date.strftime("%d/%m/%Y")}',
                    "due_date": ln.due_date,
                },
            ),
            (
                member_loans.filter(
                    due_date__lt=today, status__in=["active", "overdue"]
                ),
                "loan_overdue",
                lambda ln: {
                    "title": f"Empréstimo atrasado: {ln.description}",
                    "message": f'Venceu em {ln.due_date.strftime("%d/%m/%Y")}',
                    "due_date": ln.due_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in loan_pairs:  # type: ignore[assignment]  # noqa: E501
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member, ntype, "loan", obj.id, make_defaults(obj), dry_run
                )

        # --- CreditCardBill ---
        from credit_cards.models import CreditCardBill

        member_bills = CreditCardBill.objects.filter(credit_card__owner=member)
        bill_pairs = [
            (
                member_bills.filter(
                    due_date__range=[today, soon],
                    status__in=["open", "closed"],
                ),
                "bill_due_soon",
                lambda b: {
                    "title": (
                        f"Fatura próxima do vencimento:"
                        f" {b.credit_card.name}"
                    ),
                    "message": f'Vence em {b.due_date.strftime("%d/%m/%Y")}',
                    "due_date": b.due_date,
                },
            ),
            (
                member_bills.filter(
                    due_date__lt=today, status__in=["open", "closed"]
                ),
                "bill_overdue",
                lambda b: {
                    "title": f"Fatura atrasada: {b.credit_card.name}",
                    "message": f'Venceu em {b.due_date.strftime("%d/%m/%Y")}',
                    "due_date": b.due_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in bill_pairs:  # type: ignore[assignment]  # noqa: E501
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member, ntype, "bill", obj.id, make_defaults(obj), dry_run
                )

        # --- Budget ---
        dispatched += self._process_member_budgets(member, today, dry_run)

        # --- FinancialGoal ---
        dispatched += self._process_member_financial_goals(
            member, today, dry_run
        )

        # --- Agent Insights ---
        dispatched += self._process_member_agent_insights(
            member, today, dry_run
        )

        # --- ReadingGoal ---
        dispatched += self._process_member_reading_goals(
            member, today, dry_run
        )

        # --- BankReconciliation ---
        dispatched += self._process_member_reconciliations(
            member, today, dry_run
        )

        return dispatched

    def _process_member_budgets(self, member, today, dry_run: bool) -> int:
        from django.db.models import Sum

        from budgets.models import Budget
        from expenses.models import Expense

        dispatched = 0
        year, month = today.year, today.month
        _, last_day = calendar.monthrange(year, month)
        period_start = date(year, month, 1)
        month_end = date(year, month, last_day)

        budgets = Budget.objects.filter(
            created_by=member.user,
            month=month,
            year=year,
            is_deleted=False,
        )

        for budget in budgets:
            effective_limit = float(budget.limit_amount) + float(
                budget.rollover_amount or 0
            )
            if effective_limit <= 0:
                continue

            spent = (
                Expense.objects.filter(
                    created_by=member.user,
                    category=budget.category,
                    date__range=(period_start, today),
                    is_deleted=False,
                    related_transfer__isnull=True,
                ).aggregate(total=Sum("value"))["total"]
                or 0
            )
            pct = float(spent) / effective_limit * 100

            if float(spent) > effective_limit:
                dispatched += self._maybe_dispatch(
                    member,
                    "budget_exceeded",
                    "budget",
                    budget.id,
                    {
                        "title": (
                            f"Orçamento estourado:" f" {budget.category}"
                        ),
                        "message": (
                            f"{pct:.0f}% do limite utilizado"
                            f" (R$ {float(spent):.2f}"
                            f" / R$ {effective_limit:.2f})"
                        ),
                        "due_date": month_end,
                    },
                    dry_run,
                )
            elif pct >= 80:
                dispatched += self._maybe_dispatch(
                    member,
                    "budget_warning",
                    "budget",
                    budget.id,
                    {
                        "title": (
                            f"Alerta de orçamento:" f" {budget.category}"
                        ),
                        "message": (
                            f"{pct:.0f}% do limite utilizado"
                            f" (R$ {float(spent):.2f}"
                            f" / R$ {effective_limit:.2f})"
                        ),
                        "due_date": month_end,
                    },
                    dry_run,
                )

        return dispatched

    def _process_member_financial_goals(
        self, member, today, dry_run: bool
    ) -> int:
        from vaults.models import FinancialGoal

        dispatched = 0
        approaching_threshold = today + timedelta(days=30)

        goals = FinancialGoal.objects.filter(
            created_by=member.user,
            is_active=True,
            is_completed=False,
            is_deleted=False,
        )

        for goal in goals:
            if goal.current_value >= goal.target_value:
                dispatched += self._maybe_dispatch(
                    member,
                    "financial_goal_reached",
                    "financial_goal",
                    goal.id,
                    {
                        "title": (
                            f"Meta financeira atingida:" f" {goal.description}"
                        ),
                        "message": (
                            f"Parabéns! Você atingiu sua meta de"
                            f" R$ {float(goal.target_value):.2f}."
                        ),
                        "due_date": goal.target_date,
                    },
                    dry_run,
                )
            elif (
                goal.target_date and goal.target_date <= approaching_threshold
            ):
                dispatched += self._maybe_dispatch(
                    member,
                    "financial_goal_approaching",
                    "financial_goal",
                    goal.id,
                    {
                        "title": (
                            f"Meta financeira próxima do prazo:"
                            f" {goal.description}"
                        ),
                        "message": (
                            "Prazo em"
                            f' {goal.target_date.strftime("%d/%m/%Y")}.'
                            f" Progresso: R$ {float(goal.current_value):.2f}"
                            f" / R$ {float(goal.target_value):.2f}."
                        ),
                        "due_date": goal.target_date,
                    },
                    dry_run,
                )

        return dispatched

    def _process_member_agent_insights(
        self, member, today, dry_run: bool
    ) -> int:
        """Generate agent_insight notifications from budget detection logic.

        Uses get_budget_status() from the InsightAgent's tool layer to detect
        overbudget and critical (>=80%) budgets, then creates one agent_insight
        notification per budget per month. The unique_together constraint on
        (owner, notification_type, content_type, object_id) ensures idempotency
        across repeated runs within the same month.
        """
        from agents.tools.budget_tools import (
            get_budget_status,
            get_days_remaining_in_month,
        )
        from budgets.models import Budget

        user = member.user
        year, month = today.year, today.month
        _, last_day = calendar.monthrange(year, month)
        month_end = date(year, month, last_day)
        days_remaining = get_days_remaining_in_month()

        budget_statuses = get_budget_status(user, year=year, month=month)
        budget_id_by_category = {
            b.category: b.id
            for b in Budget.objects.filter(
                created_by=user, month=month, year=year, is_deleted=False
            )
        }

        dispatched = 0
        for b in budget_statuses:
            budget_id = budget_id_by_category.get(b["category"])
            if not budget_id:
                continue

            if b["overbudget"]:
                over_by = b["spent"] - b["limit"]
                dispatched += self._maybe_dispatch(
                    member,
                    "agent_insight",
                    "budget",
                    budget_id,
                    {
                        "title": (
                            f"Insight: orçamento estourado"
                            f" em {b['category']}"
                        ),
                        "message": (
                            f"{b['percentage']:.0f}% do limite utilizado"
                            f" (R$ {b['spent']:.2f} / R$ {b['limit']:.2f},"
                            f" R$ {over_by:.2f} acima do limite)."
                            f" Restam {days_remaining} dias no mês."
                        ),
                        "due_date": month_end,
                    },
                    dry_run,
                )
            elif b["percentage"] >= 80:
                dispatched += self._maybe_dispatch(
                    member,
                    "agent_insight",
                    "budget",
                    budget_id,
                    {
                        "title": (
                            f"Insight: orçamento crítico"
                            f" em {b['category']}"
                        ),
                        "message": (
                            f"{b['percentage']:.0f}% do limite utilizado"
                            f" (R$ {b['spent']:.2f} / R$ {b['limit']:.2f})."
                            f" Saldo disponível: R$ {b['remaining']:.2f}"
                            f" para {days_remaining} dias."
                        ),
                        "due_date": month_end,
                    },
                    dry_run,
                )

        return dispatched

    def _process_member_reading_goals(
        self, member, today, dry_run: bool
    ) -> int:
        from library.models import ReadingGoal

        dispatched = 0
        in_second_half = today.month >= 7

        goals = ReadingGoal.objects.filter(owner=member, year=today.year)

        for goal in goals:
            if goal.books_goal == 0:
                continue

            books_read = goal.books_read_this_year
            pct = round(min((books_read / goal.books_goal) * 100, 100.0), 1)
            goal_name = goal.name or f"Meta {goal.year}"

            if pct >= 100:
                dispatched += self._maybe_dispatch(
                    member,
                    "reading_goal_achieved",
                    "reading_goal",
                    goal.id,
                    {
                        "title": f"Meta de leitura atingida: {goal_name}",
                        "message": (
                            f"Parabéns! Você leu {books_read}"
                            f" de {goal.books_goal} livros planejados."
                        ),
                        "due_date": None,
                    },
                    dry_run,
                )
            elif in_second_half and pct < 50:
                dispatched += self._maybe_dispatch(
                    member,
                    "reading_goal_behind",
                    "reading_goal",
                    goal.id,
                    {
                        "title": f"Meta de leitura atrasada: {goal_name}",
                        "message": (
                            f"Você completou {pct:.0f}% da meta."
                            " Acelere o ritmo"
                            f" para atingir {goal.books_goal}"
                            " livros até o fim do ano."
                        ),
                        "due_date": None,
                    },
                    dry_run,
                )

        return dispatched

    def _process_member_reconciliations(
        self, member, today, dry_run: bool
    ) -> int:
        from bank_reconciliation.models import BankStatementImport

        dispatched = 0
        threshold = today - timedelta(days=3)

        pending_imports = BankStatementImport.objects.filter(
            owner=member.user,
            status="completed",
            is_deleted=False,
            created_at__date__lte=threshold,
            entries__status__in=["pending", "unmatched"],
        ).distinct()

        for stmt_import in pending_imports:
            pending_count = stmt_import.entries.filter(
                status__in=["pending", "unmatched"]
            ).count()
            entry_word = (
                "entrada não reconciliada"
                if pending_count == 1
                else "entradas não reconciliadas"
            )
            dispatched += self._maybe_dispatch(
                member,
                "reconciliation_pending",
                "bank_statement_import",
                stmt_import.id,
                {
                    "title": (
                        f"Extrato pendente:"
                        f" {stmt_import.original_filename}"
                    ),
                    "message": (
                        f"{pending_count} {entry_word} há mais de 3 dias."
                    ),
                    "due_date": None,
                },
                dry_run,
            )

        return dispatched

    def _maybe_dispatch(
        self,
        member,
        notification_type,
        content_type,
        object_id,
        defaults,
        dry_run: bool,
    ) -> int:
        if dry_run:
            exists = Notification.objects.filter(
                owner=member,
                notification_type=notification_type,
                content_type=content_type,
                object_id=object_id,
                is_deleted=False,
            ).exists()
            if not exists:
                self.stdout.write(
                    f"  [dry-run] Would dispatch {notification_type} "
                    f"({content_type}:{object_id}) for {member}"
                )
                return 1
            return 0

        notification, created = _get_or_create_notification(
            member, notification_type, content_type, object_id, defaults
        )
        if created:
            dispatch_notification(notification)
            return 1
        return 0
