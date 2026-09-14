"""
Reformata a descrição das VaultTransactions de rendimento automático já
geradas, trocando o formato antigo (ISO, sem tradução) pelo novo:

    "Rendimento automático até 2026-09-14"
    -> "Rendimento automático registrado em 14/09/2026"

Mesma mudança aplicada em vaults/models.py:Vault.apply_yield para
transações futuras.
"""

import re

from django.db import migrations

OLD_PATTERN = re.compile(
    r"^Rendimento automático até (\d{4})-(\d{2})-(\d{2})$"
)


def forwards(apps, schema_editor):
    VaultTransaction = apps.get_model("vaults", "VaultTransaction")

    for tx in VaultTransaction.objects.filter(
        transaction_type="yield", description__startswith="Rendimento"
    ).only("id", "description"):
        match = OLD_PATTERN.match(tx.description or "")
        if not match:
            continue
        year, month, day = match.groups()
        tx.description = (
            f"Rendimento automático registrado em {day}/{month}/{year}"
        )
        tx.save(update_fields=["description"])


def backwards(apps, schema_editor):
    VaultTransaction = apps.get_model("vaults", "VaultTransaction")

    new_pattern = re.compile(
        r"^Rendimento automático registrado em (\d{2})/(\d{2})/(\d{4})$"
    )
    for tx in VaultTransaction.objects.filter(
        transaction_type="yield", description__startswith="Rendimento"
    ).only("id", "description"):
        match = new_pattern.match(tx.description or "")
        if not match:
            continue
        day, month, year = match.groups()
        tx.description = f"Rendimento automático até {year}-{month}-{day}"
        tx.save(update_fields=["description"])


class Migration(migrations.Migration):

    dependencies = [
        ("vaults", "0010_reconcile_vault_yield"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
