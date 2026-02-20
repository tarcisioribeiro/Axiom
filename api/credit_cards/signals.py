from decimal import Decimal

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import CreditCardBill, CreditCardInstallment


@receiver(post_save, sender=CreditCardInstallment)
@receiver(post_delete, sender=CreditCardInstallment)
def update_bill_totals_installment(sender, instance, **kwargs):
    """
    Signal para atualizar automaticamente o total da fatura e o pagamento mínimo
    quando uma parcela de cartão é criada, atualizada ou deletada.

    Regras:
    - total_amount = soma de todas as parcelas da fatura
    - minimum_payment = 10% do total_amount
    """
    # Verifica se a parcela está associada a uma fatura
    if not instance.bill:
        return

    _recalculate_bill_total(instance.bill)


def _recalculate_bill_total(bill):
    """
    Recalcula o total de uma fatura baseado nas parcelas associadas.
    """
    total = Decimal("0.00")

    # Soma parcelas
    installments = CreditCardInstallment.objects.filter(
        bill=bill, is_deleted=False, purchase__is_deleted=False
    )
    total += sum(Decimal(str(inst.value)) for inst in installments)

    # Atualiza o total e o pagamento mínimo (10%)
    bill.total_amount = total
    bill.minimum_payment = total * Decimal("0.10")  # 10% do total
    bill.save()


@receiver(post_save, sender=CreditCardBill)
def ensure_bill_defaults(sender, instance, created, **kwargs):
    """
    Signal para garantir que faturas recém-criadas tenham valores padrão corretos.
    Este signal serve como garantia adicional caso o serializer seja contornado.
    """
    if created:
        needs_update = False

        if instance.status != "open":
            instance.status = "open"
            needs_update = True

        if instance.closed:
            instance.closed = False
            needs_update = True

        # Salva novamente se necessário, mas evita loop infinito
        if needs_update:
            # Usa update para evitar disparar o signal novamente
            CreditCardBill.objects.filter(pk=instance.pk).update(
                status="open", closed=False
            )
