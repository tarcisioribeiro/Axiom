"""Add created_by / updated_by to AgentEmbedding (vectors schema).

AgentEmbedding lives in a custom PostgreSQL schema (vectors.agent_embeddings),
so Django cannot issue standard ALTER TABLE directly.
We use SeparateDatabaseAndState: Django's state gets the FK fields; the actual
DB columns are added via raw SQL executed only on PostgreSQL.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def add_audit_columns(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        """
        ALTER TABLE "vectors"."agent_embeddings"
            ADD COLUMN IF NOT EXISTS created_by_id INTEGER
                REFERENCES auth_user(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS updated_by_id INTEGER
                REFERENCES auth_user(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS deleted_by_id INTEGER
                REFERENCES auth_user(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
        """
    )


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0003_agentconversation_query_id"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="agentembedding",
                    name="created_by",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_agent_embeddings",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Criado por",
                    ),
                ),
                migrations.AddField(
                    model_name="agentembedding",
                    name="updated_by",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_agent_embeddings",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Atualizado por",
                    ),
                ),
                migrations.AddField(
                    model_name="agentembedding",
                    name="deleted_by",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="deleted_agent_embeddings",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Excluído por",
                    ),
                ),
                migrations.AddField(
                    model_name="agentembedding",
                    name="deleted_at",
                    field=models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="Excluído em",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    add_audit_columns,
                    migrations.RunPython.noop,
                ),
            ],
        ),
    ]
