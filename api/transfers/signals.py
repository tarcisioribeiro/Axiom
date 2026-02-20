"""
Signals para criação automática de despesas e receitas ao criar transferências.

Este módulo implementa signals que criam automaticamente:
- Uma despesa na conta de origem
- Uma receita na conta de destino

Isso garante que as transferências sejam refletidas nos saldos das contas.
"""

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from transfers.models import Transfer


@receiver(post_save, sender=Transfer)
def create_expense_and_revenue_on_transfer(sender, instance, created, **kwargs):
    """
    Cria despesa e receita automaticamente quando uma transferência é criada.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Transfer)
    instance : Transfer
        Instância da transferência criada/editada
    created : bool
        True se foi criada, False se foi editada
    **kwargs
        Argumentos adicionais do signal
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    # Só cria as transações se for uma transferência efetivada
    if not instance.transfered:
        return

    # Para evitar recursão infinita, verificar se já existem as transações
    existing_expense = Expense.objects.filter(
        description=f"Transferência: {instance.description}",
        account=instance.origin_account,
        date=instance.date,
        horary=instance.horary,
        value=instance.value + instance.fee,  # Incluir taxa na despesa
    ).first()

    existing_revenue = Revenue.objects.filter(
        description=f"Transferência: {instance.description}",
        account=instance.destiny_account,
        date=instance.date,
        horary=instance.horary,
        value=instance.value,
    ).first()

    # Criar despesa na conta de origem (se não existir)
    if not existing_expense:
        Expense.objects.create(
            description=f"Transferência: {instance.description}",
            value=instance.value + instance.fee,  # Valor + taxa
            date=instance.date,
            horary=instance.horary,
            category="others",  # Categoria "Outros"
            account=instance.origin_account,
            payed=instance.transfered,
            merchant=f"Transferência para {instance.destiny_account.account_name}",
            payment_method="transfer",
            member=instance.member,
            related_transfer=instance,  # Vincular à transferência
            notes=f"Transferência ID: {instance.transaction_id or instance.uuid}\n"
            f"Tipo: {instance.get_category_display()}\n"
            f"Taxa: R$ {instance.fee}\n"
            f"{instance.notes or ''}",
            created_by=instance.created_by,
            updated_by=instance.updated_by,
        )

    # Criar receita na conta de destino (se não existir)
    if not existing_revenue:
        Revenue.objects.create(
            description=f"Transferência: {instance.description}",
            value=instance.value,
            date=instance.date,
            horary=instance.horary,
            category="transfer",  # Categoria "Transferência Recebida"
            account=instance.destiny_account,
            received=instance.transfered,
            source=f"Transferência de {instance.origin_account.account_name}",
            member=instance.member,
            related_transfer=instance,  # Vincular à transferência
            notes=f"Transferência ID: {instance.transaction_id or instance.uuid}\n"
            f"Tipo: {instance.get_category_display()}\n"
            f"{instance.notes or ''}",
            created_by=instance.created_by,
            updated_by=instance.updated_by,
        )


@receiver(pre_delete, sender=Transfer)
def delete_related_transactions_on_transfer_delete(sender, instance, **kwargs):
    """
    Remove as transações relacionadas quando uma transferência é deletada.

    Parameters
    ----------
    sender : class
        Classe que enviou o signal (Transfer)
    instance : Transfer
        Instância da transferência deletada
    **kwargs
        Argumentos adicionais do signal
    """
    from expenses.models import Expense
    from revenues.models import Revenue

    # Deletar transações vinculadas a esta transferência
    # O CASCADE já faz isso automaticamente, mas mantemos explícito
    Expense.objects.filter(related_transfer=instance).delete()
    Revenue.objects.filter(related_transfer=instance).delete()
