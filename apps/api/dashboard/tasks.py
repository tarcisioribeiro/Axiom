"""
Dashboard Celery tasks.

send_smart_financial_notifications — daily at 06:00, checks bills/payables
    and budgets, sending in-app notifications for upcoming deadlines.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.db.models import Sum

from celery import shared_task


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def send_smart_financial_notifications(self):
    """
    Verifica para cada usuário:
    - Faturas de cartão vencendo em <= 3 dias
    - Payables vencendo em <= 3 dias
    - Orçamentos acima de 80% do limite
    E cria notificações in-app via notifications.models.Notification.
    """
    try:
        from credit_cards.models import CreditCardBill
        from expenses.models import Expense
        from payables.models import Payable
    except ImportError:
        return

    today = date.today()
    deadline_3 = today + timedelta(days=3)

    users = User.objects.filter(is_active=True).only("id", "email")
    notifications_created = 0

    for user in users:
        # 1. Credit card bills due in <= 3 days
        bills = CreditCardBill.objects.filter(
            credit_card__created_by=user,
            due_date__isnull=False,
            due_date__lte=deadline_3,
            due_date__gte=today,
            status__in=["open", "closed"],
        ).select_related("credit_card")

        for bill in bills:
            days_left = (bill.due_date - today).days
            days_str = f"{days_left} dia{'s' if days_left != 1 else ''}"
            msg = (
                f"Fatura do {bill.credit_card.name} vence em {days_str}."
                if days_left > 0
                else f"Fatura do {bill.credit_card.name} vence hoje!"
            )
            _create_notification(
                user, "warning", "Fatura a Vencer", msg, "/credit-cards"
            )
            notifications_created += 1

        # 2. Payables due in <= 3 days
        payables = Payable.objects.filter(
            created_by=user,
            due_date__isnull=False,
            due_date__lte=deadline_3,
            due_date__gte=today,
            status__in=["active", "overdue"],
        )
        for payable in payables:
            days_left = (payable.due_date - today).days
            msg = (
                f"'{payable.description}' vence em {days_left} dia(s)."
                if days_left > 0
                else f"'{payable.description}' vence hoje!"
            )
            _create_notification(
                user, "warning", "Conta a Pagar", msg, "/payables"
            )
            notifications_created += 1

        # 3. Budgets above 80% of limit this month
        try:
            from budgets.models import Budget
            from members.models import Member

            member = Member.objects.filter(user=user).first()
            if member:
                budgets = Budget.objects.filter(
                    member=member,
                    month=today.month,
                    year=today.year,
                    is_deleted=False,
                )
                expense_totals = (
                    Expense.objects.filter(
                        created_by=user,
                        date__month=today.month,
                        date__year=today.year,
                        payed=True,
                    )
                    .values("category")
                    .annotate(total=Sum("value"))
                )
                totals_map = {
                    r["category"]: r["total"] for r in expense_totals
                }

                for budget in budgets:
                    limit = budget.limit_amount or Decimal("0")
                    if limit <= 0:
                        continue
                    spent = totals_map.get(budget.category, Decimal("0"))
                    pct = int(spent / limit * 100)
                    if pct >= 80:
                        severity = "danger" if pct >= 100 else "warning"
                        msg = (
                            f"Orcamento '{budget.category}'"
                            f" atingiu {pct}% do limite."
                        )
                        _create_notification(
                            user,
                            severity,
                            "Alerta de Orcamento",
                            msg,
                            "/budgets",
                        )
                        notifications_created += 1
        except Exception:
            pass

    return {"notifications_created": notifications_created}


def _create_notification(
    user, severity: str, title: str, message: str, link: str
) -> None:
    """Creates an in-app notification if the model is available."""
    try:
        from members.models import Member
        from notifications.models import Notification

        member = Member.objects.filter(user=user, is_deleted=False).first()
        if not member:
            return

        _TYPE_MAP = {
            ("warning", "Fatura"): "bill_due_soon",
            ("warning", "Conta"): "payable_due_soon",
            ("warning", "Orçamento"): "budget_warning",
            ("danger", "Orçamento"): "budget_exceeded",
        }
        notification_type = next(
            (
                v
                for (sev, kw), v in _TYPE_MAP.items()
                if severity == sev and kw in title
            ),
            "budget_warning",
        )
        Notification.objects.get_or_create(
            owner=member,
            notification_type=notification_type,
            content_type="financial_alert",
            object_id=0,
            defaults={"title": title, "message": message},
        )
    except Exception:
        pass
