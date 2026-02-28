# Generated manually for data migration from CreditCardExpense to Purchase/Installment

from django.db import migrations
from decimal import Decimal


def migrate_expenses_to_purchases(apps, schema_editor):
    """
    Migra dados de CreditCardExpense para CreditCardPurchase e CreditCardInstallment.

    Agrupa despesas por:
    - card + description + total_installments + data da primeira parcela (mês/ano)

    Para cada grupo, cria:
    - 1 CreditCardPurchase com valor total
    - N CreditCardInstallment vinculados
    """
    CreditCardExpense = apps.get_model('credit_cards', 'CreditCardExpense')
    CreditCardPurchase = apps.get_model('credit_cards', 'CreditCardPurchase')
    CreditCardInstallment = apps.get_model('credit_cards', 'CreditCardInstallment')

    # Buscar todas as despesas não deletadas
    expenses = CreditCardExpense.objects.filter(is_deleted=False).order_by(
        'card', 'description', 'total_installments', 'date', 'installment'
    )

    if not expenses.exists():
        return

    # Agrupar por card + description + total_installments + mês/ano da primeira parcela
    groups = {}
    for expense in expenses:
        # Criar chave única para agrupar
        # Compras parceladas terão mesma description, card, total_installments
        group_key = (
            expense.card_id,
            expense.description,
            expense.total_installments,
            expense.category,
        )

        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(expense)

    # Para cada grupo, criar Purchase e Installments
    for group_key, group_expenses in groups.items():
        card_id, description, total_installments, category = group_key

        # Ordenar por número da parcela
        group_expenses.sort(key=lambda e: e.installment)

        # Verificar se temos o número correto de parcelas
        # Se não, pode ser que haja múltiplas compras com mesma descrição
        # Nesse caso, agrupar por proximidade de datas
        if len(group_expenses) > total_installments:
            # Múltiplas compras com mesma descrição - subdividir
            sub_groups = _subdivide_by_date_proximity(group_expenses, total_installments)
        else:
            sub_groups = [group_expenses]

        for sub_group in sub_groups:
            if not sub_group:
                continue

            # Pegar primeira despesa como referência
            first_expense = sub_group[0]

            # Calcular valor total
            total_value = sum(Decimal(str(e.value)) for e in sub_group)

            # Se tivermos menos parcelas do que total_installments,
            # o valor total é proporcional
            if len(sub_group) < first_expense.total_installments:
                # Valor de uma parcela * total de parcelas
                installment_value = total_value / len(sub_group)
                total_value = installment_value * first_expense.total_installments

            # Criar Purchase
            purchase = CreditCardPurchase.objects.create(
                description=description,
                total_value=total_value,
                purchase_date=first_expense.date,
                purchase_time=first_expense.horary,
                category=category,
                card_id=card_id,
                total_installments=first_expense.total_installments,
                merchant=first_expense.merchant,
                member_id=first_expense.member_id,
                notes=first_expense.notes,
                created_at=first_expense.created_at,
                updated_at=first_expense.updated_at,
                created_by_id=first_expense.created_by_id,
                updated_by_id=first_expense.updated_by_id,
            )

            # Criar Installments para cada despesa do grupo
            for expense in sub_group:
                CreditCardInstallment.objects.create(
                    purchase=purchase,
                    installment_number=expense.installment,
                    value=expense.value,
                    due_date=expense.date,
                    bill_id=expense.bill_id,
                    payed=expense.payed,
                    created_at=expense.created_at,
                    updated_at=expense.updated_at,
                    created_by_id=expense.created_by_id,
                    updated_by_id=expense.updated_by_id,
                )


def _subdivide_by_date_proximity(expenses, expected_per_group):
    """
    Subdivide uma lista de despesas em grupos baseados na proximidade de datas.
    Útil quando há múltiplas compras com mesma descrição.
    """
    if expected_per_group <= 0:
        return [expenses]

    result = []
    current_group = []

    for expense in expenses:
        if expense.installment == 1:
            # Nova compra começa
            if current_group:
                result.append(current_group)
            current_group = [expense]
        else:
            current_group.append(expense)

    if current_group:
        result.append(current_group)

    return result


def reverse_migration(apps, schema_editor):
    """
    Reverte a migração - apenas limpa os dados das novas tabelas.
    Os dados originais em CreditCardExpense permanecem intactos.
    """
    CreditCardPurchase = apps.get_model('credit_cards', 'CreditCardPurchase')
    CreditCardInstallment = apps.get_model('credit_cards', 'CreditCardInstallment')

    # Deletar todos os registros das novas tabelas
    CreditCardInstallment.objects.all().delete()
    CreditCardPurchase.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('credit_cards', '0004_add_purchase_and_installment_models'),
    ]

    operations = [
        migrations.RunPython(
            migrate_expenses_to_purchases,
            reverse_migration,
        ),
    ]
