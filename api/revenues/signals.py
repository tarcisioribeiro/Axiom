from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


@receiver(post_save, sender="revenues.Revenue")
@receiver(post_delete, sender="revenues.Revenue")
def invalidate_dashboard_cache_on_revenue(sender, instance, **kwargs):
    from dashboard.views import invalidate_user_dashboard_cache

    if instance.created_by_id:
        invalidate_user_dashboard_cache(instance.created_by_id)


@receiver(post_save, sender="revenues.Revenue")
def record_revenue_metric(sender, instance, created, **kwargs):
    if created:
        try:
            from app.metrics import record_revenue_created

            record_revenue_created(instance.category or "other")
        except Exception:
            pass


@receiver(post_save, sender="revenues.Revenue")
def embed_revenue(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    source_title = f"{instance.category} — {instance.date}"

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="revenue",
            content_fn=lambda i: (
                f"Receita de R$ {i.value} em {i.category} em {i.date}"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)
