from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0005_grupo3_novos_modelos"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="currency_code",
            field=models.CharField(
                default="BRL",
                help_text="Código ISO 4217 da moeda (ex: BRL, USD, EUR)",
                max_length=3,
                verbose_name="Moeda",
            ),
        ),
    ]
