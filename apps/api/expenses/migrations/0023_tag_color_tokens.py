import colorsys

from django.db import migrations, models

# HSL (h en graus 0-360, s/l em %) dos tokens de cor no tema padrão
# (apps/web/src/index.css :root) — usado só para achar, por
# aproximação de RGB, o token mais parecido com cada hex antigo.
TOKEN_HSL = {
    "primary": (252, 54, 54),
    "secondary": (49, 18, 36),
    "accent": (336, 78, 36),
    "destructive": (6, 66, 48),
    "success": (114, 84, 24),
    "warning": (24, 78, 36),
    "info": (198, 96, 30),
    "category-finance": (114, 84, 24),
    "category-health": (198, 96, 30),
    "category-studies": (228, 62, 42),
    "category-spiritual": (336, 78, 36),
    "category-exercise": (24, 78, 36),
    "category-nutrition": (48, 73, 30),
    "category-work": (49, 18, 36),
    "category-leisure": (6, 66, 48),
    "category-intellect": (265, 72, 42),
}


def _hsl_to_rgb(h, s, lightness):
    r, g, b = colorsys.hls_to_rgb(h / 360, lightness / 100, s / 100)
    return (r * 255, g * 255, b * 255)


TOKEN_RGB = {token: _hsl_to_rgb(*hsl) for token, hsl in TOKEN_HSL.items()}


def _nearest_token(hex_color):
    hex_color = (hex_color or "").lstrip("#")
    if len(hex_color) != 6:
        return "primary"
    try:
        rgb = tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return "primary"
    return min(
        TOKEN_RGB,
        key=lambda token: sum(
            (a - b) ** 2 for a, b in zip(TOKEN_RGB[token], rgb)
        ),
    )


def migrate_colors_to_tokens(apps, schema_editor):
    Tag = apps.get_model("expenses", "Tag")
    for tag in Tag.objects.all():
        if tag.color not in TOKEN_HSL:
            tag.color = _nearest_token(tag.color)
            tag.save(update_fields=["color"])


class Migration(migrations.Migration):

    dependencies = [
        (
            "expenses",
            "0022_fuse_categorization_into_automation_and_tag_unique",
        ),
    ]

    operations = [
        # Primeiro alarga a coluna (tokens são mais longos que "#rrggbb"),
        # só depois reescreve os valores — senão um hex antigo trocado por
        # um token longo não cabe na coluna ainda estreita no Postgres.
        migrations.AlterField(
            model_name="tag",
            name="color",
            field=models.CharField(
                choices=[
                    ("primary", "Primária"),
                    ("secondary", "Secundária"),
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
        migrations.RunPython(
            migrate_colors_to_tokens, migrations.RunPython.noop
        ),
    ]
