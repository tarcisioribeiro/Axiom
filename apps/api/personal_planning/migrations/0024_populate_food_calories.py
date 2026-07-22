# Data migration: populate calories_per_serving, serving_size, serving_unit
# for common foods based on typical Brazilian portions.

from django.db import migrations

FOOD_CALORIES = {
    # name (lower): (calories_per_serving, serving_size, serving_unit)
    # Proteins
    'frango':       (165, 100, 'g'),
    'carne bovina': (250, 100, 'g'),
    'peixe':        (120, 100, 'g'),
    'ovo':          (70,  1,   'unit'),
    'whey':         (120, 30,  'g'),
    # Carbs
    'arroz':        (130, 100, 'g'),
    'feijão':       (130, 100, 'g'),
    'tapioca':      (160, 100, 'g'),
    'batata':       (80,  100, 'g'),
    'mandioca':     (130, 100, 'g'),
    'aveia':        (380, 100, 'g'),
    # Dairy
    'iogurte':      (61,  100, 'g'),
    'mussarela':    (280, 30,  'g'),
    'requeijão':    (230, 30,  'g'),
    # Vegetables
    'alface':       (15,  100, 'g'),
    'tomate':       (20,  100, 'g'),
    'cenoura':      (35,  100, 'g'),
    'beterraba':    (40,  100, 'g'),
    'brócolis':     (34,  100, 'g'),
    'couve-flor':   (25,  100, 'g'),
    'chuchu':       (20,  100, 'g'),
    'vagem':        (25,  100, 'g'),
    'pepino':       (15,  100, 'g'),
    # Fruits
    'banana':       (89,  1,   'unit'),
    'maçã':         (52,  1,   'unit'),
    'mamão':        (40,  100, 'g'),
    'abacaxi':      (50,  100, 'g'),
    'melão':        (34,  100, 'g'),
}


def populate_calories(apps, schema_editor):
    Food = apps.get_model('personal_planning', 'Food')
    for food in Food.objects.filter(is_deleted=False):
        key = food.name.lower()
        if key in FOOD_CALORIES:
            cal, size, unit = FOOD_CALORIES[key]
            food.calories_per_serving = cal
            food.serving_size = size
            food.serving_unit = unit
            food.save(update_fields=[
                'calories_per_serving', 'serving_size', 'serving_unit'
            ])


def reverse_calories(apps, schema_editor):
    Food = apps.get_model('personal_planning', 'Food')
    Food.objects.filter(is_deleted=False).update(
        calories_per_serving=None, serving_size=None, serving_unit=None
    )


class Migration(migrations.Migration):

    dependencies = [
        ('personal_planning', '0023_workout_rest_food_calories_ingredient_alternatives'),  # noqa: E501
    ]

    operations = [
        migrations.RunPython(populate_calories, reverse_calories),
    ]
