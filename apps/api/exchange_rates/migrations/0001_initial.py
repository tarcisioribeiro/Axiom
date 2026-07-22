import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ExchangeRate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("currency_from", models.CharField(help_text="Código ISO 4217 (ex: USD, EUR)", max_length=3, verbose_name="Moeda de origem")),
                ("rate_buy", models.DecimalField(decimal_places=8, help_text="Cotação de compra PTAX", max_digits=20, verbose_name="Taxa de compra (BRL)")),
                ("rate_sell", models.DecimalField(decimal_places=8, help_text="Cotação de venda PTAX", max_digits=20, verbose_name="Taxa de venda (BRL)")),
                ("reference_date", models.DateField(db_index=True, help_text="Data para a qual esta taxa é válida", verbose_name="Data de referência")),
                ("source", models.CharField(default="BCB_PTAX", max_length=50, verbose_name="Fonte")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exchangerate_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exchangerate_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exchangerate_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Taxa de Câmbio",
                "verbose_name_plural": "Taxas de Câmbio",
                "ordering": ["-reference_date", "currency_from"],
                "unique_together": {("currency_from", "reference_date")},
                "indexes": [
                    models.Index(fields=["currency_from", "-reference_date"], name="exchange_rates_currency_date_idx"),
                ],
            },
        ),
    ]
