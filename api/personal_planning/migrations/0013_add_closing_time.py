from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "personal_planning",
            "0012_alter_routinetask_allowed_skips_per_month",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="routinetask",
            name="closing_time",
            field=models.TimeField(
                blank=True,
                null=True,
                verbose_name="Horário de Encerramento",
                help_text="Horário de encerramento (apenas para tarefas com uma ocorrência por dia)",
            ),
        ),
    ]
