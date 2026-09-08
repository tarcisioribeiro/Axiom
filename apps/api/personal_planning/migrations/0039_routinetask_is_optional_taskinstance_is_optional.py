from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0038_backfill_goal_end_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="routinetask",
            name="is_optional",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Tarefas opcionais nao impedem que o dia seja considerado"
                    " concluido nem quebram o streak"
                ),
                verbose_name="Tarefa Opcional",
            ),
        ),
        migrations.AddField(
            model_name="taskinstance",
            name="is_optional",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Tarefas opcionais nao impedem que o dia seja considerado"
                    " concluido nem quebram o streak"
                ),
                verbose_name="Tarefa Opcional",
            ),
        ),
    ]
