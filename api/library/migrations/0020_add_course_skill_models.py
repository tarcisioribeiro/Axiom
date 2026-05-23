import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "library",
            "0019_replace_unique_together_with_partial_unique_constraint_on_literary_type_goal",
        ),
        ("members", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Course",
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
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                ("title", models.CharField(max_length=200, verbose_name="Título")),
                (
                    "platform",
                    models.CharField(
                        choices=[
                            ("udemy", "Udemy"),
                            ("coursera", "Coursera"),
                            ("youtube", "YouTube"),
                            ("linkedin", "LinkedIn Learning"),
                            ("alura", "Alura"),
                            ("pluralsight", "Pluralsight"),
                            ("other", "Outro"),
                        ],
                        default="other",
                        max_length=20,
                        verbose_name="Plataforma",
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("technology", "Tecnologia"),
                            ("languages", "Idiomas"),
                            ("design", "Design"),
                            ("business", "Negócios"),
                            ("science", "Ciências"),
                            ("arts", "Artes"),
                            ("other", "Outro"),
                        ],
                        default="technology",
                        max_length=20,
                        verbose_name="Categoria",
                    ),
                ),
                ("description", models.TextField(blank=True, null=True, verbose_name="Descrição")),
                ("url", models.URLField(blank=True, null=True, verbose_name="Link")),
                (
                    "estimated_hours",
                    models.DecimalField(
                        blank=True,
                        decimal_places=1,
                        max_digits=6,
                        null=True,
                        verbose_name="Carga horária estimada (h)",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("not_started", "Não iniciado"),
                            ("in_progress", "Em andamento"),
                            ("completed", "Concluído"),
                            ("paused", "Pausado"),
                        ],
                        default="not_started",
                        max_length=20,
                        verbose_name="Status",
                    ),
                ),
                ("start_date", models.DateField(blank=True, null=True, verbose_name="Data de início")),
                ("end_date", models.DateField(blank=True, null=True, verbose_name="Data de conclusão")),
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
                        related_name="courses",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Curso",
                "verbose_name_plural": "Cursos",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="CourseModule",
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
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                ("title", models.CharField(max_length=200, verbose_name="Título")),
                ("order", models.PositiveIntegerField(default=1, verbose_name="Ordem")),
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
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="modules",
                        to="library.course",
                        verbose_name="Curso",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="course_modules",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Módulo",
                "verbose_name_plural": "Módulos",
                "ordering": ["order", "created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="CourseLesson",
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
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                ("title", models.CharField(max_length=200, verbose_name="Título")),
                ("order", models.PositiveIntegerField(default=1, verbose_name="Ordem")),
                ("is_completed", models.BooleanField(default=False, verbose_name="Concluída")),
                ("completed_at", models.DateTimeField(blank=True, null=True, verbose_name="Concluída em")),
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
                    "module",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lessons",
                        to="library.coursemodule",
                        verbose_name="Módulo",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="course_lessons",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Aula",
                "verbose_name_plural": "Aulas",
                "ordering": ["order", "created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="CourseSession",
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
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                (
                    "session_date",
                    models.DateField(
                        default=django.utils.timezone.now,
                        verbose_name="Data da Sessão",
                    ),
                ),
                ("duration_minutes", models.PositiveIntegerField(default=60, verbose_name="Duração (minutos)")),
                ("notes", models.TextField(blank=True, null=True, verbose_name="Anotações")),
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
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="library.course",
                        verbose_name="Curso",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="course_sessions",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Sessão de Estudo",
                "verbose_name_plural": "Sessões de Estudo",
                "ordering": ["-session_date", "-created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="Skill",
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
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                ("name", models.CharField(max_length=200, verbose_name="Nome")),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("technology", "Tecnologia"),
                            ("languages", "Idiomas"),
                            ("design", "Design"),
                            ("business", "Negócios"),
                            ("science", "Ciências"),
                            ("arts", "Artes"),
                            ("other", "Outro"),
                        ],
                        default="technology",
                        max_length=20,
                        verbose_name="Categoria",
                    ),
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
                        default="beginner",
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
                        default="learning",
                        max_length=20,
                        verbose_name="Status",
                    ),
                ),
                ("notes", models.TextField(blank=True, null=True, verbose_name="Observações")),
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
                        related_name="skills",
                        to="members.member",
                        verbose_name="Proprietário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Habilidade",
                "verbose_name_plural": "Habilidades",
                "ordering": ["category", "name"],
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["name", "owner"],
                name="unique_skill_name_owner_active",
            ),
        ),
    ]
