"""
Compressão de histórico conversacional para reduzir tokens em sessões longas.

Quando o histórico ultrapassa _SUMMARIZE_AFTER turnos, os turnos mais antigos
são sumarizados via LLM e substituídos por uma mensagem de sistema concisa.
Os últimos _RECENT_TURNS turnos são sempre mantidos integralmente.
"""

import logging

logger = logging.getLogger(__name__)

_SUMMARIZE_AFTER = 8  # turnos (pares user/assistant) antes de sumarizar
_RECENT_TURNS = 4  # turnos recentes preservados literalmente


def maybe_compress_history(
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    """
    Retorna o histórico possivelmente comprimido.

    - history menor que _SUMMARIZE_AFTER * 2 mensagens: retorna sem modificar.
    - history maior: sumariza os turnos antigos via LLM e preserva os últimos
      _RECENT_TURNS * 2 mensagens literalmente.
    - Em caso de falha na sumarização: trunca para os recentes (sem sumarizar).
    """
    if len(history) <= _SUMMARIZE_AFTER * 2:
        return history

    split_point = len(history) - (_RECENT_TURNS * 2)
    to_summarize = history[:split_point]
    recent = history[split_point:]

    try:
        from agents.core.llm_client import LLMClient

        # Texto compacto para sumarização — limitar a 300 chars por mensagem
        conv_text = " | ".join(
            f"{m['role'].upper()}: {m['content'][:200]}" for m in to_summarize
        )
        summary_prompt = (
            "Resuma em 2 frases objetivas as informações"
            " financeiras mais relevantes "
            f"desta conversa anterior: {conv_text}"
        )
        summary = LLMClient.complete(summary_prompt)

        return [
            {
                "role": "system",
                "content": f"[Resumo da conversa anterior: {summary}]",
            },
            *recent,
        ]
    except Exception as exc:
        logger.warning(
            "Falha ao sumarizar histórico: %s — truncando para recentes", exc
        )
        return recent
