"""
Altera Archive.tags de varchar[] (ArrayField) para jsonb (JSONField).

A migration anterior (0010) criou o campo como ArrayField(CharField) — que gera
varchar[] no PostgreSQL. Esta migration converte para JSONField (jsonb), que
funciona tanto em PostgreSQL quanto em SQLite (usado nos testes).
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('security', '0010_security_improvements'),
    ]

    operations = [
        migrations.AlterField(
            model_name='archive',
            name='tags',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Lista de tags para categorização e busca',
                verbose_name='Tags',
            ),
        ),
    ]
