import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security", "0017_password_hibp_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="credentialsharetoken",
            name="credential_type",
            field=models.CharField(
                choices=[
                    ("password", "Senha"),
                    ("stored_credit_card", "Cartão de Crédito"),
                    ("stored_bank_account", "Conta Bancária"),
                ],
                default="password",
                max_length=30,
                verbose_name="Tipo de Credencial",
            ),
        ),
        migrations.AddField(
            model_name="credentialsharetoken",
            name="stored_credit_card",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="share_tokens",
                to="security.storedcreditcard",
                verbose_name="Cartão Armazenado",
            ),
        ),
        migrations.AddField(
            model_name="credentialsharetoken",
            name="stored_bank_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="share_tokens",
                to="security.storedbankaccount",
                verbose_name="Conta Bancária Armazenada",
            ),
        ),
        migrations.AlterField(
            model_name="credentialsharetoken",
            name="password",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="share_tokens",
                to="security.password",
                verbose_name="Senha",
            ),
        ),
        migrations.AlterField(
            model_name="credentialsharetoken",
            name="_encrypted_password",
            field=models.TextField(
                verbose_name="Credencial (snapshot criptografado)"
            ),
        ),
    ]
