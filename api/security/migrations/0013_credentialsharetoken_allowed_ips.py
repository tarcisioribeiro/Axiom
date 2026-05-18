from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security", "0012_add_description_key_to_activity_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="credentialsharetoken",
            name="allowed_ips",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Lista de IPs autorizados a usar este token. Vazia = qualquer IP.",
                verbose_name="IPs Permitidos",
            ),
        ),
    ]
