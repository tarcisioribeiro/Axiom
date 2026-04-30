import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemConfig",
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
                    "key",
                    models.CharField(
                        max_length=100, unique=True, verbose_name="Chave"
                    ),
                ),
                (
                    "_value",
                    models.TextField(
                        blank=True,
                        null=True,
                        verbose_name="Valor (criptografado se secret)",
                    ),
                ),
                (
                    "is_secret",
                    models.BooleanField(default=False, verbose_name="É secreto"),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("llm", "LLM / Agentes"),
                            ("email", "Email"),
                            ("backup", "Backup"),
                            ("app", "Aplicação"),
                            ("security", "Segurança"),
                            ("storage", "Armazenamento (MinIO)"),
                        ],
                        max_length=50,
                        verbose_name="Categoria",
                    ),
                ),
                (
                    "label",
                    models.CharField(max_length=200, verbose_name="Label"),
                ),
                (
                    "description",
                    models.TextField(blank=True, verbose_name="Descrição"),
                ),
                (
                    "requires_restart",
                    models.BooleanField(
                        default=False, verbose_name="Requer reinicialização"
                    ),
                ),
                (
                    "is_editable",
                    models.BooleanField(default=True, verbose_name="Editável"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True, verbose_name="Atualizado em"
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Atualizado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "Configuração do Sistema",
                "verbose_name_plural": "Configurações do Sistema",
                "ordering": ["category", "key"],
            },
        ),
    ]
