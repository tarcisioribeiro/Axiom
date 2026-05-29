import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "library",
            "0019_replace_unique_together_with_partial_unique_constraint_on_literary_type_goal",
        ),
        ("personal_planning", "0015_routinetask_linked_financial_goal"),
    ]

    operations = [
        migrations.AddField(
            model_name="routinetask",
            name="linked_book",
            field=models.ForeignKey(
                blank=True,
                help_text="Livro em andamento vinculado a esta rotina de leitura",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="linked_routine_tasks",
                to="library.book",
                verbose_name="Livro Vinculado",
            ),
        ),
    ]
