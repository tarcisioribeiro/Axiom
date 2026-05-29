"""
Signal para categorização automática de despesas.

Quando uma despesa é criada com categoria 'others' e merchant preenchido,
o signal busca a primeira regra ativa do usuário cujo merchant_contains esteja
contido no merchant (case-insensitive) e aplica a categoria correspondente.
Utiliza fuzzy matching (rapidfuzz) com score mínimo de 80 para maior cobertura.

Em atualizações:
- Se a categoria é alterada para 'others', as regras são re-aplicadas.
- Se a categoria é alterada para um valor específico (não 'others'), o flag
  auto_categorized é limpo para refletir a escolha manual do usuário.
"""

from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from rapidfuzz import fuzz

FUZZY_MATCH_THRESHOLD = 80


def _apply_categorization_rules(user, instance):
    """Aplica a primeira regra ativa correspondente ao merchant da despesa.

    Usa fuzzy matching (partial_ratio >= 80) além de substring exata para maior
    cobertura em merchants com erros ortográficos ou variações de nome.
    """
    from expenses.models import CategorizationRule

    merchant_lower = instance.merchant.lower()
    rules = CategorizationRule.objects.filter(
        owner=user, is_active=True, is_deleted=False
    ).order_by("priority", "created_at")

    for rule in rules:
        rule_lower = rule.merchant_contains.lower()
        if (
            rule_lower in merchant_lower
            or fuzz.partial_ratio(rule_lower, merchant_lower)
            >= FUZZY_MATCH_THRESHOLD
        ):
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
    - Se category mudou para 'others' e merchant está preenchido:
      re-aplica regras.
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


@receiver(post_save, sender="expenses.Expense")
@receiver(post_delete, sender="expenses.Expense")
def invalidate_dashboard_cache_on_expense(sender, instance, **kwargs):
    from dashboard.views import invalidate_user_dashboard_cache

    if instance.created_by_id:
        invalidate_user_dashboard_cache(instance.created_by_id)


@receiver(post_save, sender="expenses.Expense")
def record_expense_metric(sender, instance, created, **kwargs):
    if created:
        try:
            from app.metrics import record_expense_created

            record_expense_created(instance.category or "others")
        except Exception:
            pass


@receiver(post_save, sender="expenses.Expense")
def embed_expense(sender, instance, **kwargs):
    from agents.services.embedding_service import (
        generate_embedding_for_instance,
    )

    source_title = f"{instance.category} — {instance.date}"

    def _embed():
        generate_embedding_for_instance(
            instance,
            domain="finance",
            source_type="expense",
            content_fn=lambda i: (
                f"Despesa de R$ {i.value} em {i.category}"
                f" — {i.merchant or i.description} em {i.date}"
            ),
            source_title=source_title,
        )

    transaction.on_commit(_embed)
