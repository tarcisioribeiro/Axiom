from typing import Any

from django.contrib.auth.models import User

from agents.core.base_agent import AgentContext, BaseAgent
from agents.core.prompts import BASE_SYSTEM_PROMPT

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
        chunks = search_library_chunks(ctx.query, user, top_k=5)

        # Livros lidos recentemente para contexto adicional
        recent_books = self._get_recent_books(user)

        return {
            "system_prompt": BASE_SYSTEM_PROMPT,
            "chunks": chunks,
            "recent_books": recent_books,
            "has_embeddings": bool(chunks),
            "sources": list({c["source_title"] for c in chunks}),
        }

    def _get_recent_books(self, user: User) -> list[dict[str, Any]]:
        try:
            from library.models import Book

            books = (
                Book.objects.filter(owner__user=user, is_deleted=False)
                .values("title", "genre")
                .order_by("-updated_at")[:5]
            )
            return [dict(b) for b in books]
        except Exception:
            return []

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        if data["chunks"]:
            chunk_block = "\n\n".join(
                f"[Fonte: {c['source_title']} — {c['source_type']}]\n{c['content']}"
                for c in data["chunks"]
            )
            rag_section = f"Trechos relevantes encontrados:\n\n{chunk_block}"
        else:
            rag_section = (
                "Nenhum trecho indexado encontrado para esta pergunta. "
                "Responda com base nos livros recentes listados abaixo."
            )

        recent_block = (
            "\n".join(f"  - {b['title']} ({b['genre']})" for b in data["recent_books"])
            or "  (sem livros cadastrados)"
        )

        history_block = ""
        if ctx.history:
            from agents.core.memory import ConversationMemory

            history_block = (
                f"\nHistórico:\n{ConversationMemory.format_for_prompt(ctx.history)}\n"
            )

        return f"""Você é um assistente especializado na biblioteca pessoal do usuário.
Use os trechos indexados abaixo para responder. Cite o livro de origem quando possível.
Se não encontrar resposta nos trechos, informe e sugira uma leitura relacionada.

{rag_section}

Livros recentes do usuário:
{recent_block}
{history_block}
Pergunta: {ctx.query}"""
