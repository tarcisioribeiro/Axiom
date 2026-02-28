# Generated manually to link existing transfer transactions
from django.db import migrations


def link_existing_transfer_transactions(apps, schema_editor):
    """
    Vincula despesas e receitas existentes às suas transferências de origem.

    Busca transferências efetivadas e encontra as despesas/receitas correspondentes
    baseando-se em descrição, data, horário, valor e conta.
    """
    Transfer = apps.get_model('transfers', 'Transfer')
    Expense = apps.get_model('expenses', 'Expense')
    Revenue = apps.get_model('revenues', 'Revenue')

    linked_expenses = 0
    linked_revenues = 0

    # Iterar por todas as transferências efetivadas
    for transfer in Transfer.objects.filter(transfered=True, is_deleted=False):
        # Encontrar despesa correspondente
        expense = Expense.objects.filter(
            description=f"Transferência: {transfer.description}",
            date=transfer.date,
            horary=transfer.horary,
            value=transfer.value + transfer.fee,
            account=transfer.origin_account,
            is_deleted=False,
            related_transfer__isnull=True  # Apenas se ainda não está vinculada
        ).first()

        if expense:
            expense.related_transfer = transfer
            expense.save()
            linked_expenses += 1

        # Encontrar receita correspondente
        revenue = Revenue.objects.filter(
            description=f"Transferência: {transfer.description}",
            date=transfer.date,
            horary=transfer.horary,
            value=transfer.value,
            account=transfer.destiny_account,
            is_deleted=False,
            related_transfer__isnull=True  # Apenas se ainda não está vinculada
        ).first()

        if revenue:
            revenue.related_transfer = transfer
            revenue.save()
            linked_revenues += 1

    print(f"✓ Vinculadas {linked_expenses} despesas e {linked_revenues} receitas a transferências")


def reverse_link(apps, schema_editor):
    """Reverter: desvincular todas as transferências"""
    Expense = apps.get_model('expenses', 'Expense')
    Revenue = apps.get_model('revenues', 'Revenue')

    Expense.objects.filter(related_transfer__isnull=False).update(related_transfer=None)
    Revenue.objects.filter(related_transfer__isnull=False).update(related_transfer=None)


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0003_expense_related_transfer_and_more'),
        ('revenues', '0002_revenue_related_transfer_and_more'),
        ('transfers', '0003_alter_transfered_default'),
    ]

    operations = [
        migrations.RunPython(link_existing_transfer_transactions, reverse_link),
    ]
