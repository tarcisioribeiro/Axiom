from decimal import Decimal

from django.db.models import Sum

from credit_cards.models import CreditCardBill, CreditCardInstallment


def get_used_credit(card) -> Decimal:
    """Soma das parcelas não pagas do cartão."""
    result = CreditCardInstallment.objects.filter(
        purchase__card=card,
        purchase__is_deleted=False,
        is_deleted=False,
        payed=False,
    ).aggregate(total=Sum("value"))
    return result["total"] or Decimal("0")


def recalculate_bill_total(bill: CreditCardBill) -> None:
    """
    Recalcula o total de uma fatura baseado nas parcelas associadas.
    """
    installments = CreditCardInstallment.objects.filter(
        bill=bill, is_deleted=False, purchase__is_deleted=False
    )
    total = sum(
        (Decimal(str(inst.value)) for inst in installments), Decimal("0.00")
    )

    bill.total_amount = total
    bill.minimum_payment = total * Decimal("0.10")
    bill.save()
