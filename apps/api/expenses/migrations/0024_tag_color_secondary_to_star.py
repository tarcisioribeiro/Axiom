from django.db import migrations, models


def secondary_to_star(apps, schema_editor):
    Tag = apps.get_model("expenses", "Tag")
    Tag.objects.filter(color="secondary").update(color="star")


def star_to_secondary(apps, schema_editor):
    Tag = apps.get_model("expenses", "Tag")
    Tag.objects.filter(color="star").update(color="secondary")


class Migration(migrations.Migration):

    dependencies = [
        ("expenses", "0023_tag_color_tokens"),
    ]

    operations = [
        migrations.RunPython(secondary_to_star, star_to_secondary),
        migrations.AlterField(
            model_name="tag",
            name="color",
            field=models.CharField(
                choices=[
                    ("primary", "Primária"),
                    ("star", "Dourado"),
                    ("accent", "Destaque"),
                    ("destructive", "Alerta"),
                    ("success", "Sucesso"),
                    ("warning", "Atenção"),
                    ("info", "Informação"),
                    ("category-finance", "Financeiro"),
                    ("category-health", "Saúde"),
                    ("category-studies", "Estudos"),
                    ("category-spiritual", "Espiritual"),
                    ("category-exercise", "Exercício"),
                    ("category-nutrition", "Nutrição"),
                    ("category-work", "Trabalho"),
                    ("category-leisure", "Lazer"),
                    ("category-intellect", "Intelecto"),
                ],
                default="primary",
                help_text=(
                    "Token de cor do tema (ex.: primary, category-finance)"
                ),
                max_length=24,
                verbose_name="Cor",
            ),
        ),
    ]
