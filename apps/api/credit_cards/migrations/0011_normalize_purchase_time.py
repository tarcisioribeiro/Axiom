"""Normaliza CreditCardPurchase.purchase_time para HH:MM:00. Registros com
microssegundos vieram de `timezone.now().time()` (bug: hora em UTC em vez do
fuso local) — recalculados a partir de `created_at`, que já está correto."""

from django.db import migrations
from django.utils import timezone


def forwards(apps, schema_editor):
    CreditCardPurchase = apps.get_model("credit_cards", "CreditCardPurchase")
    for purchase in CreditCardPurchase.objects.exclude(
        purchase_time__isnull=True
    ).only("id", "purchase_time", "created_at"):
        original = purchase.purchase_time
        if original.microsecond:
            local_dt = timezone.localtime(purchase.created_at)
            new_time = local_dt.time().replace(second=0, microsecond=0)
        elif original.second:
            new_time = original.replace(second=0, microsecond=0)
        else:
            continue
        CreditCardPurchase.objects.filter(pk=purchase.pk).update(
            purchase_time=new_time
        )


def backwards(apps, schema_editor):
    # Irreversível: segundos/microssegundos originais não são recuperáveis.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("credit_cards", "0010_alter_creditcardpurchase_options"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
