from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vaults", "0007_add_linked_fields_to_financial_goal"),
    ]

    operations = [
        migrations.AddField(
            model_name="vault",
            name="currency_code",
            field=models.CharField(
                default="BRL",
                help_text="Código ISO 4217 da moeda (ex: BRL, USD, EUR)",
                max_length=3,
                verbose_name="Moeda",
            ),
        ),
    ]
