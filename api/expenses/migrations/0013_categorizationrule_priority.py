# Generated manually for issue #118

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("expenses", "0012_expense_auto_categorized_categorizationrule"),
    ]

    operations = [
        migrations.AddField(
            model_name="categorizationrule",
            name="priority",
            field=models.PositiveIntegerField(
                default=100,
                help_text="Menor valor = maior prioridade. Regras com menor prioridade são avaliadas primeiro.",
                verbose_name="Prioridade",
            ),
        ),
        migrations.AlterModelOptions(
            name="categorizationrule",
            options={
                "ordering": ["priority", "created_at"],
                "verbose_name": "Regra de Categorização",
                "verbose_name_plural": "Regras de Categorização",
            },
        ),
    ]
