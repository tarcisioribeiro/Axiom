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
    """Aplica a primeira regra de automação simples (merchant contém X →
    definir categoria) correspondente ao merchant da despesa.

    Usa fuzzy matching (partial_ratio >= 80) além de substring exata para maior
    cobertura em merchants com erros ortográficos ou variações de nome.
    Regras de automação mais complexas (múltiplas condições, add_tag, etc.)
    são aplicadas após a criação por `apply_automation_rules` (post_save).
    """
    from expenses.models import AutomationRule

    merchant_lower = instance.merchant.lower()
    rules = AutomationRule.objects.filter(
        owner=user, is_active=True, is_deleted=False
    ).order_by("priority", "created_at")

    for rule in rules:
        merchant_contains = _simple_merchant_category_rule(rule)
        if merchant_contains is None:
            continue
        merchant_value, category = merchant_contains
        rule_lower = merchant_value.lower()
        if (
            rule_lower in merchant_lower
            or fuzz.partial_ratio(rule_lower, merchant_lower)
            >= FUZZY_MATCH_THRESHOLD
        ):
            instance.category = category
            instance.auto_categorized = True
            break


def _simple_merchant_category_rule(rule):
    """Se `rule` segue o padrão simples (uma condição 'merchant contains' +
    uma ação 'set_category'), retorna (merchant_contains, category).
    Caso contrário, retorna None.
    """
    merchant_condition = next(
        (
            c
            for c in rule.conditions
            if c.get("field") == "merchant" and c.get("operator") == "contains"
        ),
        None,
    )
    category_action = next(
        (a for a in rule.actions if a.get("type") == "set_category"),
        None,
    )
    if not merchant_condition or not category_action:
        return None
    merchant_value = merchant_condition.get("value")
    category = category_action.get("value")
    if not merchant_value or not category:
        return None
    return merchant_value, category


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


@receiver(pre_save, sender="expenses.Expense")
def _capture_old_payed_state(sender, instance, **kwargs):
    """Guarda o valor anterior de `payed` na instância para que o signal
    `mark_next_installment_paid_on_expense_payed` (post_save) consiga
    detectar a transição False -> True, já que post_save não tem acesso ao
    estado anterior do banco."""
    if instance._state.adding:
        instance._old_payed = False
        return
    try:
        instance._old_payed = sender.objects.values_list(
            "payed", flat=True
        ).get(pk=instance.pk)
    except sender.DoesNotExist:
        instance._old_payed = False


@receiver(post_save, sender="expenses.Expense")
def mark_next_installment_paid_on_expense_payed(sender, instance, **kwargs):
    """
    Marca a parcela pendente mais antiga (LoanInstallment/PayableInstallment)
    como paga quando a Expense vinculada a um empréstimo/conta a pagar vira
    `payed=True`.

    Fonte única de verdade sobre "parcelas pendentes" usada pelo fluxo de
    recálculo (requisitos 5 e 7 do plano de pagamento de dívidas) — sem
    isso, nem o pagamento avulso (LoanPaymentView/PayablePaymentView) nem a
    geração mensal via despesa fixa marcam parcelas como pagas.
    """
    if not instance.payed or getattr(instance, "_old_payed", False):
        return
    if not (instance.related_loan_id or instance.related_payable_id):
        return

    if instance.related_loan_id:
        from loans.models import LoanInstallment

        installment = (
            LoanInstallment.objects.filter(
                loan_id=instance.related_loan_id, payed=False
            )
            .order_by("installment_number")
            .first()
        )
    else:
        from payables.models import PayableInstallment

        installment = (
            PayableInstallment.objects.filter(
                payable_id=instance.related_payable_id, payed=False
            )
            .order_by("installment_number")
            .first()
        )

    if installment:
        installment.payed = True
        installment.payment_expense = instance
        installment.save(
            update_fields=["payed", "payment_expense", "updated_at"]
        )


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
def dispatch_llm_categorization(sender, instance, created, **kwargs):
    """Dispara categorização LLM em background quando a heurística falhou.

    Acionado somente em criação, quando category ainda é 'others' e
    auto_categorized=False (nenhuma regra heurística correspondeu).
    """
    if not created:
        return
    if instance.category != "others" or instance.auto_categorized:
        return
    if not (instance.merchant or instance.description):
        return

    from expenses.tasks import async_categorize_expense

    transaction.on_commit(lambda: async_categorize_expense.delay(instance.pk))


@receiver(post_save, sender="expenses.Expense")
def apply_automation_rules(sender, instance, created, **kwargs):
    """Aplica regras de automação após criação de uma despesa."""
    if not created:
        return
    if getattr(instance, "_applying_automation", False):
        return

    user = instance.created_by
    if not user:
        return

    from expenses.models import AutomationRule, AutomationRuleLog

    rules = AutomationRule.objects.filter(
        owner=user, is_active=True, is_deleted=False
    ).order_by("priority", "created_at")

    category_changed = False
    for rule in rules:
        # Regras simples (merchant contains → set_category) já foram
        # tratadas em pre_save por `_apply_categorization_rules`, que só
        # categoriza quando `category == 'others'` — aplicá-las de novo
        # aqui sobrescreveria uma categoria definida manualmente pelo
        # usuário.
        if _simple_merchant_category_rule(rule) is not None:
            continue
        if not rule.matches(instance):
            continue
        applied = rule.apply(instance)
        if not applied:
            continue
        if any(a.startswith("set_category:") for a in applied):
            category_changed = True
        AutomationRuleLog.objects.create(
            rule=rule,
            expense=instance,
            actions_applied=applied,
            created_by=user,
            updated_by=user,
        )
        AutomationRule.objects.filter(pk=rule.pk).update(
            apply_count=rule.apply_count + 1
        )

    if category_changed:
        instance._applying_automation = True
        instance.save(update_fields=["category"])


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
