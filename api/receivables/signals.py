from decimal import Decimal

from django.db.models import Sum
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


@receiver(post_delete, sender="receivables.Receivable")
def nullify_revenues_on_receivable_delete(sender, instance, **kwargs):
    from revenues.models import Revenue

    Revenue.objects.filter(related_receivable=instance).update(
        related_receivable=None
    )


def update_receivable_received_value(receivable):
    from revenues.models import Revenue

    total_received = Revenue.objects.filter(
        related_receivable=receivable, is_deleted=False, received=True
    ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

    receivable.received_value = total_received

    if total_received >= receivable.value:
        receivable.status = "received"
    elif receivable.status == "received":
        receivable.status = "active"

    from receivables.models import Receivable

    Receivable.objects.filter(pk=receivable.pk).update(
        received_value=receivable.received_value, status=receivable.status
    )


@receiver(post_save, sender="revenues.Revenue")
def revenue_saved_update_receivable(sender, instance, **kwargs):
    if instance.related_receivable and not instance.is_deleted:
        update_receivable_received_value(instance.related_receivable)


@receiver(post_delete, sender="revenues.Revenue")
def revenue_deleted_update_receivable(sender, instance, **kwargs):
    if instance.related_receivable:
        update_receivable_received_value(instance.related_receivable)
