import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EmbeddingDocument",
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
                (
                    "source_type",
                    models.CharField(
                        choices=[
                            ("book_summary", "Resumo de Livro"),
                            ("reading_note", "Nota de Leitura"),
                            ("book_highlight", "Destaque"),
                        ],
                        max_length=50,
                        verbose_name="Tipo de Fonte",
                    ),
                ),
                (
                    "source_id",
                    models.UUIDField(
                        help_text="UUID do objeto de origem (livro, leitura, etc.)",
                        verbose_name="ID da Fonte",
                    ),
                ),
                (
                    "source_title",
                    models.CharField(max_length=255, verbose_name="Título da Fonte"),
                ),
                (
                    "content",
                    models.TextField(verbose_name="Conteúdo do Chunk"),
                ),
                (
                    "embedding_json",
                    models.TextField(
                        blank=True,
                        default="[]",
                        help_text="Lista de floats serializada como JSON. Usada com pgvector em prod.",
                        verbose_name="Embedding (JSON)",
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
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="embedding_documents",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Usuário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Documento Vetorizado",
                "verbose_name_plural": "Documentos Vetorizados",
            },
        ),
        migrations.CreateModel(
            name="AgentConversation",
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
                (
                    "session_id",
                    models.CharField(
                        db_index=True, max_length=64, verbose_name="ID da Sessão"
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[("user", "Usuário"), ("agent", "Agente")],
                        max_length=10,
                        verbose_name="Papel",
                    ),
                ),
                (
                    "content",
                    models.TextField(verbose_name="Conteúdo"),
                ),
                (
                    "agent_name",
                    models.CharField(
                        blank=True, max_length=50, null=True, verbose_name="Agente"
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
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="agent_conversations",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Usuário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Conversa com Agente",
                "verbose_name_plural": "Conversas com Agentes",
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="embeddingdocument",
            index=models.Index(
                fields=["user", "source_type"],
                name="agents_embe_user_id_ebd899_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="embeddingdocument",
            index=models.Index(
                fields=["source_id"],
                name="agents_embe_source__2df8a4_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="agentconversation",
            index=models.Index(
                fields=["user", "session_id"],
                name="agents_agen_user_id_8b8795_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="agentconversation",
            index=models.Index(
                fields=["user", "-created_at"],
                name="agents_agen_user_id_b4d360_idx",
            ),
        ),
    ]
