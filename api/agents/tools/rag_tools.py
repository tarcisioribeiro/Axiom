import json
import logging
import math
from typing import Any, cast

from django.contrib.auth.models import User
from django.db import connection

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Similaridade de cosseno — fallback Python para SQLite (testes)."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _is_postgres() -> bool:
    return "postgresql" in connection.settings_dict.get("ENGINE", "")


def search_embeddings(
    query: str, user: User, domain: str, top_k: int = 5
) -> list[dict[str, Any]]:
    """
    Busca semântica na tabela vectors.agent_embeddings filtrando por domínio.
    Usa pgvector no Postgres e similaridade Python no SQLite (testes).
    """
    from agents.core.llm_client import LLMClient

    query_embedding = LLMClient.embed(query)
    if not query_embedding:
        return _fallback_keyword_search(query, user, domain, top_k)

    if _is_postgres():
        return _pgvector_search(query_embedding, user, domain, top_k)
    return _python_search(query_embedding, user, domain, top_k)


def _pgvector_search(
    embedding: list[float], user: User, domain: str, top_k: int
) -> list[dict[str, Any]]:
    """Busca vetorial com pgvector via operador <=> (cosine distance)."""
    embedding_str = "[" + ",".join(f"{x:.6f}" for x in embedding) + "]"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT content, source_title, source_type,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM "vectors"."agent_embeddings"
            WHERE user_id = %s AND domain = %s AND is_deleted = FALSE
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            [embedding_str, user.pk, domain, embedding_str, top_k],
        )
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _python_search(
    query_embedding: list[float], user: User, domain: str, top_k: int
) -> list[dict[str, Any]]:
    """
    Busca por similaridade de cosseno em Python — usado em testes (SQLite).
    """
    from agents.models import AgentEmbedding

    docs = AgentEmbedding.objects.filter(
        user=user, domain=domain, is_deleted=False
    ).values("content", "source_title", "source_type", "embedding")
    scored = []
    for doc in docs:
        emb = doc["embedding"]
        if isinstance(emb, str):
            try:
                emb = json.loads(emb)
            except (json.JSONDecodeError, TypeError):
                continue
        if not emb:
            continue
        sim = _cosine_similarity(query_embedding, list(emb))
        scored.append(
            {
                "content": doc["content"],
                "source_title": doc["source_title"],
                "source_type": doc["source_type"],
                "similarity": sim,
            }
        )
    scored.sort(key=lambda x: cast(float, x["similarity"]), reverse=True)
    return scored[:top_k]


def _fallback_keyword_search(
    query: str, user: User, domain: str, top_k: int
) -> list[dict[str, Any]]:
    """
    Busca por palavras-chave quando o LLM de embeddings está indisponível.
    """
    from django.db.models import Q

    from agents.models import AgentEmbedding

    words = query.lower().split()
    if not words:
        return []

    q_filter = Q()
    for word in words[:5]:
        q_filter |= Q(content__icontains=word)

    docs = (
        AgentEmbedding.objects.filter(
            user=user, domain=domain, is_deleted=False
        )
        .filter(q_filter)
        .values("content", "source_title", "source_type")[:top_k]
    )

    return [
        {
            "content": d["content"],
            "source_title": d["source_title"],
            "source_type": d["source_type"],
            "similarity": 0.5,
        }
        for d in docs
    ]


def search_library_chunks(
    query: str, user: User, top_k: int = 5
) -> list[dict[str, Any]]:
    """
    Compat shim: redireciona para search_embeddings com domain='library'.
    Mantido para não quebrar LibraryAgent e index_library command.
    """
    return search_embeddings(query, user, domain="library", top_k=top_k)
