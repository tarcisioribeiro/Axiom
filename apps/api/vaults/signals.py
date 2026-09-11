"""
Mantém Vault.accumulated_yield sincronizado com edições externas nas
receitas de rendimento (Revenue categoria "income", related_vault setado).

O próprio Vault já mantém essa invariante internamente durante
apply_yield/withdraw/recalculate_yields (marcando as Revenue que ele
mesmo grava com `_skip_vault_yield_sync`, para não reagir ao seu próprio
lançamento). Este signal cobre o caso que faltava: alguém edita ou exclui
diretamente a Revenue de rendimento (API, Django admin, shell) e
accumulated_yield/current_balance do cofre ficam desatualizados.
"""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


def _resync(instance):
    if not instance.related_vault_id or instance.category != "income":
        return

    from vaults.models import Vault

    vault = Vault.objects.filter(pk=instance.related_vault_id).first()
    if vault is not None:
        vault.resync_accumulated_yield_from_ledger(user=instance.updated_by)


@receiver(post_save, sender="revenues.Revenue")
def resync_vault_yield_on_revenue_save(sender, instance, **kwargs):
    if getattr(instance, "_skip_vault_yield_sync", False):
        return
    _resync(instance)


@receiver(post_delete, sender="revenues.Revenue")
def resync_vault_yield_on_revenue_delete(sender, instance, **kwargs):
    _resync(instance)
