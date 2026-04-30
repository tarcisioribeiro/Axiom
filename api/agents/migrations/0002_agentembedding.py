import uuid

import django.db.models.deletion
import pgvector.django
from django.conf import settings
from django.db import migrations, models


def create_extension_and_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("CREATE EXTENSION IF NOT EXISTS vector")
    schema_editor.execute("CREATE SCHEMA IF NOT EXISTS vectors")


def create_agent_embeddings_table(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        """
        CREATE TABLE IF NOT EXISTS "vectors"."agent_embeddings" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL
                REFERENCES auth_user(id) ON DELETE CASCADE,
            domain VARCHAR(20) NOT NULL,
            source_type VARCHAR(50) NOT NULL,
            source_id UUID NOT NULL,
            source_title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            embedding vector(768),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def create_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        """
        CREATE INDEX IF NOT EXISTS agents_agentembedding_embedding_ivfflat_idx
        ON "vectors"."agent_embeddings"
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )
    schema_editor.execute(
        """
        CREATE INDEX IF NOT EXISTS agents_agentembedding_user_domain_idx
        ON "vectors"."agent_embeddings" (user_id, domain)
        """
    )
    schema_editor.execute(
        """
        CREATE INDEX IF NOT EXISTS agents_agentembedding_source_id_idx
        ON "vectors"."agent_embeddings" (source_id)
        """
    )


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Step 1: PostgreSQL extension and schema
        migrations.RunPython(
            create_extension_and_schema,
            migrations.RunPython.noop,
        ),
        # Step 2: AgentEmbedding table — state tracked by Django, created via raw
        # SQL on PostgreSQL (schema-qualified tables are not supported by SQLite)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="AgentEmbedding",
                    fields=[
                        (
                            "id",
                            models.UUIDField(
                                default=uuid.uuid4,
                                editable=False,
                                primary_key=True,
                                serialize=False,
                                verbose_name="ID",
                            ),
                        ),
                        (
                            "domain",
                            models.CharField(
                                choices=[
                                    ("finance", "Finanças"),
                                    ("budget", "Orçamento"),
                                    ("planning", "Planejamento"),
                                    ("library", "Biblioteca"),
                                    ("general", "Geral"),
                                ],
                                max_length=20,
                                verbose_name="Domínio",
                            ),
                        ),
                        (
                            "source_type",
                            models.CharField(
                                choices=[
                                    ("expense", "Despesa"),
                                    ("revenue", "Receita"),
                                    ("budget", "Orçamento"),
                                    ("task", "Tarefa"),
                                    ("goal", "Meta"),
                                    ("routine", "Rotina"),
                                    ("book_summary", "Resumo de Livro"),
                                    ("reading_note", "Nota de Leitura"),
                                    ("highlight", "Destaque"),
                                    ("credit_card_bill", "Fatura de Cartão"),
                                ],
                                max_length=50,
                                verbose_name="Tipo de Fonte",
                            ),
                        ),
                        (
                            "source_id",
                            models.UUIDField(verbose_name="ID da Fonte"),
                        ),
                        (
                            "source_title",
                            models.CharField(
                                max_length=255, verbose_name="Título da Fonte"
                            ),
                        ),
                        (
                            "content",
                            models.TextField(verbose_name="Conteúdo"),
                        ),
                        (
                            "embedding",
                            pgvector.django.VectorField(
                                dimensions=768, verbose_name="Embedding"
                            ),
                        ),
                        (
                            "is_deleted",
                            models.BooleanField(default=False, verbose_name="Excluído"),
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
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="agent_embeddings",
                                to=settings.AUTH_USER_MODEL,
                                verbose_name="Usuário",
                            ),
                        ),
                    ],
                    options={
                        "verbose_name": "Embedding de Agente",
                        "verbose_name_plural": "Embeddings de Agentes",
                        "db_table": '"vectors"."agent_embeddings"',
                    },
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    create_agent_embeddings_table,
                    migrations.RunPython.noop,
                ),
            ],
        ),
        # Step 3: Indexes — created via raw SQL (IvfflatIndex names exceed Django's
        # 30-char limit for Meta declarations; created directly in PostgreSQL).
        migrations.RunPython(
            create_indexes,
            migrations.RunPython.noop,
        ),
    ]
