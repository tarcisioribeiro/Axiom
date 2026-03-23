"""
Signals para atualização automática de saldos de contas.

Este módulo implementa signals que atualizam automaticamente o saldo
das contas quando receitas ou despesas são criadas, editadas ou deletadas.
Também cria automaticamente uma receita quando uma conta é criada com saldo inicial.
"""

from decimal import Decimal
from typing import Any, Type

from django.db import models, transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone


def update_account_balance(account: Any) -> None:
    """
    Atualiza o saldo de uma conta com base em suas receitas e despesas.

    Parameters
    ----------
    account : Account
        Conta a ter o saldo atualizado

    Notes
    -----
    O saldo é calculado como:
    saldo = soma(receitas recebidas) - soma(despesas pagas)

    Usa transaction.atomic() para garantir consistência dos dados.
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    with transaction.atomic():
        # Calcula total de receitas recebidas
        total_revenues = Revenue.objects.filter(
            account=account, received=True, is_deleted=False
        ).aggregate(total=models.Sum("value"))["total"] or Decimal("0.00")

        # Calcula total de despesas pagas
        total_expenses = Expense.objects.filter(
            account=account, payed=True, is_deleted=False
        ).aggregate(total=models.Sum("value"))["total"] or Decimal("0.00")

        # Atualiza o saldo da conta
        new_balance = total_revenues - total_expenses
        account.current_balance = new_balance
        account.save(update_fields=["current_balance"])


@receiver(post_save, sender="revenues.Revenue")
def update_balance_on_revenue_save(
    sender: Type[Any], instance: Any, created: bool, **kwargs: Any
) -> None:
    """
    Atualiza o saldo da conta quando uma receita é criada ou editada.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Revenue)
    instance : Revenue
        Instância da receita criada/editada
    created : bool
        True se foi criada, False se foi editada
    **kwargs
        Argumentos adicionais do signal
    """
    if instance.account:
        update_account_balance(instance.account)


@receiver(post_delete, sender="revenues.Revenue")
def update_balance_on_revenue_delete(
    sender: Type[Any], instance: Any, **kwargs: Any
) -> None:
    """
    Atualiza o saldo da conta quando uma receita é deletada.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Revenue)
    instance : Revenue
        Instância da receita deletada
    **kwargs
        Argumentos adicionais do signal
    """
    if instance.account:
        update_account_balance(instance.account)


@receiver(post_save, sender="expenses.Expense")
def update_balance_on_expense_save(
    sender: Type[Any], instance: Any, created: bool, **kwargs: Any
) -> None:
    """
    Atualiza o saldo da conta quando uma despesa é criada ou editada.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Expense)
    instance : Expense
        Instância da despesa criada/editada
    created : bool
        True se foi criada, False se foi editada
    **kwargs
        Argumentos adicionais do signal
    """
    if instance.account:
        update_account_balance(instance.account)


@receiver(post_delete, sender="expenses.Expense")
def update_balance_on_expense_delete(
    sender: Type[Any], instance: Any, **kwargs: Any
) -> None:
    """
    Atualiza o saldo da conta quando uma despesa é deletada.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Expense)
    instance : Expense
        Instância da despesa deletada
    **kwargs
        Argumentos adicionais do signal
    """
    if instance.account:
        update_account_balance(instance.account)


@receiver(post_save, sender="accounts.Account")
def create_initial_revenue_on_account_creation(
    sender: Type[Any], instance: Any, created: bool, **kwargs: Any
) -> None:
    """
    Cria automaticamente uma receita quando uma conta é criada com saldo inicial.

    Quando uma conta é criada com current_balance > 0, este signal cria
    automaticamente uma receita correspondente para registrar o saldo inicial.
    Isso garante que o valor apareça tanto no saldo da conta quanto na
    lista de receitas.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Account)
    instance : Account
        Instância da conta criada/editada
    created : bool
        True se foi criada, False se foi editada
    **kwargs
        Argumentos adicionais do signal
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    if not created:
        return

    entry_date = instance.opening_date or timezone.now().date()
    entry_time = timezone.now().time()

    if instance.current_balance > Decimal("0.00"):
        # Criar receita de saldo inicial positivo
        Revenue.objects.create(
            description="Saldo inicial",
            value=instance.current_balance,
            date=entry_date,
            horary=entry_time,
            category="deposit",
            account=instance,
            received=True,
            member=instance.owner,
            created_by=instance.created_by,
            updated_by=instance.updated_by,
            notes="Receita criada automaticamente a partir do saldo inicial da conta.",
        )
    elif instance.current_balance < Decimal("0.00"):
        # Saldo inicial negativo: registrar como despesa (uso de cheque especial)
        Expense.objects.create(
            description="Saldo inicial negativo (cheque especial)",
            value=abs(instance.current_balance),
            date=entry_date,
            horary=entry_time,
            category="others",
            account=instance,
            payed=True,
            member=instance.owner,
            created_by=instance.created_by,
            updated_by=instance.updated_by,
        )
