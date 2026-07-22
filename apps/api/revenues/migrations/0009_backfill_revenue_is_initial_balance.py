from django.db import migrations


def backfill_initial_balance(apps, schema_editor):
    Revenue = apps.get_model("revenues", "Revenue")
    Revenue.objects.filter(
        description="Saldo inicial",
        is_initial_balance=False,
    ).update(is_initial_balance=True)


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("revenues", "0008_revenue_is_initial_balance"),
    ]

    operations = [
        migrations.RunPython(backfill_initial_balance, reverse_backfill),
    ]
