"""
Serviço de recálculo de plano de pagamento de Payable.

Cobre os requisitos 4-7 do épico de plano de pagamento de dívidas:
aumento de valor de dívida cumulativa, redistribuição de parcelas
pendentes (mantendo ou alterando a quantidade), e o fluxo atômico de
lançar uma despesa manual vinculada + redistribuir o restante.

Escopo restrito a Payable (decisão de negócio 5.2 do épico) — Loan mantém
o parcelamento original imutável.
"""

from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date as date_cls
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from app.debt_installment_utils import (
    build_equal_installment_schedule,
    split_equal_values,
)
from payables.models import PayableInstallment


@dataclass
class RecalculationPreview:
    payable_id: int
    mode: str  # "keep_count" | "change_count"
    old_installment_count: int
    new_installment_count: int
    old_value_per_installment: Decimal
    new_value_per_installment: Decimal
    remaining_value: Decimal
    installments_preview: list = field(default_factory=list)
    # [{"number", "old_value", "new_value", "due_date"}]


def _current_month_bounds(today: date_cls) -> tuple[date_cls, date_cls]:
    last_day = monthrange(today.year, today.month)[1]
    return today.replace(day=1), today.replace(day=last_day)


def _linked_fixed_expense(payable):
    from expenses.models import FixedExpense

    return FixedExpense.objects.filter(
        related_payable=payable, is_active=True
    ).first()


def _apply_new_value_to_fixed_expense_and_current_month(
    payable, new_value_per_installment, user
):
    """
    Requisito 6 + decisão de negócio 5.3: atualiza o valor futuro da
    FixedExpense vinculada e, se a despesa do MÊS CORRENTE já foi gerada
    mas ainda não foi confirmada/paga, atualiza o valor dela também.
    """
    from expenses.models import Expense

    fixed_expense = _linked_fixed_expense(payable)
    if not fixed_expense:
        return

    fixed_expense.default_value = new_value_per_installment
    fixed_expense.updated_by = user
    fixed_expense.save(
        update_fields=["default_value", "updated_by", "updated_at"]
    )

    month_start, month_end = _current_month_bounds(timezone.now().date())
    current_expense = Expense.objects.filter(
        fixed_expense_template=fixed_expense,
        date__gte=month_start,
        date__lte=month_end,
        payed=False,
        is_deleted=False,
    ).first()
    if current_expense:
        current_expense.value = new_value_per_installment
        current_expense.updated_by = user
        current_expense.save(
            update_fields=["value", "updated_by", "updated_at"]
        )


def recalculate_installments(
    payable,
    mode,
    new_installment_count=None,
    user=None,
    dry_run=True,
    remaining_value=None,
):
    """
    Recalcula as parcelas em aberto de um Payable.

    mode="keep_count": redistribui o saldo restante pelas parcelas
        payed=False já existentes (mesma quantidade, novo valor).
    mode="change_count": apaga as parcelas em aberto e gera
        `new_installment_count` novas (quantidade diferente, cronograma
        novo a partir de hoje, cadência payable.payment_frequency).

    Parcelas payed=True nunca são tocadas (histórico preservado).

    dry_run=True: só calcula e retorna o preview, sem gravar nada.
    dry_run=False: grava as mudanças (parcelas + FixedExpense + despesa do
        mês corrente) dentro de uma transaction.atomic().
    """
    if mode not in ("keep_count", "change_count"):
        raise ValidationError(
            {"mode": "mode deve ser keep_count ou change_count."}
        )

    if remaining_value is None:
        remaining_value = payable.value - payable.paid_value

    paid_count = PayableInstallment.objects.filter(
        payable=payable, payed=True
    ).count()
    open_installments = list(
        PayableInstallment.objects.filter(
            payable=payable, payed=False
        ).order_by("installment_number")
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
        target_count = len(open_installments)
        values = split_equal_values(remaining_value, target_count)
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
        if not new_installment_count or new_installment_count < 1:
            raise ValidationError(
                {
                    "new_installment_count": (
                        "Informe a nova quantidade de parcelas (>= 1)."
                    )
                }
            )
        schedule = build_equal_installment_schedule(
            remaining_value,
            new_installment_count,
            timezone.now().date(),
            payable.payment_frequency,
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

    preview = RecalculationPreview(
        payable_id=payable.id,
        mode=mode,
        old_installment_count=old_installment_count,
        new_installment_count=new_installment_count,
        old_value_per_installment=old_value_per_installment,
        new_value_per_installment=new_value_per_installment,
        remaining_value=remaining_value,
        installments_preview=installments_preview,
    )

    if dry_run:
        return preview

    with transaction.atomic():
        if mode == "keep_count":
            for inst, item in zip(open_installments, installments_preview):
                inst.value = item["new_value"]
                inst.updated_by = user
                inst.save(update_fields=["value", "updated_by", "updated_at"])
        else:
            PayableInstallment.objects.filter(
                payable=payable, payed=False
            ).delete()
            PayableInstallment.objects.bulk_create(
                [
                    PayableInstallment(
                        payable=payable,
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
            payable.installments = new_installment_count
            payable.save(update_fields=["installments", "updated_at"])

        _apply_new_value_to_fixed_expense_and_current_month(
            payable, new_value_per_installment, user
        )

    return preview


def increase_payable_value(payable, new_total_value, user, dry_run=True):
    """
    Requisitos 4/5: aumenta o valor de uma dívida cumulativa e recalcula as
    parcelas em aberto mantendo a quantidade atual.
    """
    if not payable.is_cumulative:
        raise ValidationError(
            {
                "is_cumulative": (
                    "Só é possível aumentar o valor de dívidas cumulativas."
                )
            }
        )
    if new_total_value <= payable.value:
        raise ValidationError(
            {
                "new_value": (
                    "O novo valor deve ser maior que o valor atual da dívida."
                )
            }
        )

    new_remaining_value = new_total_value - payable.paid_value

    if dry_run:
        return recalculate_installments(
            payable,
            mode="keep_count",
            user=user,
            dry_run=True,
            remaining_value=new_remaining_value,
        )

    with transaction.atomic():
        payable.value = new_total_value
        payable.updated_by = user
        payable.save(update_fields=["value", "updated_by", "updated_at"])
        preview = recalculate_installments(
            payable,
            mode="keep_count",
            user=user,
            dry_run=False,
            remaining_value=new_remaining_value,
        )
    return preview


def create_expense_and_redistribute(
    payable,
    expense_data,
    mode,
    new_installment_count=None,
    user=None,
    dry_run=True,
):
    """
    Requisito 7, decisão técnica 4: dentro de UMA transaction.atomic(),
    cria a Expense vinculada ao Payable (o que já dispara os signals
    existentes que reduzem paid_value e marcam a parcela mais antiga em
    aberto como paga) e então redistribui o saldo restante pelas parcelas
    pendentes.

    dry_run=True: não persiste nada (nem a Expense); calcula o preview a
    partir de um saldo restante hipotético. Retorna (None, preview).
    dry_run=False: persiste tudo atomicamente. Retorna (expense, preview).
    """
    expense_value = Decimal(str(expense_data["value"]))

    if dry_run:
        hypothetical_remaining = (
            payable.value - payable.paid_value - expense_value
        )
        preview = recalculate_installments(
            payable,
            mode=mode,
            new_installment_count=new_installment_count,
            user=user,
            dry_run=True,
            remaining_value=hypothetical_remaining,
        )
        return None, preview

    from accounts.services import recalculate_account_balance
    from expenses.models import Expense

    with transaction.atomic():
        expense = Expense.objects.create(
            description=expense_data.get(
                "description", f"Pagamento: {payable.description}"
            ),
            value=expense_value,
            date=expense_data["date"],
            horary=timezone.now().time(),
            category=expense_data.get("category", payable.category),
            account_id=expense_data["account"],
            payed=expense_data.get("payed", True),
            notes=expense_data.get("notes", ""),
            related_payable=payable,
            created_by=user,
            updated_by=user,
        )

        payable.refresh_from_db()

        preview = recalculate_installments(
            payable,
            mode=mode,
            new_installment_count=new_installment_count,
            user=user,
            dry_run=False,
        )

        if expense.payed:
            recalculate_account_balance(expense.account_id)

    return expense, preview
