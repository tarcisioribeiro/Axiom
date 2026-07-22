from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('library', '0018_reading_improvements'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='literarytypegoal',
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name='literarytypegoal',
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=('reading_goal', 'literary_type'),
                name='unique_literary_type_goal_active',
            ),
        ),
    ]
