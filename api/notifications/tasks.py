from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_notifications_for_member(self, member_id: int) -> dict:
    """
    Gera notificações para um único membro (task individual para retry
    granular).
    """
    try:
        from members.models import Member
        from notifications.views import _generate_notifications

        member = Member.objects.select_related("user").get(pk=member_id)
        _generate_notifications(member)
        return {"member_id": member_id, "status": "ok"}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task
def generate_all_notifications() -> dict:
    """
    Dispara generate_notifications_for_member para todos os membros ativos.
    """
    from members.models import Member

    member_ids = list(
        Member.objects.filter(
            user__is_active=True,
            is_deleted=False,
        ).values_list("id", flat=True)
    )
    for member_id in member_ids:
        generate_notifications_for_member.delay(member_id)
    return {"dispatched": len(member_ids)}
