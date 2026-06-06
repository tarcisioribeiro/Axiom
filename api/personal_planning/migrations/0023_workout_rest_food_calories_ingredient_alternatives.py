# Generated migration for:
# - WorkoutExercise.rest_seconds
# - Food.calories_per_serving, serving_size, serving_unit
# - MenuOptionIngredient.alternative_group

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('personal_planning', '0022_badge_icon_lucide'),
    ]

    operations = [
        # rest_seconds on WorkoutExercise
        migrations.AddField(
            model_name='workoutexercise',
            name='rest_seconds',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name='Descanso (segundos)',
                help_text='Tempo de descanso entre séries em segundos',
            ),
        ),
        # calorie fields on Food
        migrations.AddField(
            model_name='food',
            name='calories_per_serving',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=8,
                null=True,
                verbose_name='Calorias por Porção (kcal)',
                help_text='Quantidade de calorias para a porção de referência',
            ),
        ),
        migrations.AddField(
            model_name='food',
            name='serving_size',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=8,
                null=True,
                verbose_name='Tamanho da Porção',
                help_text='Quantidade numérica da porção de referência',
            ),
        ),
        migrations.AddField(
            model_name='food',
            name='serving_unit',
            field=models.CharField(
                blank=True,
                choices=[
                    ('g', 'g'),
                    ('kg', 'kg'),
                    ('mg', 'mg'),
                    ('lb', 'lb'),
                    ('oz', 'oz'),
                    ('ml', 'ml'),
                    ('l', 'l'),
                    ('dl', 'dl'),
                    ('cl', 'cl'),
                    ('teaspoon', 'colher de chá'),
                    ('tablespoon', 'colher de sopa'),
                    ('dessert_spoon', 'colher de sobremesa'),
                    ('cup', 'xícara'),
                    ('glass', 'copo'),
                    ('slice', 'fatia'),
                    ('portion', 'porção'),
                    ('pinch', 'pitada'),
                    ('drizzle', 'fio'),
                    ('to_taste', 'a gosto'),
                    ('at_will', 'à vontade'),
                    ('unit', 'unidade'),
                    ('piece', 'peça'),
                    ('segment', 'gomo'),
                    ('clove', 'dente'),
                    ('leaf', 'folha'),
                    ('sprig', 'ramo'),
                    ('handful', 'punhado'),
                    ('scoop', 'scoop'),
                    ('rep', 'repetição'),
                    ('set', 'série'),
                    ('minute', 'minuto'),
                    ('second', 'segundo'),
                    ('hour', 'hora'),
                    ('km', 'km'),
                    ('m', 'metro'),
                    ('step', 'passo'),
                    ('dose', 'dose'),
                    ('tablet', 'comprimido'),
                    ('capsule', 'cápsula'),
                    ('mcg', 'mcg'),
                    ('ui', 'UI'),
                ],
                max_length=20,
                null=True,
                verbose_name='Unidade da Porção',
                help_text=(
                    'Unidade da porção de referência (ex: g, unidade, scoop)'
                ),
            ),
        ),
        # alternative_group on MenuOptionIngredient
        migrations.AddField(
            model_name='menuoptioningredient',
            name='alternative_group',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name='Grupo de Alternativas',
                help_text=(
                    'Ingredientes com o mesmo número nesta opção de '
                    'cardápio são alternativas entre si '
                    '(ex: 3 ovos OU 120g carne OU 140g frango)'
                ),
            ),
        ),
        # update ordering for MenuOptionIngredient
        migrations.AlterModelOptions(
            name='menuoptioningredient',
            options={
                'ordering': ['menu_option', 'alternative_group', 'order'],
                'verbose_name': 'Ingrediente da Opção',
                'verbose_name_plural': 'Ingredientes da Opção',
            },
        ),
    ]
