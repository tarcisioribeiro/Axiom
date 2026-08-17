from datetime import timedelta

from django.db import migrations

AUTO_COMPLETION_GOAL_TYPES = ("consecutive_days", "total_days", "avoid_habit")


def backfill_end_date(apps, schema_editor):
    """
    Objetivos ativos dos tipos de contagem automatica passam a ter
    `end_date` sempre derivado de `start_date + target_value` dias
    (calculado a partir de agora em `Goal.save()`). Recalcula os
    registros ja existentes para que fiquem consistentes imediatamente,
    sem depender de um novo save() futuro.
    """
    Goal = apps.get_model("personal_planning", "Goal")
    goals = list(
        Goal.objects.filter(
            status="active",
            goal_type__in=AUTO_COMPLETION_GOAL_TYPES,
            deleted_at__isnull=True,
        )
    )
    if not goals:
        return
    for goal in goals:
        goal.end_date = goal.start_date + timedelta(days=goal.target_value)
    Goal.objects.bulk_update(goals, ["end_date"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0037_goal_best_streak_goalfailure"),
    ]

    operations = [
        migrations.RunPython(backfill_end_date, noop_reverse),
    ]
