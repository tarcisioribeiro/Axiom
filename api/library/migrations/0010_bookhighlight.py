import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0009_book_reading_priority"),
        ("members", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BookHighlight",
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
                    "uuid",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        unique=True,
                        verbose_name="UUID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Criado em"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Atualizado em"),
                ),
                (
                    "is_deleted",
                    models.BooleanField(default=False, verbose_name="Excluído"),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Excluído em"
                    ),
                ),
                ("text", models.TextField(verbose_name="Texto")),
                (
                    "page_number",
                    models.PositiveIntegerField(
                        blank=True, null=True, verbose_name="Página"
                    ),
                ),
                (
                    "chapter",
                    models.CharField(
                        blank=True, max_length=200, null=True, verbose_name="Capítulo"
                    ),
                ),
                (
                    "highlight_type",
                    models.CharField(
                        choices=[
                            ("quote", "Citação"),
                            ("note", "Nota"),
                            ("idea", "Ideia"),
                        ],
                        default="quote",
                        max_length=10,
                        verbose_name="Tipo",
                    ),
                ),
                (
                    "color",
                    models.CharField(
                        choices=[
                            ("yellow", "Amarelo"),
                            ("green", "Verde"),
                            ("blue", "Azul"),
                            ("pink", "Rosa"),
                            ("orange", "Laranja"),
                        ],
                        default="yellow",
                        max_length=10,
                        verbose_name="Cor",
                    ),
                ),
                (
                    "book",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="highlights",
                        to="library.book",
                        verbose_name="Livro",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created",
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
                        related_name="%(class)s_deleted",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Excluído por",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="book_highlights",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
                (
                    "summary",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="highlights",
                        to="library.summary",
                        verbose_name="Resumo",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Atualizado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "Destaque",
                "verbose_name_plural": "Destaques",
                "ordering": ["page_number", "created_at"],
            },
        ),
    ]
