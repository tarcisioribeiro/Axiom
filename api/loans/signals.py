"""
Signals para atualização automática de empréstimos quando despesas/receitas
são criadas/editadas/deletadas.

Este módulo implementa signals que:
- Atualizam automaticamente o payed_value de um empréstimo quando uma despesa
  ou receita vinculada é criada/editada/deletada
- Atualizam automaticamente o status do empréstimo baseado no valor pago
  e data de vencimento
"""

from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.db.models.signals import post_delete, post_save, pre_delete
from django.dispatch import receiver


@receiver(post_save, sender="loans.Loan")
def generate_loan_installments(sender, instance, created, **kwargs):
    """Auto-generate LoanInstallment records when a new Loan is created."""
    if not created:
        return
    if not instance.installments or instance.installments <= 1:
        return

    from loans.models import LoanInstallment

    if LoanInstallment.objects.filter(loan=instance).exists():
        return

    from calendar import monthrange

    n = instance.installments
    value_per = (instance.value / Decimal(str(n))).quantize(Decimal("0.01"))
    start = instance.date

    freq = instance.payment_frequency or "monthly"
    freq_months = {
        "monthly": 1,
        "bimonthly": 2,
        "quarterly": 3,
        "semiannual": 6,
        "annual": 12,
    }
    step = freq_months.get(freq, 1)

    installments = []
    for i in range(1, n + 1):
        total_months = i * step
        m = start.month - 1 + total_months
        y = start.year + m // 12
        m = m % 12 + 1
        d = min(start.day, monthrange(y, m)[1])
        from datetime import date as dt

        due = dt(y, m, d)
        installments.append(
            LoanInstallment(
                loan=instance,
                installment_number=i,
                value=value_per,
                due_date=due,
                payed=False,
                created_by=instance.created_by,
                updated_by=instance.updated_by,
            )
        )
    LoanInstallment.objects.bulk_create(installments)


@receiver(post_delete, sender="loans.Loan")
def nullify_expenses_on_loan_delete(sender, instance, **kwargs):
    """Nulifica related_loan nas Expenses vinculadas ao deletar um Loan.

    Preserva as despesas — apenas remove o vínculo para evitar órfãos.
    """
    from expenses.models import Expense

    Expense.objects.filter(related_loan=instance).update(related_loan=None)


def update_loan_payed_value(loan):
    """
    Recalcula o payed_value do empréstimo baseado em todas as receitas
    e despesas vinculadas.

    Parameters
    ----------
    loan : Loan
        Instância do empréstimo a ser atualizado
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    # Somar todas as despesas pagas vinculadas a este empréstimo
    expense_payments = Expense.objects.filter(
        related_loan=loan, is_deleted=False
    ).aggregate(total=Sum("value"))["total"] or Decimal("0")

    # Somar todas as receitas recebidas vinculadas a este empréstimo
    revenue_payments = Revenue.objects.filter(
        related_loan=loan, is_deleted=False
    ).aggregate(total=Sum("value"))["total"] or Decimal("0")

    # Total pago = despesas + receitas
    total_paid = expense_payments + revenue_payments

    # Atualizar payed_value do empréstimo
    loan.payed_value = total_paid
    loan.save(update_fields=["payed_value", "updated_at"])


def update_loan_status(loan):
    """
    Atualiza o status do empréstimo baseado no valor pago e data de vencimento.

    Regras:
    - 'paid': payed_value >= value (totalmente pago)
    - 'overdue': payed_value < value AND due_date exists
      AND today > due_date (atrasado)
    - 'active': payed_value < value AND (no due_date
      OR today <= due_date) (ativo)

    Parameters
    ----------
    loan : Loan
        Instância do empréstimo a ser atualizado
    """
    # Calcular saldo restante
    remaining = loan.value - loan.payed_value

    # Atualizar status
    if loan.payed_value >= loan.value:
        # Totalmente pago
        new_status = "paid"
    elif loan.due_date and date.today() > loan.due_date and remaining > 0:
        # Atrasado (tem data de vencimento, já passou, e ainda tem saldo)
        new_status = "overdue"
    else:
        # Ativo (não está pago completo, e não está atrasado)
        new_status = "active"

    # Atualizar se mudou
    if loan.status != new_status:
        loan.status = new_status
        loan.save(update_fields=["status", "updated_at"])


@receiver(post_save, sender="expenses.Expense")
def update_loan_on_expense_save(sender, instance, created, **kwargs):
    """
    Atualiza o empréstimo quando uma despesa é criada ou editada.

    Este signal incrementa automaticamente o payed_value do empréstimo
    quando uma despesa vinculada é criada ou modificada.

    Parameters
    ----------
    sender : class
        A classe Expense
    instance : Expense
        A instância da despesa sendo salva
    created : bool
        True se foi criada, False se foi editada
    **kwargs
        Argumentos adicionais do signal
    """
    # Só processar se a despesa tem um empréstimo vinculado
    if not instance.related_loan:
        return

    # Usar select_for_update para evitar race conditions
    from loans.models import Loan

    try:
        loan = Loan.objects.select_for_update().get(
            pk=instance.related_loan.pk
        )

        # Recalcular payed_value baseado em todas as despesas/receitas
        # vinculadas
        update_loan_payed_value(loan)

        # Atualizar status
        update_loan_status(loan)

    except Loan.DoesNotExist:
        # Empréstimo foi deletado, nada a fazer
        pass


@receiver(pre_delete, sender="expenses.Expense")
def update_loan_on_expense_delete(sender, instance, **kwargs):
    """
    Atualiza o empréstimo quando uma despesa é deletada.

    Este signal decrementa automaticamente o payed_value do empréstimo
    quando uma despesa
    vinculada é deletada.

    Parameters
    ----------
    sender : class
        A classe Expense
    instance : Expense
        A instância da despesa sendo deletada
    **kwargs
        Argumentos adicionais do signal
    """
    # Só processar se a despesa tem um empréstimo vinculado
    if not instance.related_loan:
        return

    from loans.models import Loan

    try:
        loan = Loan.objects.select_for_update().get(
            pk=instance.related_loan.pk
        )

        # Recalcular payed_value baseado em todas as despesas/receitas
        # vinculadas
        # (a despesa atual ainda não foi deletada do banco, mas será após este
        # signal)
        update_loan_payed_value(loan)

        # Atualizar status
        update_loan_status(loan)

    except Loan.DoesNotExist:
        # Empréstimo foi deletado, nada a fazer
        pass


@receiver(post_delete, sender="expenses.Expense")
def recalculate_loan_after_expense_delete(sender, instance, **kwargs):
    """
    Recalcula o empréstimo após a despesa ser deletada.

    Parameters
    ----------
    sender : class
        A classe Expense
    instance : Expense
        A instância da despesa que foi deletada
    **kwargs
        Argumentos adicionais do signal
    """
    # Só processar se a despesa tinha um empréstimo vinculado
    if not instance.related_loan:
        return

    from loans.models import Loan

    try:
        loan = Loan.objects.select_for_update().get(
            pk=instance.related_loan.pk
        )

        # Recalcular payed_value (agora a despesa já foi deletada)
        update_loan_payed_value(loan)

        # Atualizar status
        update_loan_status(loan)

    except Loan.DoesNotExist:
        # Empréstimo foi deletado, nada a fazer
        pass


@receiver(post_save, sender="revenues.Revenue")
def update_loan_on_revenue_save(sender, instance, created, **kwargs):
    """
    Atualiza o empréstimo quando uma receita é criada ou editada.

    Este signal incrementa automaticamente o payed_value do empréstimo
    quando uma receita
    vinculada é criada ou modificada.

    Parameters
    ----------
    sender : class
        A classe Revenue
    instance : Revenue
        A instância da receita sendo salva
    created : bool
        True se foi criada, False se foi editada
    **kwargs
        Argumentos adicionais do signal
    """
    # Só processar se a receita tem um empréstimo vinculado
    if not instance.related_loan:
        return

    from loans.models import Loan

    try:
        loan = Loan.objects.select_for_update().get(
            pk=instance.related_loan.pk
        )

        # Recalcular payed_value baseado em todas as despesas/receitas
        # vinculadas
        update_loan_payed_value(loan)

        # Atualizar status
        update_loan_status(loan)

    except Loan.DoesNotExist:
        # Empréstimo foi deletado, nada a fazer
        pass


@receiver(pre_delete, sender="revenues.Revenue")
def update_loan_on_revenue_delete(sender, instance, **kwargs):
    """
    Atualiza o empréstimo quando uma receita é deletada.

    Este signal decrementa automaticamente o payed_value do empréstimo
    quando uma receita
    vinculada é deletada.

    Parameters
    ----------
    sender : class
        A classe Revenue
    instance : Revenue
        A instância da receita sendo deletada
    **kwargs
        Argumentos adicionais do signal
    """
    # Só processar se a receita tem um empréstimo vinculado
    if not instance.related_loan:
        return

    from loans.models import Loan

    try:
        loan = Loan.objects.select_for_update().get(
            pk=instance.related_loan.pk
        )

        # Recalcular payed_value baseado em todas as despesas/receitas
        # vinculadas
        update_loan_payed_value(loan)

        # Atualizar status
        update_loan_status(loan)

    except Loan.DoesNotExist:
        # Empréstimo foi deletado, nada a fazer
        pass


@receiver(post_delete, sender="revenues.Revenue")
def recalculate_loan_after_revenue_delete(sender, instance, **kwargs):
    """
    Recalcula o empréstimo após a receita ser deletada.

    Parameters
    ----------
    sender : class
        A classe Revenue
    instance : Revenue
        A instância da receita que foi deletada
    **kwargs
        Argumentos adicionais do signal
    """
    # Só processar se a receita tinha um empréstimo vinculado
    if not instance.related_loan:
        return

    from loans.models import Loan

    try:
        loan = Loan.objects.select_for_update().get(
            pk=instance.related_loan.pk
        )

        # Recalcular payed_value (agora a receita já foi deletada)
        update_loan_payed_value(loan)

        # Atualizar status
        update_loan_status(loan)

    except Loan.DoesNotExist:
        # Empréstimo foi deletado, nada a fazer
        pass
