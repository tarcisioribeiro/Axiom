from django.db import migrations


def backfill_initial_balance(apps, schema_editor):
    Expense = apps.get_model("expenses", "Expense")
    Expense.objects.filter(
        description="Saldo inicial negativo (cheque especial)",
        is_initial_balance=False,
    ).update(is_initial_balance=True)


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("expenses", "0017_expense_is_initial_balance"),
    ]

    operations = [
        migrations.RunPython(backfill_initial_balance, reverse_backfill),
    ]
