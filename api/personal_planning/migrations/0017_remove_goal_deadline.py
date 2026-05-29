from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0016_routinetask_linked_book"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="goal",
            name="deadline",
        ),
    ]
