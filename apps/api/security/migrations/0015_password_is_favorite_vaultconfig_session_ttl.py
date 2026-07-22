from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security", "0014_add_vault_recovery_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="password",
            name="is_favorite",
            field=models.BooleanField(default=False, verbose_name="Favorito"),
        ),
        migrations.AddField(
            model_name="vaultconfig",
            name="session_ttl_minutes",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name="TTL da Sessão (minutos)",
                help_text="Tempo de sessão do cofre em minutos. Mín: 15, Máx: 240.",
            ),
        ),
    ]
