from django.db import migrations, models

# Exclusões antigas só preenchiam deleted_at; quem filtra por is_deleted
# (revisão diária, ActiveManager) ainda via os registros.
SOFT_DELETED = (
    "RoutineTask",
    "FocusBlock",
    "FocusBlockTask",
    "UserRoutineTemplate",
    "Goal",
    "DailyReflection",
    "TaskInstance",
)


def sync_is_deleted(apps, schema_editor):
    for name in SOFT_DELETED:
        apps.get_model("personal_planning", name).objects.filter(
            deleted_at__isnull=False, is_deleted=False
        ).update(is_deleted=True)


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0050_alter_goal_start_date"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="goalfailure",
            options={
                "ordering": ["-failure_date", "-failure_time"],
                "verbose_name": "Falha de Objetivo",
                "verbose_name_plural": "Falhas de Objetivos",
            },
        ),
        migrations.AddField(
            model_name="goalfailure",
            name="failure_time",
            field=models.TimeField(
                blank=True, null=True, verbose_name="Hora da Falha"
            ),
        ),
        migrations.RunPython(sync_is_deleted, migrations.RunPython.noop),
    ]
