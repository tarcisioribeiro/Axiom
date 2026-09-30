from django.db import migrations, models
from django.utils import timezone


def dedupe_focus_block_tasks(apps, schema_editor):
    """
    Uma tarefa (ou ocorrência) passa a pertencer a no máximo um bloco de foco.
    Soft-deleta os vínculos de blocos já excluídos e, entre os duplicados,
    mantém o vínculo mais antigo.
    """
    FocusBlockTask = apps.get_model("personal_planning", "FocusBlockTask")
    now = timezone.now()
    active = FocusBlockTask.objects.filter(deleted_at__isnull=True)
    active.filter(focus_block__deleted_at__isnull=False).update(deleted_at=now)

    kept = {}  # routine_task_id -> [(focus_block_id, occurrence_index)]
    duplicates = []
    for link in active.filter(focus_block__deleted_at__isnull=True).order_by(
        "id"
    ):
        others = kept.setdefault(link.routine_task_id, [])
        if any(
            block_id != link.focus_block_id
            and (occ is None or link.occurrence_index in (None, occ))
            for block_id, occ in others
        ):
            duplicates.append(link.id)
        else:
            others.append((link.focus_block_id, link.occurrence_index))
    FocusBlockTask.objects.filter(id__in=duplicates).update(deleted_at=now)


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0046_remove_focusblock_color"),
    ]

    operations = [
        migrations.RunPython(
            dedupe_focus_block_tasks, migrations.RunPython.noop
        ),
        migrations.RemoveConstraint(
            model_name="focusblocktask",
            name="unique_focus_block_task_occurrence",
        ),
        migrations.RemoveConstraint(
            model_name="focusblocktask",
            name="unique_focus_block_task_whole",
        ),
        migrations.AddConstraint(
            model_name="focusblocktask",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=("routine_task", "occurrence_index"),
                name="unique_focus_block_task_occurrence",
            ),
        ),
        migrations.AddConstraint(
            model_name="focusblocktask",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    deleted_at__isnull=True, occurrence_index__isnull=True
                ),
                fields=("routine_task",),
                name="unique_focus_block_task_whole",
            ),
        ),
    ]
