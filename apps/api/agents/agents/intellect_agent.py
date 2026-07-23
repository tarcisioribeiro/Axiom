"""
Agente Intelectual — módulo Intelecto
(biblioteca pessoal, cursos e habilidades).
Usa RAG (pgvector) para busca semântica em livros, resumos e destaques.
"""

import unicodedata
from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent
from agents.providers import library_provider

_KW_BOOKS = [
    "livro",
    "livros",
    "leitura",
    "leituras",
    "ler",
    "lendo",
    "li",
    "autor",
    "autora",
    "autores",
    "editora",
    "editoras",
    "título",
    "titulo",
    "obra",
    "obras",
    "volume",
    "capítulo",
    "capitulo",
    "página",
    "pagina",
    "páginas",
    "paginas",
    "ficção",
    "ficcao",
    "ficção científica",
    "fantasia",
    "romance",
    "não ficção",
    "nao ficcao",
    "autoajuda",
    "auto-ajuda",
    "que livro",
    "qual livro",
    "livros lidos",
    "lista de livros",
    "catálogo",
    "catalogo",
    "biblioteca",
    "acervo",
    "minha leitura",
    "minhas leituras",
    "fila de leitura",
    "quero ler",
    "próximo livro",
    "proximo livro",
    "acabei de ler",
    "terminei",
    "comecei a ler",
    "reading",
    "book",
    "books",
]

_KW_HIGHLIGHTS = [
    "destaque",
    "destaques",
    "highlight",
    "highlights",
    "anotação",
    "anotacoes",
    "nota",
    "notas",
    "anotei",
    "sublinhei",
    "marcação",
    "marcacoes",
    "resumo",
    "resumos",
    "resenha",
    "sinopse",
    "aprendi",
    "aprendizado",
    "aprender",
    "insight",
    "insights",
    "lição",
    "licao",
    "licoes",
    "ensinamento",
    "o que diz",
    "o autor diz",
    "me fale sobre",
    "o livro fala",
    "o que o livro",
    "conteúdo do livro",
    "conteudo",
]

_KW_COURSES = [
    "curso",
    "cursos",
    "aula",
    "aulas",
    "módulo",
    "modulo",
    "módulos",
    "lição online",
    "licao online",
    "plataforma",
    "udemy",
    "coursera",
    "alura",
    "dio",
    "rocketseat",
    "youtube",
    "video aula",
    "certificado",
    "certificação",
    "certificacao",
    "treinamento",
    "workshop",
    "webinar",
    "bootcamp",
    "estudando",
    "estou estudando",
    "terminei o curso",
    "progresso do curso",
    "quantas aulas",
    "quanto aprendi",
]

_KW_SKILLS = [
    "habilidade",
    "habilidades",
    "skill",
    "skills",
    "competência",
    "competencias",
    "competência técnica",
    "soft skill",
    "hard skill",
    "proficiência",
    "proficiencia",
    "nível",
    "nivel",
    "expertise",
    "especialidade",
    "programação",
    "programacao",
    "python",
    "javascript",
    "typescript",
    "inglês",
    "ingles",
    "idioma",
    "língua",
    "mapa de habilidades",
    "quais habilidades",
    "minhas habilidades",
]

_KW_READING = [
    "progresso de leitura",
    "páginas lidas",
    "paginas lidas",
    "percentual do livro",
    "quanto li",
    "onde parei",
    "meta de leitura",
    "metas de leitura",
    "livros por mês",
    "livros este ano",
    "histórico de leitura",
]

_ALL_KW = _KW_BOOKS + _KW_HIGHLIGHTS + _KW_COURSES + _KW_SKILLS + _KW_READING


def _normalize(text: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )


class IntellectAgent(BaseAgent):
    name = "intellect"
    description = (
        "Intelecto: livros lidos, destaques e resumos via RAG, "
        "progresso em cursos e mapa de habilidades"
    )
    ollama_model = "llama3.1:8b"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.3-70b-versatile"
    openai_model = "gpt-4o"

    def can_handle(self, query: str) -> float:
        q = _normalize(query)
        hits = sum(1 for w in _ALL_KW if _normalize(w) in q)
        return min(hits * 0.22, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.rag_tools import search_library_chunks

        user = User.objects.get(pk=ctx.user_id)
        now = timezone.now().date()

        temporal = (
            parse_temporal_intent(ctx.query, now)
            if not ctx.metadata.get("date_from")
            else None
        )

        t_start = temporal[0] if temporal else None
        t_end = temporal[1] if temporal else None

        # RAG: busca semântica em livros, resumos e highlights
        chunks = search_library_chunks(ctx.query, user, top_k=6)

        recent_books = self._get_recent_books(user, start=t_start, end=t_end)
        courses = self._get_course_progress(user)
        skills = self._get_skills(user)

        period_label = (
            f"{t_start.strftime('%d/%m')}–{t_end.strftime('%d/%m/%Y')}"
            if t_start and t_end
            else "recentes"
        )

        # Maintain ordered sources (preserve chunk order, deduplicate)
        seen: dict[str, bool] = {}
        ordered_sources: list[str] = []
        for c in chunks:
            t = c["source_title"]
            if t not in seen:
                seen[t] = True
                ordered_sources.append(t)

        # Book context for contextual chat
        book_context = ""
        book_id = ctx.metadata.get("book_id")
        if book_id:
            try:
                book_title = library_provider.book_title_for_user(
                    book_id, user
                )
                if book_title:
                    book_context = (
                        "Foco desta conversa: livro "
                        + f"'{safe_str(book_title)}'. "
                        + "Priorize trechos e informações sobre esta obra.\n\n"
                    )
            except Exception:
                pass

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "chunks": chunks,
            "recent_books": recent_books,
            "courses": courses,
            "skills": skills,
            "has_rag": bool(chunks),
            "period_label": period_label,
            "sources": ordered_sources
            or (["Intelecto"] if recent_books else []),
            "book_context": book_context,
        }

    def _get_recent_books(
        self,
        user: User,
        start: date | None = None,
        end: date | None = None,
    ) -> list[dict[str, Any]]:
        try:
            books = library_provider.recent_books_detailed(
                user, start, end, limit=8
            )

            # Enriquece com páginas lidas acumuladas (sessões de leitura)
            result = []
            for b in books:
                pages_read = library_provider.reading_pages_read(b["id"])
                result.append(
                    {
                        "title": safe_str(b["title"]),
                        "genre": safe_str(b["genre"] or ""),
                        "status": b["read_status"] or "unknown",
                        "progress": (
                            "{}/{} páginas".format(pages_read, b["pages"])
                            if b["pages"]
                            else None
                        ),
                        "rating": b["rating"],
                    }
                )
            return result
        except Exception:
            return []

    def _get_course_progress(self, user: User) -> list[dict[str, Any]]:
        try:
            courses = library_provider.course_progress(user, limit=6)
            return [
                {
                    "title": safe_str(c["title"]),
                    "platform": safe_str(c["platform"] or ""),
                    "status": safe_str(c["status"] or ""),
                    "sessions": c["sessions_count"],
                }
                for c in courses
            ]
        except Exception:
            return []

    def _get_skills(self, user: User) -> list[dict[str, Any]]:
        try:
            skills = library_provider.skills(user, limit=12)
            return [
                {
                    "name": safe_str(s["name"]),
                    "category": safe_str(s["category"] or ""),
                    "proficiency": safe_str(s["proficiency"] or ""),
                    "status": safe_str(s["status"] or ""),
                }
                for s in skills
            ]
        except Exception:
            return []

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        # Bloco RAG (busca semântica) — chunks numerados para citações inline
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
            rag_section = (
                f"Trechos encontrados via busca semântica:\n\n{chunk_block}"
            )
        else:
            rag_section = (
                "Nenhum trecho indexado encontrado para esta pergunta. "
                "Respondendo com base nos dados estruturados abaixo."
            )

        # Livros
        books_block = (
            "\n".join(
                "  - {} ({}) — {}{}{}".format(
                    safe_str(b["title"]),
                    safe_str(b["genre"]) if b["genre"] else "sem gênero",
                    safe_str(b["status"]),
                    f" | {b['progress']}" if b["progress"] else "",
                    f" | ★ {b['rating']}" if b["rating"] else "",
                )
                for b in data["recent_books"]
            )
            or "  Nenhum livro cadastrado."
        )

        # Cursos
        courses_block = (
            "\n".join(
                "  - {} ({}) — {} | {} sessão(ões) registrada(s)".format(
                    safe_str(c["title"]),
                    (
                        safe_str(c["platform"])
                        if c["platform"]
                        else "s/plataforma"
                    ),
                    safe_str(c["status"]),
                    c["sessions"],
                )
                for c in data["courses"]
            )
            or "  Nenhum curso cadastrado."
        )

        # Habilidades
        skills_block = (
            "\n".join(
                "  - {} ({}){}".format(
                    safe_str(s["name"]),
                    safe_str(s["category"]) if s["category"] else "geral",
                    (
                        f" — nível: {safe_str(s['proficiency'])}"
                        if s["proficiency"]
                        else ""
                    ),
                )
                for s in data["skills"]
            )
            or "  Nenhuma habilidade cadastrada."
        )

        book_context = data.get("book_context", "")

        return (
            "Você é um assistente especializado na biblioteca pessoal "
            "e jornada de aprendizado do usuário.\n"
            "Use os trechos indexados para responder perguntas"
            " sobre livros lidos. "
            "Ao usar informações dos trechos, cite o número do trecho "
            "com [1], [2], etc. após a afirmação.\n\n"
            f"{book_context}"
            f"{rag_section}\n\n"
            f"Livros ({data['period_label']}):\n{books_block}\n\n"
            f"Cursos:\n{courses_block}\n\n"
            f"Habilidades:\n{skills_block}\n\n"
            f"Pergunta: {ctx.query}\n\n"
            "Use markdown para organizar a resposta. "
            "Para recomendações de livros, cite autor"
            " e por que seria relevante. "
            "Para habilidades e cursos, sugira"
            " próximos passos de aprendizado."
        )
