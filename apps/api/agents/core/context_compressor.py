"""
Compressão de contexto financeiro antes de enviar ao LLM.

Reduz o número de linhas injetadas no prompt priorizando:
1. Itens cuja categoria/descrição é mencionada na query
   (relevantes para a pergunta)
2. Itens com maior valor absoluto (mais impactantes financeiramente)
3. Truncamento por MAX_ROWS para cada coleção

Também provê estimativa de tokens para diagnóstico.
"""

from __future__ import annotations

from typing import Any


def estimate_tokens(text: str) -> int:
    """Aproximação: ~4 chars por token para português."""
    return max(1, len(text) // 4)


def _item_matches_query(item: dict[str, Any], query_lower: str) -> bool:
    """Verdadeiro se algum valor string do item aparece na query."""
    for val in item.values():
        if isinstance(val, str) and val.lower() in query_lower:
            return True
    return False


def _split_by_relevance(
    items: list[dict[str, Any]], query_lower: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    mentioned = [i for i in items if _item_matches_query(i, query_lower)]
    others = [i for i in items if i not in mentioned]
    return mentioned, others


def compress(
    data: dict[str, Any],
    query: str = "",
    max_rows: int = 5,
) -> dict[str, Any]:
    """
    Retorna cópia comprimida do dicionário de contexto financeiro.

    Parâmetros:
        data     — dict retornado por build_context() de qualquer agente
        query    — query original para priorizar itens mencionados
        max_rows — limite de linhas por coleção após compressão
    """
    result = dict(data)
    q = query.lower()

    for key in ("expenses", "revenues", "merchants"):
        items: list[dict[str, Any]] = result.get(key, [])
        if not items:
            continue
        mentioned, others = _split_by_relevance(items, q)
        result[key] = (mentioned + others)[:max_rows]

    # Tendência: manter apenas os 3 meses mais recentes
    if "trend" in result and isinstance(result["trend"], list):
        result["trend"] = result["trend"][-3:]

    # Orçamentos: priorizar estourados e críticos, depois limitar
    if "budgets" in result and isinstance(result["budgets"], list):
        budgets: list[dict[str, Any]] = result["budgets"]
        overbudget = [b for b in budgets if b.get("overbudget")]
        critical = [
            b
            for b in budgets
            if b.get("percentage", 0) >= 80 and not b.get("overbudget")
        ]
        rest = [
            b for b in budgets if b not in overbudget and b not in critical
        ]
        result["budgets"] = (overbudget + critical + rest)[:max_rows]

    # Despesas fixas futuras: limitar a 5 mais próximas
    if "fixed_upcoming" in result and isinstance(
        result["fixed_upcoming"], list
    ):
        result["fixed_upcoming"] = result["fixed_upcoming"][:5]

    # Projections: limitar a 5
    if "projections" in result and isinstance(result["projections"], list):
        result["projections"] = result["projections"][:max_rows]

    return result


def should_compress(prompt: str, threshold_tokens: int = 1500) -> bool:
    """Retorna True se o prompt excede o limite de tokens estimado."""
    return estimate_tokens(prompt) > threshold_tokens
