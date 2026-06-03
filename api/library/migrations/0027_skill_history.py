import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0026_skill_books_courses"),
        ("members", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SkillHistory",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "uuid",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, unique=True
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "deleted_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "is_deleted",
                    models.BooleanField(default=False),
                ),
                (
                    "proficiency",
                    models.CharField(
                        choices=[
                            ("beginner", "Iniciante"),
                            ("basic", "Básico"),
                            ("intermediate", "Intermediário"),
                            ("advanced", "Avançado"),
                            ("expert", "Especialista"),
                        ],
                        max_length=20,
                        verbose_name="Proficiência",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("learning", "Aprendendo"),
                            ("evolving", "Evoluindo"),
                            ("mastered", "Dominando"),
                        ],
                        max_length=20,
                        verbose_name="Status",
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True, null=True, verbose_name="Observações"
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Criado por",
                    ),
                ),
                (
                    "deleted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Deletado por",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Atualizado por",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="skill_history",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
                (
                    "skill",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="history",
                        to="library.skill",
                        verbose_name="Habilidade",
                    ),
                ),
            ],
            options={
                "verbose_name": "Histórico de Habilidade",
                "verbose_name_plural": "Histórico de Habilidades",
                "ordering": ["created_at"],
            },
        ),
    ]
