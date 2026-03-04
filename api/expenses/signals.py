"""
Signal para categorização automática de despesas.

Quando uma nova despesa é criada com categoria 'others' e merchant preenchido,
o signal busca a primeira regra ativa do usuário cujo merchant_contains esteja
contido no merchant (case-insensitive) e aplica a categoria correspondente.
"""

from django.db.models.signals import pre_save
from django.dispatch import receiver


@receiver(pre_save, sender="expenses.Expense")
def auto_categorize_expense(sender, instance, **kwargs):
    """
    Aplica automaticamente a primeira regra de categorização correspondente.

    Condições para aplicação:
    - Despesa nova (not yet saved to DB)
    - Categoria atual é 'others' (indicador de "não categorizada")
    - Campo merchant está preenchido
    - Usuário criador tem pelo menos uma regra ativa
    """
    if not instance._state.adding:
        return
    if instance.category != "others":
        return
    if not instance.merchant:
        return

    user = instance.created_by
    if not user:
        return

    from expenses.models import CategorizationRule

    merchant_lower = instance.merchant.lower()
    rules = CategorizationRule.objects.filter(
        owner=user, is_active=True, is_deleted=False
    ).order_by("created_at")

    for rule in rules:
        if rule.merchant_contains.lower() in merchant_lower:
            instance.category = rule.category
            instance.auto_categorized = True
            break
