"""
Management command: send_due_notifications

Iterates over all active members, generates their pending notifications
(same logic as the API list view), and dispatches any new ones to the
configured channel (in_app / email / both) based on the member's
NotificationPreference settings.

Schedule via cron (example — daily at 08:00 BRT):
    0 8 * * * docker compose exec api python manage.py send_due_notifications
"""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from members.models import Member
from notifications.models import Notification
from notifications.services import dispatch_notification

logger = logging.getLogger("mindledger")


def _get_or_create_notification(
    member, notification_type, content_type, object_id, defaults
):
    """Wrapper that returns (notification, created) and only dispatches when created."""
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
        "Generate and dispatch due/overdue notifications for all active members. "
        "Only newly-created notifications are dispatched via email to avoid duplicates."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be dispatched without sending emails or saving.",
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

        members_qs = Member.objects.filter(is_deleted=False).select_related("user")
        if member_id:
            members_qs = members_qs.filter(pk=member_id)

        total_dispatched = 0

        for member in members_qs:
            dispatched = self._process_member(member, today, soon, dry_run)
            total_dispatched += dispatched

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] Would have dispatched {total_dispatched} notifications."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Dispatched {total_dispatched} notifications.")
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
                        f'Programada para {t.scheduled_date.strftime("%d/%m/%Y")}'
                    ),
                    "due_date": t.scheduled_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in task_pairs:
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member, ntype, "task_instance", obj.id, make_defaults(obj), dry_run
                )

        # --- Payable ---
        from payables.models import Payable

        payable_pairs = [
            (
                Payable.objects.filter(
                    member=member, due_date__range=[today, soon], status="active"
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
                    member=member, due_date__lt=today, status__in=["active", "overdue"]
                ),
                "payable_overdue",
                lambda p: {
                    "title": f"Valor a pagar atrasado: {p.description}",
                    "message": f'Venceu em {p.due_date.strftime("%d/%m/%Y")}',
                    "due_date": p.due_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in payable_pairs:  # type: ignore[assignment]
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member, ntype, "payable", obj.id, make_defaults(obj), dry_run
                )

        # --- Loan ---
        from loans.models import Loan

        member_loans = Loan.objects.filter(Q(benefited=member) | Q(creditor=member))
        loan_pairs = [
            (
                member_loans.filter(due_date__range=[today, soon], status="active"),
                "loan_due_soon",
                lambda ln: {
                    "title": f"Empréstimo próximo do vencimento: {ln.description}",
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
        for queryset, ntype, make_defaults in loan_pairs:  # type: ignore[assignment]
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
                    due_date__range=[today, soon], status__in=["open", "closed"]
                ),
                "bill_due_soon",
                lambda b: {
                    "title": f"Fatura próxima do vencimento: {b.credit_card.name}",
                    "message": f'Vence em {b.due_date.strftime("%d/%m/%Y")}',
                    "due_date": b.due_date,
                },
            ),
            (
                member_bills.filter(due_date__lt=today, status__in=["open", "closed"]),
                "bill_overdue",
                lambda b: {
                    "title": f"Fatura atrasada: {b.credit_card.name}",
                    "message": f'Venceu em {b.due_date.strftime("%d/%m/%Y")}',
                    "due_date": b.due_date,
                },
            ),
        ]
        for queryset, ntype, make_defaults in bill_pairs:  # type: ignore[assignment]
            for obj in queryset:
                dispatched += self._maybe_dispatch(
                    member, ntype, "bill", obj.id, make_defaults(obj), dry_run
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
