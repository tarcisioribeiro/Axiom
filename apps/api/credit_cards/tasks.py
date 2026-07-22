from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def close_overdue_bills(self) -> dict:
    """
    Fecha automaticamente faturas vencidas (equivalente ao management
    command).
    """
    try:
        from django.utils import timezone

        from credit_cards.models import CreditCardBill

        today = timezone.now().date()
        updated = CreditCardBill.objects.filter(
            status="open",
            due_date__lt=today,
            is_deleted=False,
        ).update(status="overdue")
        return {"closed": updated, "date": str(today)}
    except Exception as exc:
        raise self.retry(exc=exc)
