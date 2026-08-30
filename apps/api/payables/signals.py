from decimal import Decimal

from django.db.models import Sum
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


@receiver(post_delete, sender="payables.Payable")
def nullify_expenses_on_payable_delete(sender, instance, **kwargs):
    """Nulifica related_payable nas Expenses vinculadas ao deletar um Payable.

    Preserva as despesas — apenas remove o vínculo para evitar órfãos.
    """
    from expenses.models import Expense

    Expense.objects.filter(related_payable=instance).update(
        related_payable=None
    )


def generate_payable_installments(
    payable, installment_count, user, account, first_due_date=None
):
    """
    Gera o plano de pagamento parcelado de um Payable: cria as
    PayableInstallment (valor igual, cronograma via
    app.debt_installment_utils) e a FixedExpense única que representa a
    parcela corrente no Planejador Financeiro Mensal.

    Diferente de Loan (que já nasce parcelado na criação), o parcelamento
    de Payable é um passo posterior e opcional — esta função só é chamada
    explicitamente pela view de plano de pagamento, nunca por um signal
    post_save.

    Parameters
    ----------
    payable : Payable
        O payable a ser parcelado. Deve ter installments <= 1 (validado
        na view).
    installment_count : int
        Número de parcelas do plano (>= 2).
    user : User
        Usuário que está criando o plano (para created_by/updated_by).
    account : Account
        Conta bancária usada para gerar as despesas mensais.
    first_due_date : date | None
        Vencimento da 1ª parcela. Se omitido, usa a próxima ocorrência do
        dia de vencimento da dívida a partir de hoje (nunca no passado).

    Returns
    -------
    FixedExpense
        A despesa fixa criada, vinculada ao payable.
    """
    from django.utils import timezone

    from app.debt_installment_utils import (
        build_equal_installment_schedule,
        default_first_due_date,
    )
    from expenses.models import FixedExpense
    from payables.models import PayableInstallment

    if first_due_date is None:
        first_due_date = default_first_due_date(
            payable.date.day,
            payable.payment_frequency,
            today=timezone.now().date(),
        )

    remaining_value = payable.value - payable.paid_value
    schedule = build_equal_installment_schedule(
        remaining_value,
        installment_count,
        payable.date,
        payable.payment_frequency,
        first_due_date=first_due_date,
    )

    PayableInstallment.objects.bulk_create(
        [
            PayableInstallment(
                payable=payable,
                installment_number=item["number"],
                value=item["value"],
                due_date=item["due_date"],
                payed=False,
                created_by=user,
                updated_by=user,
            )
            for item in schedule
        ]
    )

    payable.installments = installment_count
    payable.save(update_fields=["installments", "updated_at"])

    first = schedule[0]
    fixed_expense = FixedExpense.objects.create(
        description=payable.description,
        default_value=first["value"],
        category=payable.category,
        account=account,
        due_day=first["due_date"].day,
        member=payable.member,
        is_active=True,
        allow_value_edit=False,
        related_payable=payable,
        created_by=user,
        updated_by=user,
    )
    return fixed_expense


def update_payable_paid_value(payable):
    """
    Recalcula o paid_value de um Payable baseado nas despesas vinculadas.

    Parameters
    ----------
    payable : Payable
        O payable a ser atualizado
    """
    from expenses.models import Expense, FixedExpense

    # Soma das despesas pagas vinculadas a este payable
    total_paid = Expense.objects.filter(
        related_payable=payable, is_deleted=False, payed=True
    ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

    # Atualizar paid_value e status
    payable.paid_value = total_paid

    # Atualizar status baseado no valor pago
    if total_paid >= payable.value:
        payable.status = "paid"
    elif payable.status == "paid":
        # Se estava pago mas agora não está mais (despesa desmarcada/deletada)
        payable.status = "active"

    # Salvar sem trigger signal recursivo
    from payables.models import Payable

    Payable.objects.filter(pk=payable.pk).update(
        paid_value=payable.paid_value, status=payable.status
    )

    # Requisito 3: ao quitar a dívida, desativa a despesa fixa vinculada.
    if payable.status == "paid":
        FixedExpense.objects.filter(
            related_payable=payable, is_active=True
        ).update(is_active=False)


@receiver(post_save, sender="expenses.Expense")
def expense_saved_update_payable(sender, instance, **kwargs):
    """
    Quando uma despesa é salva, atualiza o Payable relacionado.
    """
    if instance.related_payable and not instance.is_deleted:
        update_payable_paid_value(instance.related_payable)


@receiver(post_delete, sender="expenses.Expense")
def expense_deleted_update_payable(sender, instance, **kwargs):
    """
    Quando uma despesa é deletada, atualiza o Payable relacionado.
    """
    if instance.related_payable:
        update_payable_paid_value(instance.related_payable)
