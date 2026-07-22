from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security", "0018_credentialsharetoken_extend"),
    ]

    operations = [
        migrations.AddField(
            model_name="password",
            name="strength_score",
            field=models.IntegerField(
                default=0,
                help_text="0=Muito Fraca, 1=Fraca, 2=Razoável, 3=Boa, 4=Forte",
                verbose_name="Força da Senha (0-4)",
            ),
        ),
    ]
