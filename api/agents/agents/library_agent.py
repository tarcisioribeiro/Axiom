from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent

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

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "chunks": chunks,
            "recent_books": recent_books,
            "has_embeddings": bool(chunks),
            "period_label": period_label,
            "sources": list({c["source_title"] for c in chunks}),
        }

    def _get_recent_books(
        self,
        user: User,
        start: date | None = None,
        end: date | None = None,
    ) -> list[dict[str, Any]]:
        try:
            from library.models import Book

            qs = Book.objects.filter(owner__user=user, is_deleted=False)
            if start is not None and end is not None:
                qs = qs.filter(updated_at__date__range=(start, end))
            books = qs.values("title", "genre").order_by("-updated_at")[:10]
            return [dict(b) for b in books]
        except Exception:
            return []

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        if data["chunks"]:
            chunk_block = "\n\n".join(
                "[Fonte: {} — {}]\n{}".format(
                    safe_str(c["source_title"]),
                    safe_str(c["source_type"]),
                    c["content"],
                )
                for c in data["chunks"]
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
Use os trechos indexados abaixo para responder. Cite o livro de origem quando
possível.
Se não encontrar resposta nos trechos, informe e sugira uma leitura
relacionada.

{rag_section}

Livros recentes do usuário:{period_note}
{recent_block}

Pergunta: {ctx.query}"""
