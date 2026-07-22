import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0027_skill_history"),
        ("members", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FlashCard",
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
                    "front",
                    models.TextField(verbose_name="Frente (pergunta)"),
                ),
                (
                    "back",
                    models.TextField(verbose_name="Verso (resposta)"),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("new", "Novo"),
                            ("learning", "Aprendendo"),
                            ("review", "Revisão"),
                            ("mastered", "Dominado"),
                        ],
                        default="new",
                        max_length=10,
                        verbose_name="Status",
                    ),
                ),
                (
                    "ease_factor",
                    models.FloatField(
                        default=2.5,
                        verbose_name="Fator de facilidade (SM-2)",
                    ),
                ),
                (
                    "interval_days",
                    models.PositiveIntegerField(
                        default=1, verbose_name="Intervalo (dias)"
                    ),
                ),
                (
                    "repetitions",
                    models.PositiveIntegerField(
                        default=0,
                        verbose_name="Repetições bem-sucedidas",
                    ),
                ),
                (
                    "next_review",
                    models.DateField(
                        default=django.utils.timezone.now,
                        verbose_name="Próxima revisão",
                    ),
                ),
                (
                    "last_reviewed",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Última revisão"
                    ),
                ),
                (
                    "book",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="flashcards",
                        to="library.book",
                        verbose_name="Livro",
                    ),
                ),
                (
                    "highlight",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="flashcards",
                        to="library.bookhighlight",
                        verbose_name="Destaque de origem",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="flashcards",
                        to="members.member",
                        verbose_name="Proprietário",
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
            ],
            options={
                "verbose_name": "Flash Card",
                "verbose_name_plural": "Flash Cards",
                "ordering": ["next_review", "created_at"],
            },
        ),
    ]
