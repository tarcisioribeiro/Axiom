from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="revenues.Revenue")
def embed_revenue(sender, instance, **kwargs):
    from agents.services.embedding_service import generate_embedding_for_instance

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
