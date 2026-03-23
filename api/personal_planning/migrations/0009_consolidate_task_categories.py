from django.db import migrations

CATEGORY_MAPPING = {
    "studies": "intellect",
    "reading": "intellect",
    "writing": "intellect",
    "meditation": "spiritual",
    "leisure": "social",
    "family": "social",
}


def consolidate_categories(apps, schema_editor):
    RoutineTask = apps.get_model("personal_planning", "RoutineTask")
    TaskInstance = apps.get_model("personal_planning", "TaskInstance")

    for old_cat, new_cat in CATEGORY_MAPPING.items():
        RoutineTask.objects.filter(category=old_cat).update(category=new_cat)
        TaskInstance.objects.filter(category=old_cat).update(category=new_cat)


def reverse_consolidate_categories(apps, schema_editor):
    # Reversão não é possível de forma determinística (múltiplos valores → um),
    # então apenas mantemos o estado atual.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0008_alter_dailyreflection_deleted_by_and_more"),
    ]

    operations = [
        migrations.RunPython(
            consolidate_categories,
            reverse_consolidate_categories,
        ),
    ]
