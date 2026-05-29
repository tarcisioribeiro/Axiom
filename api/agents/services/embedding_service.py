import logging
from typing import Callable

logger = logging.getLogger(__name__)


def generate_embedding_for_instance(
    instance,
    domain: str,
    source_type: str,
    content_fn: Callable,
    user=None,
    source_title: str | None = None,
) -> None:
    """
    Generate and upsert a vector embedding for a model instance.

    Silences all exceptions so embedding failures never break the main request.
    Intended to be called from transaction.on_commit() inside signal handlers.
    """
    from agents.core.llm_client import LLMClient
    from agents.models import AgentEmbedding

    try:
        resolved_user = (
            user if user is not None else getattr(instance, "created_by", None)
        )
        if resolved_user is None:
            return

        if instance.is_deleted:
            delete_embedding_for_instance(instance.uuid)
            return

        content = content_fn(instance)
        if not content or not content.strip():
            return

        embedding = LLMClient.embed(content)
        if not embedding:
            return

        resolved_title = (
            source_title if source_title is not None else str(instance)[:255]
        )

        AgentEmbedding.objects.update_or_create(
            user=resolved_user,
            source_id=instance.uuid,
            source_type=source_type,
            defaults={
                "domain": domain,
                "source_title": resolved_title[:255],
                "content": content,
                "embedding": embedding,
                "is_deleted": False,
            },
        )
    except Exception:
        logger.exception(
            "Embedding generation failed for %s %s",
            source_type,
            getattr(instance, "uuid", "?"),
        )


def delete_embedding_for_instance(source_id) -> None:
    """Mark an embedding as deleted without removing the record."""
    try:
        from agents.models import AgentEmbedding

        AgentEmbedding.objects.filter(source_id=source_id).update(
            is_deleted=True
        )
    except Exception:
        logger.exception(
            "Failed to mark embedding deleted for source_id %s", source_id
        )
