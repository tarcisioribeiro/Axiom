from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("members", "0005_alter_member_deleted_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="email_verified",
            field=models.BooleanField(default=False, verbose_name="E-mail Verificado"),
        ),
        migrations.AddField(
            model_name="member",
            name="email_verification_token",
            field=models.UUIDField(
                blank=True, null=True, verbose_name="Token de Verificação de E-mail"
            ),
        ),
        migrations.AddField(
            model_name="member",
            name="email_verification_sent_at",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="Envio do Token de Verificação"
            ),
        ),
    ]
