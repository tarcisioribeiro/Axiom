"""
Serviço de recálculo de plano de pagamento de Loan.

Espelha ``payables.services.recalculate_installments`` para dar a Loan
paridade com Payable: redistribuir as parcelas em aberto mantendo ou
alterando a quantidade, sem tocar nas parcelas já pagas.
"""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from app.debt_installment_utils import (
    build_equal_installment_schedule,
    split_equal_values,
)
from loans.models import LoanInstallment


def _linked_fixed_expense(loan):
    from expenses.models import FixedExpense

    return FixedExpense.objects.filter(
        related_loan=loan, is_active=True
    ).first()


def _apply_new_value_to_fixed_expense(loan, new_value_per_installment, user):
    from expenses.models import Expense

    fixed_expense = _linked_fixed_expense(loan)
    if not fixed_expense:
        return

    fixed_expense.default_value = new_value_per_installment
    fixed_expense.updated_by = user
    fixed_expense.save(
        update_fields=["default_value", "updated_by", "updated_at"]
    )

    today = timezone.now().date()
    current_expense = Expense.objects.filter(
        fixed_expense_template=fixed_expense,
        date__year=today.year,
        date__month=today.month,
        payed=False,
        is_deleted=False,
    ).first()
    if current_expense:
        current_expense.value = new_value_per_installment
        current_expense.updated_by = user
        current_expense.save(
            update_fields=["value", "updated_by", "updated_at"]
        )


def recalculate_loan_installments(
    loan,
    mode,
    new_installment_count=None,
    user=None,
    dry_run=True,
):
    """
    Recalcula as parcelas em aberto de um Loan.

    mode="keep_count": redistribui o saldo restante pelas parcelas
        payed=False existentes (mesma quantidade, novo valor, datas
        preservadas).
    mode="change_count": apaga as parcelas em aberto e gera
        `new_installment_count` novas a partir de hoje, na cadência
        loan.payment_frequency.

    Parcelas payed=True nunca são tocadas. dry_run=True retorna só o
    preview; dry_run=False grava dentro de transaction.atomic().
    """
    if mode not in ("keep_count", "change_count"):
        raise ValidationError(
            {"mode": "mode deve ser keep_count ou change_count."}
        )

    remaining_value = loan.value - loan.payed_value

    paid_count = LoanInstallment.objects.filter(loan=loan, payed=True).count()
    open_installments = list(
        LoanInstallment.objects.filter(loan=loan, payed=False).order_by(
            "installment_number"
        )
    )
    old_installment_count = paid_count + len(open_installments)
    old_value_per_installment = (
        open_installments[0].value if open_installments else Decimal("0.00")
    )

    if mode == "keep_count":
        if not open_installments:
            raise ValidationError(
                {"mode": "Não há parcelas em aberto para redistribuir."}
            )
        values = split_equal_values(remaining_value, len(open_installments))
        installments_preview = [
            {
                "number": inst.installment_number,
                "old_value": inst.value,
                "new_value": value,
                "due_date": inst.due_date,
            }
            for inst, value in zip(open_installments, values)
        ]
        new_installment_count = old_installment_count
    else:
        if not new_installment_count or int(new_installment_count) < 1:
            raise ValidationError(
                {
                    "new_installment_count": (
                        "Informe a nova quantidade de parcelas (>= 1)."
                    )
                }
            )
        new_installment_count = int(new_installment_count)
        schedule = build_equal_installment_schedule(
            remaining_value,
            new_installment_count,
            timezone.now().date(),
            loan.payment_frequency,
        )
        installments_preview = [
            {
                "number": paid_count + item["number"],
                "old_value": None,
                "new_value": item["value"],
                "due_date": item["due_date"],
            }
            for item in schedule
        ]
        new_installment_count = paid_count + len(schedule)

    new_value_per_installment = (
        installments_preview[0]["new_value"]
        if installments_preview
        else Decimal("0.00")
    )

    preview = {
        "loan_id": loan.id,
        "mode": mode,
        "old_installment_count": old_installment_count,
        "new_installment_count": new_installment_count,
        "old_value_per_installment": old_value_per_installment,
        "new_value_per_installment": new_value_per_installment,
        "remaining_value": remaining_value,
        "installments_preview": installments_preview,
    }

    if dry_run:
        return preview

    with transaction.atomic():
        if mode == "keep_count":
            for inst, item in zip(open_installments, installments_preview):
                inst.value = item["new_value"]
                inst.updated_by = user
                inst.save(update_fields=["value", "updated_by", "updated_at"])
        else:
            LoanInstallment.objects.filter(loan=loan, payed=False).delete()
            LoanInstallment.objects.bulk_create(
                [
                    LoanInstallment(
                        loan=loan,
                        installment_number=item["number"],
                        value=item["new_value"],
                        due_date=item["due_date"],
                        payed=False,
                        created_by=user,
                        updated_by=user,
                    )
                    for item in installments_preview
                ]
            )
            loan.installments = new_installment_count
            loan.save(update_fields=["installments", "updated_at"])

        _apply_new_value_to_fixed_expense(
            loan, new_value_per_installment, user
        )

    return preview
