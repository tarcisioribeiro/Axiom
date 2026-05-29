from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import CreditCardBill, CreditCardInstallment
from .utils import recalculate_bill_total


@receiver(post_save, sender=CreditCardInstallment)
@receiver(post_delete, sender=CreditCardInstallment)
def update_bill_totals_installment(sender, instance, **kwargs):
    """
    Signal para atualizar automaticamente o total da fatura e o pagamento
    mínimo
    quando uma parcela de cartão é criada, atualizada ou deletada.

    Regras:
    - total_amount = soma de todas as parcelas da fatura
    - minimum_payment = 10% do total_amount
    """
    # Verifica se a parcela está associada a uma fatura
    if not instance.bill:
        return

    recalculate_bill_total(instance.bill)


@receiver(post_save, sender=CreditCardBill)
def ensure_bill_defaults(sender, instance, created, **kwargs):
    """
    Signal para garantir que faturas recém-criadas tenham valores padrão
    corretos.
    Este signal serve como garantia adicional caso o serializer seja
    contornado.
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


@receiver(post_save, sender="credit_cards.CreditCardPurchase")
def embed_credit_card_purchase(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    source_title = f"{instance.category} — {instance.purchase_date}"

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="credit_card_bill",
            content_fn=lambda i: (
                f"Compra no cartão de R$ {i.total_value} em {i.category}"
                f" — {i.merchant or i.description} em {i.purchase_date}"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)
