from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_fixed_expenses_for_month(
    self, month_str: str | None = None
) -> dict:
    """Gera instâncias de despesas fixas para o mês atual (ou month_str
    'YYYY-MM').

    Itera sobre todos os templates ativos de FixedExpense que ainda não foram
    gerados no mês alvo e cria as Expense/CreditCardInstallment
    correspondentes.
    """
    try:
        from django.contrib.auth.models import User
        from django.utils import timezone

        from expenses.models import FixedExpense
        from expenses.services import bulk_generate_fixed_expenses

        if month_str is None:
            month_str = timezone.now().strftime("%Y-%m")

        # Usa o primeiro superuser disponível como "usuário do sistema"
        # para criação.
        system_user = User.objects.filter(
            is_superuser=True, is_active=True
        ).first()
        if not system_user:
            return {"status": "skipped", "reason": "no superuser available"}

        templates = FixedExpense.objects.filter(
            is_active=True,
            is_deleted=False,
        ).exclude(last_generated_month=month_str)

        if not templates.exists():
            return {"status": "ok", "created": 0, "month": month_str}

        expense_values = [
            {"fixed_expense_id": fe.id, "value": float(fe.default_value)}
            for fe in templates
        ]
        result = bulk_generate_fixed_expenses(
            month_str, expense_values, system_user
        )
        return {
            "status": "ok",
            "month": month_str,
            "created": result["created_count"],
        }
    except Exception as exc:
        raise self.retry(exc=exc)
