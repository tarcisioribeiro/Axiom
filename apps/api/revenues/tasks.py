from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_fixed_revenues_for_month(
    self, month_str: str | None = None
) -> dict:
    """
    Gera instâncias de receitas fixas para o mês atual
    (ou month_str 'YYYY-MM').
    """
    try:
        from django.contrib.auth.models import User
        from django.utils import timezone

        from revenues.models import FixedRevenue
        from revenues.services import bulk_generate_fixed_revenues

        if month_str is None:
            month_str = timezone.now().strftime("%Y-%m")

        system_user = User.objects.filter(
            is_superuser=True, is_active=True
        ).first()
        if not system_user:
            return {"status": "skipped", "reason": "no superuser available"}

        templates = FixedRevenue.objects.filter(
            is_active=True,
            is_deleted=False,
        ).exclude(last_generated_month=month_str)

        if not templates.exists():
            return {"status": "ok", "created": 0, "month": month_str}

        revenue_values = [
            {"fixed_revenue_id": fr.id, "value": float(fr.default_value)}
            for fr in templates
        ]
        result = bulk_generate_fixed_revenues(
            month_str, revenue_values, system_user
        )
        return {
            "status": "ok",
            "month": month_str,
            "created": result["created_count"],
        }
    except Exception as exc:
        raise self.retry(exc=exc)
