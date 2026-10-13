from django.db import migrations


def fg_wallet_to_cm(apps, schema_editor):
    """A conta "Carteira" foi cadastrada como Fundo de Garantia antes do tipo CM."""
    Account = apps.get_model("accounts", "Account")
    Account.objects.filter(
        account_type="FG", account_name__icontains="carteira", is_deleted=False
    ).update(account_type="CM")


def cm_to_fg(apps, schema_editor):
    Account = apps.get_model("accounts", "Account")
    Account.objects.filter(account_type="CM").update(account_type="FG")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_wallet_account_type"),
    ]

    operations = [migrations.RunPython(fg_wallet_to_cm, cm_to_fg)]
