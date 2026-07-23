from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent
from agents.providers import library_provider

_TRIGGER_WORDS = [
    "livro",
    "livros",
    "leitura",
    "leituras",
    "aprendi",
    "aprender",
    "resumo",
    "resumos",
    "autor",
    "autora",
    "capítulo",
    "insight",
    "o que diz",
    "me fale sobre",
    "recomenda",
    "recomendação",
    "nota",
    "anotação",
    "destaque",
    "highlight",
    "lendo",
]


class LibraryAgent(BaseAgent):
    name = "library"
    description = "Respostas sobre livros lidos, resumos e insights via RAG"
    ollama_model = "llama3.1:8b"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.3-70b-versatile"
    openai_model = "gpt-4o"

    def can_handle(self, query: str) -> float:
        q = query.lower()
        hits = sum(1 for w in _TRIGGER_WORDS if w in q)
        return min(hits * 0.28, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.rag_tools import search_library_chunks

        user = User.objects.get(pk=ctx.user_id)
        now = timezone.now().date()

        temporal = (
            parse_temporal_intent(ctx.query, now)
            if not ctx.metadata.get("date_from")
            else None
        )

        chunks = search_library_chunks(ctx.query, user, top_k=5)

        t_start = temporal[0] if temporal else None
        t_end = temporal[1] if temporal else None
        recent_books = self._get_recent_books(user, start=t_start, end=t_end)

        period_label = (
            f"{t_start.strftime('%d/%m')}–{t_end.strftime('%d/%m/%Y')}"
            if t_start is not None and t_end is not None
            else None
        )

        # Maintain ordered sources (preserve chunk order, deduplicate)
        seen: dict[str, bool] = {}
        ordered_sources: list[str] = []
        for c in chunks:
            t = c["source_title"]
            if t not in seen:
                seen[t] = True
                ordered_sources.append(t)

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "chunks": chunks,
            "recent_books": recent_books,
            "has_embeddings": bool(chunks),
            "period_label": period_label,
            "sources": ordered_sources,
        }

    def _get_recent_books(
        self,
        user: User,
        start: date | None = None,
        end: date | None = None,
    ) -> list[dict[str, Any]]:
        try:
            return library_provider.recent_books(user, start, end, limit=10)
        except Exception:
            return []

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        if data["chunks"]:
            chunk_block = "\n\n".join(
                "[{}] Fonte: {} — {}\n{}".format(
                    i + 1,
                    safe_str(c["source_title"]),
                    safe_str(c["source_type"]),
                    c["content"],
                )
                for i, c in enumerate(data["chunks"])
            )
            rag_section = f"Trechos relevantes encontrados:\n\n{chunk_block}"
        else:
            rag_section = (
                "Nenhum trecho indexado encontrado para esta pergunta. "
                "Responda com base nos livros listados abaixo."
            )

        period_note = (
            f"\n(Livros filtrados para o período: {data['period_label']})"
            if data["period_label"]
            else ""
        )

        recent_block = (
            "\n".join(
                f"  - {safe_str(b['title'])} ({safe_str(b['genre'])})"
                for b in data["recent_books"]
            )
            or "  (sem livros cadastrados neste período)"
        )

        _intro = (
            "Você é um assistente especializado"
            " na biblioteca pessoal do usuário."
        )
        return f"""{_intro}
Use os trechos indexados abaixo para responder. Ao usar informações de um
trecho, cite o número com [1], [2], etc. após a afirmação.
Se não encontrar resposta nos trechos, informe e sugira uma leitura
relacionada.

{rag_section}

Livros recentes do usuário:{period_note}
{recent_block}

Pergunta: {ctx.query}"""
