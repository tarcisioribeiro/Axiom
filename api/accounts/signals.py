"""
Signals para criação automática de receita inicial ao criar contas.

Balance updates are no longer driven by signals. They are performed
explicitly via accounts.services.recalculate_account_balance() called
from ExpenseCreateListView, ExpenseRetrieveUpdateDestroyView,
RevenueCreateListView, RevenueRetrieveUpdateDestroyView, and the
equivalent Transfer views. This keeps balance writes inside the same
transaction.atomic() block as the originating expense/revenue write.
"""

from decimal import Decimal
from typing import Any, Type

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(post_save, sender="accounts.Account")
def create_initial_revenue_on_account_creation(
    sender: Type[Any], instance: Any, created: bool, **kwargs: Any
) -> None:
    """
    Cria automaticamente uma receita quando uma conta é criada
    com saldo inicial.

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
            is_initial_balance=True,
            member=instance.owner,
            created_by=instance.created_by,
            updated_by=instance.updated_by,
            notes=(
                "Receita criada automaticamente a partir do saldo inicial"
                " da conta."
            ),
        )
    elif instance.current_balance < Decimal("0.00"):
        # Saldo inicial negativo: registrar como despesa
        # (uso de cheque especial)
        Expense.objects.create(
            description="Saldo inicial negativo (cheque especial)",
            value=abs(instance.current_balance),
            date=entry_date,
            horary=entry_time,
            category="others",
            account=instance,
            payed=True,
            is_initial_balance=True,
            member=instance.owner,
            created_by=instance.created_by,
            updated_by=instance.updated_by,
        )
