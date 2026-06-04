"""
Serviço de sugestão de categoria para despesas
(heurística + LLM fallback).

Estágio 1 — Heurística: aplica as regras de categorização ativas do
usuário usando fuzzy matching (rapidfuzz), igual ao sinal pre_save.

Estágio 2 — LLM fallback: quando nenhuma regra corresponde, o LLM
classifica a despesa com base em um prompt determinístico com as 22
categorias válidas. A resposta é validada antes de ser aceita; em caso
de falha o serviço retorna method='none' silenciosamente.
"""

import logging

from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

FUZZY_MATCH_THRESHOLD = 80

# Guia de categorias para o LLM (chave → exemplos curtos em pt-BR)
_CATEGORY_GUIDE: dict[str, str] = {
    "food and drink": "restaurantes, lanchonetes, bares, delivery",
    "supermarket": "supermercados, mercearias, hortifruti",
    "transport": "Uber, taxi, combustível, pedágio, passagem aérea",
    "bills and services": "energia, água, internet, telefone, gás",
    "house": "aluguel, móveis, eletrodomésticos, reformas",
    "health and care": "farmácia, médico, dentista, academia, salão",
    "vestuary": "roupas, calçados, acessórios",
    "entertainment": "cinema, shows, concertos, jogos",
    "education": "cursos, faculdade, livros, material escolar",
    "investments": "ações, fundos, criptomoedas",
    "electronics": "computadores, celulares, gadgets",
    "digital signs": "Netflix, Spotify, assinaturas de software",
    "travels": "hotéis, turismo, pacotes de viagem",
    "loans": "parcelas de empréstimo, financiamento",
    "taxes": "IPTU, IPVA, Imposto de Renda, tributos",
    "rates": "tarifas bancárias, IOF, anuidade",
    "professional services": "advogado, contador, consultor",
    "family and friends": "presentes, gastos sociais, família",
    "pets": "veterinário, ração, acessórios para pets",
    "donate": "doações, contribuições a ONGs",
    "purchases": "compras gerais, e-commerce, marketplace",
    "others": "demais gastos não enquadrados acima",
}

_SYSTEM_PROMPT = (
    "Você é um classificador de despesas financeiras. "
    "Classifique a despesa em exatamente UMA categoria. "
    "Responda APENAS com a chave da categoria, sem texto extra."
)


def _build_classification_prompt(
    description: str, merchant: str, value=None
) -> str:
    guide_lines = "\n".join(
        f"  {key}: {examples}" for key, examples in _CATEGORY_GUIDE.items()
    )

    info_parts: list[str] = []
    if description:
        info_parts.append(f"Descrição: {description}")
    if merchant:
        info_parts.append(f"Estabelecimento: {merchant}")
    if value is not None:
        info_parts.append(f"Valor: R$ {value}")

    expense_info = "\n".join(info_parts) or "Sem informação"

    return (
        f"Categorias:\n{guide_lines}\n\n"
        f"Despesa:\n{expense_info}\n\n"
        "Categoria:"
    )


def apply_heuristic_rules(user, merchant: str) -> str | None:
    """Retorna a categoria da primeira regra ativa que corresponder.

    Utiliza fuzzy matching (partial_ratio ≥ 80) além de substring exata,
    igual ao comportamento do sinal pre_save em signals.py.
    """
    from expenses.models import CategorizationRule

    if not merchant:
        return None

    merchant_lower = merchant.lower()
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
            return rule.category

    return None


def _llm_classify(description: str, merchant: str, value=None) -> str | None:
    """Classifica a despesa via LLM. Retorna a chave de categoria ou None.

    Falhas (timeout, provedor indisponível, resposta inválida) são
    capturadas silenciosamente — o chamador trata None como ausência
    de sugestão.
    """
    from expenses.models import EXPENSES_CATEGORIES

    valid_categories = {key for key, _ in EXPENSES_CATEGORIES}
    prompt = _build_classification_prompt(description, merchant, value)

    try:
        from agents.core.llm_client import LLMClient

        raw = LLMClient.complete(prompt, system=_SYSTEM_PROMPT)
        candidate = raw.strip().lower().strip("'\".,;:\n\t ")

        if candidate in valid_categories:
            return candidate

        # Correspondência parcial como último recurso
        for cat in valid_categories:
            if cat in candidate or candidate in cat:
                return cat

        logger.warning("LLM retornou categoria não reconhecida: %r", raw)
    except Exception:
        logger.exception("Falha ao classificar despesa com LLM")

    return None


def suggest_category(
    user, description: str, merchant: str, value=None
) -> dict:
    """Sugere categoria para uma despesa via heurística + LLM fallback.

    Args:
        user: instância do usuário dono da despesa (para buscar regras)
        description: descrição da despesa
        merchant: nome do estabelecimento
        value: valor da despesa (opcional, melhora a precisão do LLM)

    Returns:
        dict com:
          category (str): chave de categoria sugerida
          method ('rule'|'llm'|'none'): como a sugestão foi derivada
    """
    # 1. Heurística: regras do usuário com fuzzy matching
    rule_category = apply_heuristic_rules(user, merchant)
    if rule_category:
        return {"category": rule_category, "method": "rule"}

    # 2. LLM fallback (somente quando há informação suficiente)
    if description or merchant:
        llm_category = _llm_classify(description, merchant, value)
        if llm_category and llm_category != "others":
            return {"category": llm_category, "method": "llm"}

    return {"category": "others", "method": "none"}
