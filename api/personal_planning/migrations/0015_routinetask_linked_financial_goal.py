import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0014_add_unit_choices_and_ordering"),
        ("vaults", "0007_add_linked_fields_to_financial_goal"),
    ]

    operations = [
        migrations.AddField(
            model_name="routinetask",
            name="linked_financial_goal",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Meta financeira que este hábito alimenta"
                    " (ex: depósito mensal → meta de viagem)"
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="linked_routine_tasks",
                to="vaults.financialgoal",
                verbose_name="Meta Financeira Vinculada",
            ),
        ),
    ]
