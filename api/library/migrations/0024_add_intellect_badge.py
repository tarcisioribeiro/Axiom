import django.utils.timezone
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0023_course_completion_certificate"),
        ("members", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="IntellectBadge",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "uuid",
                    models.UUIDField(
                        editable=False,
                        unique=True,
                        verbose_name="UUID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="Criado em"
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True, verbose_name="Atualizado em"
                    ),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Deletado em"
                    ),
                ),
                (
                    "is_deleted",
                    models.BooleanField(
                        default=False, verbose_name="Está deletado"
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="members.member",
                        verbose_name="Criado por",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="members.member",
                        verbose_name="Atualizado por",
                    ),
                ),
                (
                    "deleted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="members.member",
                        verbose_name="Deletado por",
                    ),
                ),
                (
                    "code",
                    models.CharField(
                        choices=[
                            ("first_book", "Primeiro Livro Lido"),
                            (
                                "reader_5",
                                "Leitor Dedicado (5 livros)",
                            ),
                            (
                                "reader_10",
                                "Maratonista (10 livros)",
                            ),
                            (
                                "reader_25",
                                "Devorador de Livros (25 livros)",
                            ),
                            (
                                "first_course",
                                "Primeiro Curso Concluído",
                            ),
                            (
                                "learner_3",
                                "Aprendiz Ativo (3 cursos)",
                            ),
                            (
                                "learner_10",
                                "Especialista (10 cursos)",
                            ),
                            (
                                "streak_7",
                                "Leitura Constante (7 dias)",
                            ),
                            (
                                "streak_30",
                                "Leitura Consistente (30 dias)",
                            ),
                            ("first_highlight", "Primeiro Destaque"),
                            (
                                "annotator_10",
                                "Anotador (10 destaques)",
                            ),
                            (
                                "annotator_50",
                                "Curador (50 destaques)",
                            ),
                            (
                                "knowledge_builder",
                                "Construtor de Conhecimento (10 nós no grafo)",
                            ),
                            (
                                "knowledge_master",
                                "Mestre do Conhecimento (50 nós no grafo)",
                            ),
                            ("first_skill", "Primeira Habilidade"),
                            (
                                "skill_collector",
                                "Colecionador de Habilidades (5 habilidades)",
                            ),
                        ],
                        max_length=30,
                        verbose_name="Código",
                    ),
                ),
                (
                    "level",
                    models.CharField(
                        choices=[
                            ("bronze", "Bronze"),
                            ("silver", "Prata"),
                            ("gold", "Ouro"),
                        ],
                        default="bronze",
                        max_length=10,
                        verbose_name="Nível",
                    ),
                ),
                (
                    "awarded_at",
                    models.DateTimeField(
                        default=django.utils.timezone.now,
                        verbose_name="Concedido em",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="intellect_badges",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Conquista",
                "verbose_name_plural": "Conquistas",
                "ordering": ["-awarded_at"],
                "unique_together": {("owner", "code")},
            },
        ),
    ]
