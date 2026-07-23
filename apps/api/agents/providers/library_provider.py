"""
Ponto único de acesso ao ORM de `library` a partir de `agents/`.

Só este pacote (`agents/providers/`) importa models de outros apps — o
restante de `agents/` (tools, agents de domínio, views) consome estas
funções. Ver documentation/architecture/agents-llm-boundary.md.
"""

from datetime import date
from typing import Any

from django.contrib.auth.models import User


def recent_books(
    user: User, start: date | None, end: date | None, limit: int = 10
) -> list[dict[str, Any]]:
    from library.models import Book

    qs = Book.objects.filter(owner__user=user, is_deleted=False)
    if start is not None and end is not None:
        qs = qs.filter(updated_at__date__range=(start, end))
    rows: Any = qs.values("title", "genre").order_by("-updated_at")[:limit]
    return list(rows)


def recent_books_detailed(
    user: User, start: date | None, end: date | None, limit: int = 8
) -> list[dict[str, Any]]:
    from library.models import Book

    qs = Book.objects.filter(owner__user=user, is_deleted=False)
    if start and end:
        qs = qs.filter(updated_at__date__range=(start, end))
    rows: Any = qs.values(
        "id", "title", "genre", "read_status", "pages", "rating"
    ).order_by("-updated_at")[:limit]
    return list(rows)


def reading_pages_read(book_id: Any) -> int:
    from django.db.models import Sum

    from library.models import Reading

    return (
        Reading.objects.filter(book_id=book_id, is_deleted=False).aggregate(
            total=Sum("pages_read")
        )["total"]
        or 0
    )


def course_progress(user: User, limit: int = 6) -> list[dict[str, Any]]:
    from library.models import Course, CourseSession

    courses = list(
        Course.objects.filter(owner__user=user, is_deleted=False)
        .values("id", "title", "platform", "status")
        .order_by("-updated_at")[:limit]
    )
    result = []
    for c in courses:
        sessions_count = CourseSession.objects.filter(
            course_id=c["id"], is_deleted=False
        ).count()
        result.append({**c, "sessions_count": sessions_count})
    return result


def skills(user: User, limit: int = 12) -> list[dict[str, Any]]:
    from library.models import Skill

    rows: Any = (
        Skill.objects.filter(owner__user=user, is_deleted=False)
        .values("name", "category", "proficiency", "status")
        .order_by("category", "name")[:limit]
    )
    return list(rows)


def book_title_by_id(book_id: Any) -> str | None:
    """Título do livro pelo pk, sem filtro de dono (espelha o comportamento
    já existente em SuggestContinuationView antes da extração)."""
    from library.models import Book

    book = Book.objects.filter(pk=book_id, is_deleted=False).first()
    return book.title if book else None


def book_title_for_user(book_id: Any, user: User) -> str | None:
    from library.models import Book

    book = (
        Book.objects.filter(pk=book_id, owner__user=user, is_deleted=False)
        .values("title")
        .first()
    )
    return book["title"] if book else None
