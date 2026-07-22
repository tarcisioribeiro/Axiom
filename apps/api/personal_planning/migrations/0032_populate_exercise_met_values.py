"""
Data migration: popula met_value nos exercícios já cadastrados com base em
correspondência de palavras-chave no nome e/ou grupos musculares.

Tabela de referência: Compendium of Physical Activities (2011) — Ainsworth et al.
Regra de cálculo: kcal = MET × peso_kg × horas_de_exercício
"""

from django.db import migrations

# ---------------------------------------------------------------------------
# Tabela fixa de MET por palavra-chave
# Cada entrada: (palavras_chave, met_value)
# A primeira correspondência encontrada (ordem importa) vence.
# ---------------------------------------------------------------------------
MET_KEYWORD_TABLE = [
    # --- Cardio de alta intensidade ---
    (["corrida", "run", "sprint", "tiro", "velocidade"], 9.8),
    (["pular corda", "jump rope", "corda"], 10.0),
    (["hiit", "tabata", "circuito", "circuit"], 8.0),
    (["escada", "stair", "step"], 8.0),
    (["natação", "natacao", "nado", "swim"], 7.0),
    (["remo", "rowing", "ergômetro", "ergometro"], 7.0),
    (["ciclismo", "bicicleta", "cycling", "spinning", "bike"], 7.5),
    (["elíptico", "eliptico", "elliptical"], 5.0),
    (["caminhada", "walk", "esteira"], 3.8),
    # --- Musculação / Força ---
    (["supino", "bench press"], 5.0),
    (["agachamento", "squat", "leg press", "hack squat"], 5.0),
    (["deadlift", "terra", "levantamento terra"], 6.0),
    (["puxada", "pulldown", "pull down", "remada", "row"], 5.0),
    (["barra fixa", "pull-up", "pullup", "chin-up"], 5.0),
    (["desenvolvimento", "overhead press", "ombro", "shoulder press"], 5.0),
    (["rosca", "curl", "bíceps", "biceps"], 3.5),
    (["tríceps", "triceps", "extensão", "extension"], 3.5),
    (["panturrilha", "calf", "raise"], 3.5),
    (["abdominal", "crunch", "sit-up", "situp", "core", "prancha", "plank"], 3.8),
    (["glúteo", "gluteo", "gluteus", "hip thrust"], 4.5),
    # --- Flexibilidade / Mente e corpo ---
    (["yoga"], 2.5),
    (["pilates"], 3.0),
    (["alongamento", "stretching", "mobilidade", "flexibility"], 2.3),
    (["meditação", "meditacao", "meditation"], 1.3),
    # --- Esportes ---
    (["futebol", "soccer", "football"], 7.0),
    (["basquete", "basquetebol", "basketball"], 6.5),
    (["vôlei", "volei", "volleyball"], 3.0),
    (["tênis", "tenis", "tennis"], 7.3),
    (["handebol", "handball"], 8.0),
    (["artes marciais", "jiu", "karatê", "karate", "boxe", "boxing", "luta"], 10.0),
    (["crossfit"], 8.0),
    (["funcional", "functional", "calistenia", "calisthenics"], 6.0),
]

DEFAULT_MET = 5.0  # musculação genérica


def _resolve_met(name: str, muscle_groups: str) -> float:
    text = f"{name} {muscle_groups or ''}".lower()
    for keywords, met in MET_KEYWORD_TABLE:
        if any(kw in text for kw in keywords):
            return met
    return DEFAULT_MET


def populate_met_values(apps, schema_editor):
    Exercise = apps.get_model("personal_planning", "Exercise")
    to_update = []
    for exercise in Exercise.objects.filter(is_deleted=False):
        met = _resolve_met(exercise.name, exercise.muscle_groups or "")
        exercise.met_value = met
        to_update.append(exercise)
    if to_update:
        Exercise.objects.bulk_update(to_update, ["met_value"])


def reverse_met_values(apps, schema_editor):
    Exercise = apps.get_model("personal_planning", "Exercise")
    Exercise.objects.filter(is_deleted=False).update(met_value=DEFAULT_MET)


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0031_exercise_met_value"),
    ]

    operations = [
        migrations.RunPython(populate_met_values, reverse_code=reverse_met_values),
    ]
