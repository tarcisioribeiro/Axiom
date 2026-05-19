"""
Adiciona índice HNSW no pgvector para a coluna embedding de agent_embeddings.

Sem este índice, cada query de routing faz full scan O(n) na tabela.
Com HNSW, a busca é O(log n) com recall ~95%, latência <5ms para qualquer volume.

Parâmetros escolhidos:
  m = 16             — grau do grafo (tradeoff: recall vs memória)
  ef_construction = 64 — qualidade da construção (tradeoff: build time vs recall)
  ef_search = 40     — qualidade da busca (pode ser ajustado em runtime via SET)

Também cria índice composto (user_id, domain, is_deleted) para acelerar os
filtros aplicados antes da busca vetorial.

Apenas PostgreSQL — no-op em SQLite (ambiente de testes).
"""

from django.db import migrations


def add_hnsw_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    # Índice HNSW para busca por cosine distance
    schema_editor.execute(
        """
        CREATE INDEX IF NOT EXISTS agent_embeddings_embedding_hnsw_idx
        ON "vectors"."agent_embeddings"
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )
    # Índice composto para filtros de routing (user_id + domain + is_deleted)
    schema_editor.execute(
        """
        CREATE INDEX IF NOT EXISTS agent_embeddings_user_domain_active_idx
        ON "vectors"."agent_embeddings" (user_id, domain)
        WHERE is_deleted = FALSE
        """
    )


def drop_hnsw_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        "DROP INDEX IF EXISTS \"vectors\".agent_embeddings_embedding_hnsw_idx"
    )
    schema_editor.execute(
        "DROP INDEX IF EXISTS \"vectors\".agent_embeddings_user_domain_active_idx"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0004_agentembedding_audit_fields"),
    ]

    operations = [
        migrations.RunPython(add_hnsw_index, drop_hnsw_index),
    ]
