# Generated migration for CredentialShareToken model and shared_reveal action type

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "security",
            "0006_alter_archive_deleted_by_alter_password_deleted_by_and_more",
        ),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="activitylog",
            name="action",
            field=models.CharField(
                choices=[
                    ("view", "Visualização"),
                    ("create", "Criação"),
                    ("update", "Atualização"),
                    ("delete", "Exclusão"),
                    ("reveal", "Revelação de Senha/Credencial"),
                    ("download", "Download de Arquivo"),
                    ("login", "Login"),
                    ("logout", "Logout"),
                    ("failed_login", "Tentativa de Login Falha"),
                    ("other", "Outro"),
                    ("purge", "Purga de Dados (LGPD/GDPR)"),
                    ("shared_reveal", "Acesso via Link Compartilhado"),
                ],
                max_length=100,
                verbose_name="Ação",
            ),
        ),
        migrations.CreateModel(
            name="CredentialShareToken",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "token",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        unique=True,
                        verbose_name="Token",
                    ),
                ),
                (
                    "_encrypted_password",
                    models.TextField(verbose_name="Senha (snapshot criptografado)"),
                ),
                ("expires_at", models.DateTimeField(verbose_name="Expira em")),
                (
                    "used_at",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Último uso em"
                    ),
                ),
                (
                    "use_count",
                    models.IntegerField(default=0, verbose_name="Usos realizados"),
                ),
                (
                    "max_uses",
                    models.IntegerField(default=1, verbose_name="Máximo de usos"),
                ),
                (
                    "is_revoked",
                    models.BooleanField(default=False, verbose_name="Revogado"),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Criado em"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_share_tokens",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Criado por",
                    ),
                ),
                (
                    "password",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="share_tokens",
                        to="security.password",
                        verbose_name="Senha",
                    ),
                ),
            ],
            options={
                "verbose_name": "Token de Compartilhamento",
                "verbose_name_plural": "Tokens de Compartilhamento",
                "ordering": ["-created_at"],
            },
        ),
    ]
