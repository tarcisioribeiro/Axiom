from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="library.Skill")
def record_skill_history(sender, instance, created, **kwargs):
    """Registra histórico quando proficiência ou status muda."""
    from library.models import SkillHistory

    if not instance.owner_id:
        return

    def _record():
        last = (
            SkillHistory.objects.filter(skill=instance)
            .order_by("-created_at")
            .first()
        )
        if (
            last is None
            or last.proficiency != instance.proficiency
            or last.status != instance.status
        ):
            SkillHistory.objects.create(
                skill=instance,
                proficiency=instance.proficiency,
                status=instance.status,
                notes=instance.notes,
                owner=instance.owner,
                created_by=instance.updated_by or instance.created_by,
                updated_by=instance.updated_by or instance.created_by,
            )

    transaction.on_commit(_record)


@receiver(post_save, sender="library.BookHighlight")
def embed_book_highlight(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    if not instance.text:
        return

    try:
        book_title = instance.book.title if instance.book_id else ""
    except Exception:
        book_title = ""

    page_info = f" p.{instance.page_number}" if instance.page_number else ""
    source_title = (
        f"{book_title}{page_info}" if book_title else str(instance.id)
    )

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="library",
            source_type="book_highlight",
            content_fn=lambda i: i.text,
            source_title=source_title,
        )

    transaction.on_commit(_embed)


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
