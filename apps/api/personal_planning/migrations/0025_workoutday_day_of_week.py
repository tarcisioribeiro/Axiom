from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0024_populate_food_calories"),
    ]

    operations = [
        migrations.AddField(
            model_name="workoutday",
            name="day_of_week",
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                choices=[
                    (0, "Segunda-feira"),
                    (1, "Terça-feira"),
                    (2, "Quarta-feira"),
                    (3, "Quinta-feira"),
                    (4, "Sexta-feira"),
                    (5, "Sábado"),
                    (6, "Domingo"),
                ],
                help_text="Dia da semana em que esta divisão é executada (0=Seg, 6=Dom). Vazio = qualquer dia.",
                verbose_name="Dia da Semana",
            ),
        ),
    ]
