from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def backfill_initial_payed_value(apps, schema_editor):
    """
    Para empréstimos já existentes, ``payed_value`` pode conter um valor
    informado manualmente na criação sem nenhuma Expense/Revenue vinculada
    (ex: histórico de pagamentos anteriores ao cadastro no Axiom). Sem essa
    informação preservada em ``initial_payed_value``, o próximo recálculo
    feito pelos signals de loans (que soma apenas Expense/Revenue vinculadas)
    substituiria ``payed_value`` inteiramente, descartando esse valor
    manual.

    Aqui reconstruímos essa baseline: ``initial_payed_value`` = o que sobra
    de ``payed_value`` depois de subtrair a soma das Expense/Revenue já
    vinculadas ao empréstimo, sem deixar o resultado negativo.
    """
    Loan = apps.get_model("loans", "Loan")
    Expense = apps.get_model("expenses", "Expense")
    Revenue = apps.get_model("revenues", "Revenue")

    for loan in Loan.objects.all():
        linked_expenses = Expense.objects.filter(
            related_loan=loan, is_deleted=False
        ).aggregate(total=Sum("value"))["total"] or Decimal("0")
        linked_revenues = Revenue.objects.filter(
            related_loan=loan, is_deleted=False
        ).aggregate(total=Sum("value"))["total"] or Decimal("0")

        linked_total = linked_expenses + linked_revenues
        baseline = loan.payed_value - linked_total
        if baseline < 0:
            baseline = Decimal("0.00")

        Loan.objects.filter(pk=loan.pk).update(initial_payed_value=baseline)


def reverse_backfill(apps, schema_editor):
    Loan = apps.get_model("loans", "Loan")
    Loan.objects.update(initial_payed_value=Decimal("0.00"))


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0009_loan_initial_payed_value"),
        ("expenses", "0005_expense_related_loan_and_more"),
        ("revenues", "0003_revenue_related_loan_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_initial_payed_value, reverse_backfill),
    ]
