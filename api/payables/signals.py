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


def update_payable_paid_value(payable):
    """
    Recalcula o paid_value de um Payable baseado nas despesas vinculadas.

    Parameters
    ----------
    payable : Payable
        O payable a ser atualizado
    """
    from expenses.models import Expense

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
