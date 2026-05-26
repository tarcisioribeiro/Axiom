from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="library.Summary")
def embed_book_summary(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    # Resolve book title at signal time to avoid lazy load inside on_commit
    try:
        book_title = instance.book.title if instance.book_id else ""
    except Exception:
        book_title = ""
    source_title = (
        f"{book_title} — {instance.title}" if book_title else instance.title
    )

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="library",
            source_type="book_summary",
            content_fn=lambda i: i.text,
            source_title=source_title,
        )

    transaction.on_commit(_embed)


@receiver(post_save, sender="library.Reading")
def embed_reading_note(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    if not instance.notes:
        return

    try:
        book_title = instance.book.title if instance.book_id else ""
    except Exception:
        book_title = ""
    source_title = (
        f"{book_title} ({instance.reading_date})"
        if book_title
        else str(instance.reading_date)
    )

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="library",
            source_type="reading_note",
            content_fn=lambda i: i.notes or "",
            source_title=source_title,
        )

    transaction.on_commit(_embed)
