# Generated manually to record updated TASK_CATEGORY_CHOICES after
# 0009_consolidate_task_categories removed legacy values (studies, meditation,
# reading, writing, leisure, family) and added intellect.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0009_consolidate_task_categories"),
    ]

    operations = [
        migrations.AlterField(
            model_name="routinetask",
            name="category",
            field=models.CharField(
                choices=[
                    ("health", "Saúde"),
                    ("intellect", "Intelecto"),
                    ("spiritual", "Espiritual"),
                    ("exercise", "Exercício Físico"),
                    ("nutrition", "Nutrição"),
                    ("work", "Trabalho"),
                    ("social", "Social"),
                    ("finance", "Finanças"),
                    ("household", "Casa"),
                    ("personal_care", "Cuidado Pessoal"),
                    ("other", "Outros"),
                ],
                max_length=50,
                null=False,
                blank=False,
                verbose_name="Categoria",
            ),
        ),
        migrations.AlterField(
            model_name="taskinstance",
            name="category",
            field=models.CharField(
                choices=[
                    ("health", "Saúde"),
                    ("intellect", "Intelecto"),
                    ("spiritual", "Espiritual"),
                    ("exercise", "Exercício Físico"),
                    ("nutrition", "Nutrição"),
                    ("work", "Trabalho"),
                    ("social", "Social"),
                    ("finance", "Finanças"),
                    ("household", "Casa"),
                    ("personal_care", "Cuidado Pessoal"),
                    ("other", "Outros"),
                ],
                max_length=50,
                verbose_name="Categoria",
            ),
        ),
    ]
