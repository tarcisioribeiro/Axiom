from decimal import Decimal

from credit_cards.models import CreditCardBill, CreditCardInstallment


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
