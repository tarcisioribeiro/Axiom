from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security", "0016_password_history_totp_vault_health_snapshot_alert_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="password",
            name="hibp_compromised",
            field=models.BooleanField(
                blank=True,
                null=True,
                verbose_name="Comprometida (HIBP)",
            ),
        ),
        migrations.AddField(
            model_name="password",
            name="hibp_last_checked",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="Última verificação HIBP",
            ),
        ),
    ]
