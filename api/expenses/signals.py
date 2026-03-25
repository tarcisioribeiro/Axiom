"""
Signal para categorização automática de despesas.

Quando uma despesa é criada com categoria 'others' e merchant preenchido,
o signal busca a primeira regra ativa do usuário cujo merchant_contains esteja
contido no merchant (case-insensitive) e aplica a categoria correspondente.

Em atualizações:
- Se a categoria é alterada para 'others', as regras são re-aplicadas.
- Se a categoria é alterada para um valor específico (não 'others'), o flag
  auto_categorized é limpo para refletir a escolha manual do usuário.
"""

from django.db.models.signals import pre_save
from django.dispatch import receiver


def _apply_categorization_rules(user, instance):
    """Aplica a primeira regra ativa correspondente ao merchant da despesa."""
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


@receiver(pre_save, sender="expenses.Expense")
def auto_categorize_expense(sender, instance, **kwargs):
    """
    Aplica automaticamente a primeira regra de categorização correspondente.

    Criação:
    - Aplica regra se category='others' e merchant preenchido.

    Atualização:
    - Se category mudou para 'others' e merchant está preenchido: re-aplica regras.
    - Se category foi definida com um valor específico (não 'others'): limpa
      o flag auto_categorized para indicar escolha manual.
    """
    if not instance.merchant:
        return

    user = instance.created_by
    if not user:
        return

    if instance._state.adding:
        if instance.category == "others":
            _apply_categorization_rules(user, instance)
        return

    # Update path: fetch old category from DB with a minimal query
    try:
        old_category = sender.objects.values_list("category", flat=True).get(
            pk=instance.pk
        )
    except sender.DoesNotExist:
        return

    if instance.category != "others":
        # User explicitly set a specific category — mark as manually controlled
        instance.auto_categorized = False
        return

    # Category is 'others': re-apply rules only if it changed to 'others'
    if old_category != "others":
        _apply_categorization_rules(user, instance)
