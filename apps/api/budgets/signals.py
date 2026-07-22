from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="budgets.Budget")
def embed_budget(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    source_title = f"{instance.category} {instance.month:02d}/{instance.year}"

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="budget",
            source_type="budget",
            content_fn=lambda i: (
                f"Orçamento de {i.category}: limite R$ {i.limit_amount}"
                f" em {i.month:02d}/{i.year}"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)
