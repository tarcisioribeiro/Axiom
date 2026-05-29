from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def calculate_daily_yields(self) -> dict:
    """Calcula e acumula rendimentos diários para todos os vaults."""
    try:
        from django.utils import timezone

        from vaults.models import Vault

        today = timezone.now().date()
        vaults = Vault.objects.filter(
            is_deleted=False,
        ).exclude(last_yield_date=today)

        updated = 0
        errors = 0
        for vault in vaults:
            try:
                vault.apply_yield(as_of_date=today)
                updated += 1
            except Exception:
                errors += 1

        return {"updated": updated, "errors": errors, "date": str(today)}
    except Exception as exc:
        raise self.retry(exc=exc)
