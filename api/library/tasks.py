from typing import Any, Callable

from django.utils import timezone

from celery import shared_task

BADGE_RULES: list[dict[str, Any]] = [
    {
        "code": "first_book",
        "level": "bronze",
        "check": lambda stats: stats["books_read"] >= 1,
    },
    {
        "code": "reader_5",
        "level": "silver",
        "check": lambda stats: stats["books_read"] >= 5,
    },
    {
        "code": "reader_10",
        "level": "silver",
        "check": lambda stats: stats["books_read"] >= 10,
    },
    {
        "code": "reader_25",
        "level": "gold",
        "check": lambda stats: stats["books_read"] >= 25,
    },
    {
        "code": "first_course",
        "level": "bronze",
        "check": lambda stats: stats["courses_completed"] >= 1,
    },
    {
        "code": "learner_3",
        "level": "silver",
        "check": lambda stats: stats["courses_completed"] >= 3,
    },
    {
        "code": "learner_10",
        "level": "gold",
        "check": lambda stats: stats["courses_completed"] >= 10,
    },
    {
        "code": "streak_7",
        "level": "bronze",
        "check": lambda stats: stats["reading_streak"] >= 7,
    },
    {
        "code": "streak_30",
        "level": "gold",
        "check": lambda stats: stats["reading_streak"] >= 30,
    },
    {
        "code": "first_highlight",
        "level": "bronze",
        "check": lambda stats: stats["highlights"] >= 1,
    },
    {
        "code": "annotator_10",
        "level": "silver",
        "check": lambda stats: stats["highlights"] >= 10,
    },
    {
        "code": "annotator_50",
        "level": "gold",
        "check": lambda stats: stats["highlights"] >= 50,
    },
    {
        "code": "knowledge_builder",
        "level": "silver",
        "check": lambda stats: stats["knowledge_nodes"] >= 10,
    },
    {
        "code": "knowledge_master",
        "level": "gold",
        "check": lambda stats: stats["knowledge_nodes"] >= 50,
    },
    {
        "code": "first_skill",
        "level": "bronze",
        "check": lambda stats: stats["skills"] >= 1,
    },
    {
        "code": "skill_collector",
        "level": "silver",
        "check": lambda stats: stats["skills"] >= 5,
    },
]


def _compute_reading_streak(member):
    from library.models import Reading

    today = timezone.now().date()
    readings = (
        Reading.objects.filter(owner=member, deleted_at__isnull=True)
        .values_list("reading_date", flat=True)
        .distinct()
        .order_by("-reading_date")
    )
    dates = sorted(set(readings), reverse=True)
    if not dates:
        return 0
    streak = 0
    current = today
    for d in dates:
        if d == current or d == current - timezone.timedelta(days=1):
            streak += 1
            current = d
        else:
            break
    return streak


def _compute_knowledge_nodes(member):
    from library.models import Book, BookHighlight, Course, Skill, Summary

    books = Book.objects.filter(owner=member, deleted_at__isnull=True).count()
    courses = Course.objects.filter(
        owner=member, deleted_at__isnull=True
    ).count()
    skills = Skill.objects.filter(
        owner=member, deleted_at__isnull=True
    ).count()
    summaries = Summary.objects.filter(
        owner=member, deleted_at__isnull=True
    ).count()
    highlights = BookHighlight.objects.filter(
        owner=member, deleted_at__isnull=True
    ).count()
    return books + courses + skills + summaries + highlights


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def award_intellect_badges_for_member(self, member_id: int) -> dict:
    try:
        from library.models import (
            Book,
            BookHighlight,
            Course,
            IntellectBadge,
            Skill,
        )
        from members.models import Member

        member = Member.objects.select_related("user").get(pk=member_id)

        books_read = Book.objects.filter(
            owner=member, read_status="read", deleted_at__isnull=True
        ).count()
        courses_completed = Course.objects.filter(
            owner=member, status="completed", deleted_at__isnull=True
        ).count()
        highlights = BookHighlight.objects.filter(
            owner=member, deleted_at__isnull=True
        ).count()
        skills = Skill.objects.filter(
            owner=member, deleted_at__isnull=True
        ).count()
        reading_streak = _compute_reading_streak(member)
        knowledge_nodes = _compute_knowledge_nodes(member)

        stats = {
            "books_read": books_read,
            "courses_completed": courses_completed,
            "highlights": highlights,
            "skills": skills,
            "reading_streak": reading_streak,
            "knowledge_nodes": knowledge_nodes,
        }

        awarded = []
        for rule in BADGE_RULES:
            check_fn: Callable[[dict[str, Any]], bool] = rule[
                "check"
            ]  # type: ignore[assignment]
            if check_fn(stats):
                _, created = IntellectBadge.objects.get_or_create(
                    owner=member,
                    code=rule["code"],
                    defaults={
                        "level": rule["level"],
                        "awarded_at": timezone.now(),
                        "created_by": member.user,
                    },
                )
                if created:
                    awarded.append(rule["code"])

        return {"member_id": member_id, "awarded": awarded}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task
def award_intellect_badges_all() -> dict:
    from members.models import Member

    member_ids = list(
        Member.objects.filter(
            user__is_active=True, is_deleted=False
        ).values_list("id", flat=True)
    )
    for member_id in member_ids:
        award_intellect_badges_for_member.delay(member_id)
    return {"dispatched": len(member_ids)}


@shared_task
def send_weekly_learning_recommendations() -> dict:
    """
    Envia recomendações semanais de aprendizado para cada membro ativo.

    Analisa o progresso da semana (leituras, cursos, habilidades) e gera
    sugestões personalizadas. Roda toda segunda-feira às 10h.
    """
    import logging
    from datetime import timedelta

    from django.utils import timezone

    from members.models import Member
    from notifications.models import Notification
    from notifications.services import dispatch_notification

    log = logging.getLogger(__name__)
    week_ago = timezone.now() - timedelta(days=7)
    sent = 0

    for member in Member.objects.filter(user__is_active=True).select_related(
        "user"
    ):
        already = Notification.objects.filter(
            owner=member,
            notification_type="learning_weekly_recommendations",
            created_at__gte=week_ago,
        ).exists()
        if already:
            continue

        from library.models import Book, Course, Reading, Skill

        books_reading = Book.objects.filter(
            owner=member, read_status="reading", deleted_at__isnull=True
        ).count()
        readings_this_week = Reading.objects.filter(
            owner=member,
            reading_date__gte=week_ago.date(),
            deleted_at__isnull=True,
        ).count()
        courses_in_progress = Course.objects.filter(
            owner=member, status="in_progress", deleted_at__isnull=True
        ).count()
        skills_learning = Skill.objects.filter(
            owner=member, status="learning", deleted_at__isnull=True
        ).count()

        if (
            readings_this_week == 0
            and courses_in_progress == 0
            and skills_learning == 0
        ):
            continue

        parts = []
        if readings_this_week > 0:
            parts.append(
                f"{readings_this_week} sessão(ões) de leitura esta semana"
            )
        if books_reading > 0:
            parts.append(f"{books_reading} livro(s) em andamento")
        if courses_in_progress > 0:
            parts.append(f"{courses_in_progress} curso(s) em progresso")
        if skills_learning > 0:
            parts.append(f"{skills_learning} habilidade(s) em aprendizado")

        summary = ". ".join(parts)

        notif = Notification.objects.create(
            owner=member,
            notification_type="learning_weekly_recommendations",
            title="Resumo semanal de aprendizado",
            message=(
                f"Seu progresso esta semana: {summary}. "
                "Continue assim! Acesse o módulo Intelecto para ver"
                " seus flashcards em atraso."
            ),
            content_type="Member",
            object_id=member.id,
            created_by=member.user,
            updated_by=member.user,
        )
        dispatch_notification(notif)
        sent += 1
        log.info("Recomendação semanal enviada para member=%s", member.id)

    return {"sent": sent}
