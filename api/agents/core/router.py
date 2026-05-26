"""
Roteador de agentes: seleciona o agente mais adequado para cada query.

Melhorias implementadas:
- Suporte a agent_override (seleção direta sem roteamento automático)
- Normalização de acentos no scoring de keywords
- 4 novos agentes modulares: personal, financial, security, intellect
- Exemplares semânticos ampliados (15–20 por agente)
- Scoring semântico consolidado em 1 SQL com GROUP BY
- Embedding opcional via LLM_SEMANTIC_ROUTING_ENABLED (padrão: true)
- SemanticRouter com exemplares pré-computados
- Fallback gracioso: se embedding falhar, usa apenas keyword scoring
"""

import logging
import math
import unicodedata

from agents.core.base_agent import AgentContext, AgentResponse, BaseAgent
from agents.core.llm_client import LLMClient

logger = logging.getLogger(__name__)

# Mapa agente.name → domínio de embedding
_AGENT_TO_DOMAIN: dict[str, str] = {
    "personal": "planning",
    "financial": "finance",
    "security": "general",
    "intellect": "library",
    # Agentes legados
    "finance": "finance",
    "budget": "budget",
    "forecast": "finance",
    "planning": "planning",
    "library": "library",
    "insight": "general",
}

_DOMAINS = ["finance", "budget", "planning", "library", "general"]

# Exemplares canônicos por agente — ampliados para melhor precisão semântica
_AGENT_EXEMPLARS: dict[str, list[str]] = {
    "personal": [
        "Como estão minhas rotinas esta semana?",
        "Quantas tarefas completei hoje?",
        "Qual minha taxa de cumprimento de hábitos?",
        "Quais hábitos estou deixando de fazer?",
        "Mostre meu progresso nas metas pessoais",
        "Quantas vezes treinei esta semana?",
        "Como está minha dieta esta semana?",
        "Qual meu plano de treino atual?",
        "Quantas refeições registrei hoje?",
        "Quais rotinas tenho mais dificuldade em manter?",
        "Minha meta de ganho de massa está progredindo?",
        "Qual o histórico dos meus treinos no último mês?",
        "Preciso melhorar minha disciplina com os exercícios",
        "Mostre as tarefas pendentes de hoje",
        "Como estou indo com meus objetivos pessoais?",
    ],
    "financial": [
        "Quanto gastei em alimentação este mês?",
        "Quais foram minhas maiores despesas em março?",
        "Mostre meus gastos por categoria na semana passada",
        "Qual meu total de receitas este mês?",
        "Vou estourar meu orçamento de lazer?",
        "Quanto ainda posso gastar esta semana?",
        "Qual o status dos meus orçamentos?",
        "Quanto vou ter no final do mês?",
        "Meu saldo vai ficar negativo?",
        "Previsão de saldo para os próximos 30 dias",
        "Quais contas vencem essa semana?",
        "Qual o saldo atual das minhas contas?",
        "Quanto ainda devo no empréstimo?",
        "Quais são minhas despesas fixas?",
        "Faça um resumo financeiro do mês",
        "Onde estou gastando mais dinheiro?",
        "Qual a fatura do meu cartão de crédito?",
        "Tenho receitas recorrentes cadastradas?",
    ],
    "security": [
        "Quantas senhas tenho armazenadas?",
        "Tenho senhas desatualizadas?",
        "Como está a segurança do meu cofre?",
        "Mostre os últimos acessos registrados",
        "Quais categorias de senhas tenho?",
        "Tenho cartões armazenados no cofre?",
        "Houve atividade suspeita recentemente?",
        "Minhas senhas precisam de atualização?",
        "Quantos arquivos seguros tenho?",
        "Como está minha segurança digital?",
        "Preciso atualizar alguma senha importante?",
        "Mostre o histórico de atividade da minha conta",
    ],
    "intellect": [
        "O que aprendi com o livro Pai Rico Pobre Rico?",
        "Quais livros li nos últimos 3 meses?",
        "Que insight o autor menciona sobre investimentos?",
        "Resuma o livro que estou lendo",
        "Quais são meus destaques de leitura recentes?",
        "Que livros tenho na fila para ler?",
        "Qual meu progresso no curso de Python?",
        "Quais habilidades estou desenvolvendo?",
        "Mostre meu mapa de habilidades",
        "Quantos cursos terminei?",
        "Que livros você recomenda sobre finanças?",
        "Quais são meus livros favoritos?",
        "Me fale sobre o que aprendi no último livro",
        "Tenho algum livro de tecnologia na biblioteca?",
        "Qual o status do meu aprendizado este mês?",
    ],
    # Agentes legados — mantidos para compatibilidade
    "finance": [
        "Quanto gastei em alimentação este mês?",
        "Quais foram minhas maiores despesas em março?",
        "Mostre meus gastos por categoria na semana passada",
        "Qual meu total de receitas este mês?",
        "Onde estou gastando mais dinheiro?",
    ],
    "budget": [
        "Vou estourar meu orçamento de lazer?",
        "Quanto ainda posso gastar esta semana?",
        "Qual o status dos meus orçamentos?",
        "Estou dentro do limite de alimentação?",
        "Quanto sobrou no meu orçamento de transporte?",
    ],
    "forecast": [
        "Quanto vou ter no final do mês?",
        "Meu saldo vai ficar negativo?",
        "Previsão de saldo para os próximos 30 dias",
        "Quais contas vencem essa semana?",
        "Vai sobrar dinheiro este mês?",
    ],
    "planning": [
        "Como estão minhas rotinas esta semana?",
        "Quantas tarefas completei hoje?",
        "Meu progresso nas metas",
        "Quais hábitos estou deixando de fazer?",
        "Qual minha taxa de cumprimento de rotinas?",
    ],
    "library": [
        "O que aprendi com o livro Pai Rico Pobre Rico?",
        "Me fale sobre os livros que li",
        "Que insight o autor menciona sobre investimentos?",
        "Quais são minhas leituras recentes?",
        "Resuma o livro que estou lendo",
    ],
    "insight": [
        "Como estou financeiramente?",
        "Me dê um resumo geral da minha situação",
        "Diagnóstico financeiro completo",
        "Visão geral de tudo",
        "Briefing financeiro do mês",
    ],
}


def _normalize(text: str) -> str:
    """Remove acentos e converte para minúsculas para matching robusto."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )


def _build_registry() -> list[BaseAgent]:
    from agents.agents.budget_agent import BudgetAgent
    from agents.agents.finance_agent import FinanceAgent
    from agents.agents.financial_agent import FinancialAgent
    from agents.agents.forecast_agent import ForecastAgent
    from agents.agents.insight_agent import InsightAgent
    from agents.agents.intellect_agent import IntellectAgent
    from agents.agents.library_agent import LibraryAgent
    from agents.agents.personal_agent import PersonalAgent
    from agents.agents.planning_agent import PlanningAgent
    from agents.agents.security_agent import SecurityAgent

    return [
        # Agentes principais (novos, modulares)
        PersonalAgent(),
        FinancialAgent(),
        SecurityAgent(),
        IntellectAgent(),
        # Agentes legados (preservados para compatibilidade e roteamento
        # automático)
        FinanceAgent(),
        BudgetAgent(),
        ForecastAgent(),
        LibraryAgent(),
        PlanningAgent(),
        InsightAgent(),
    ]


def _build_name_map() -> dict[str, type[BaseAgent]]:
    from agents.agents.budget_agent import BudgetAgent
    from agents.agents.finance_agent import FinanceAgent
    from agents.agents.financial_agent import FinancialAgent
    from agents.agents.forecast_agent import ForecastAgent
    from agents.agents.insight_agent import InsightAgent
    from agents.agents.intellect_agent import IntellectAgent
    from agents.agents.library_agent import LibraryAgent
    from agents.agents.personal_agent import PersonalAgent
    from agents.agents.planning_agent import PlanningAgent
    from agents.agents.security_agent import SecurityAgent

    return {
        "personal": PersonalAgent,
        "financial": FinancialAgent,
        "security": SecurityAgent,
        "intellect": IntellectAgent,
        # Aliases para compatibilidade
        "finance": FinanceAgent,
        "budget": BudgetAgent,
        "forecast": ForecastAgent,
        "planning": PlanningAgent,
        "library": LibraryAgent,
        "insight": InsightAgent,
    }


def _is_postgres() -> bool:
    from django.db import connection

    return "postgresql" in connection.settings_dict.get("ENGINE", "")


def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _pg_all_domains_avg(
    embedding: list[float], user_pk: int
) -> dict[str, float]:
    """Uma única query SQL retornando média de similaridade
    top-3 por domínio."""
    from django.db import connection

    emb_str = "[" + ",".join(f"{x:.6f}" for x in embedding) + "]"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT domain, AVG(similarity) AS avg_sim
            FROM (
                SELECT domain,
                       1 - (embedding <=> %s::vector) AS similarity,
                       ROW_NUMBER() OVER (
                           PARTITION BY domain
                           ORDER BY embedding <=> %s::vector
                       ) AS rn
                FROM "vectors"."agent_embeddings"
                WHERE user_id = %s AND is_deleted = FALSE
            ) sub
            WHERE rn <= 3
            GROUP BY domain
            """,
            [emb_str, emb_str, user_pk],
        )
        return {row[0]: float(row[1]) for row in cursor.fetchall()}


def _py_all_domains_avg(
    embedding: list[float], user_pk: int
) -> dict[str, float]:
    """Fallback Python para SQLite (ambiente de testes)."""
    import json

    from agents.models import AgentEmbedding

    docs = AgentEmbedding.objects.filter(
        user_id=user_pk, is_deleted=False
    ).values("embedding", "domain")

    by_domain: dict[str, list[float]] = {}
    for doc in docs:
        emb = doc["embedding"]
        if isinstance(emb, str):
            try:
                emb = json.loads(emb)
            except (json.JSONDecodeError, TypeError):
                continue
        if not emb:
            continue
        sim = _cosine_sim(embedding, list(emb))
        by_domain.setdefault(doc["domain"], []).append(sim)

    return {
        domain: sum(sorted(sims, reverse=True)[:3]) / min(len(sims), 3)
        for domain, sims in by_domain.items()
        if sims
    }


def semantic_domain_scores(
    query_embedding: list[float], user_pk: int
) -> dict[str, float]:
    """Retorna similaridade média dos top-3 embeddings
    por domínio (1 query SQL)."""
    fn = _pg_all_domains_avg if _is_postgres() else _py_all_domains_avg
    return fn(query_embedding, user_pk)


# ── SemanticRouter com exemplares pré-computados
# ──────────────────────────────


class SemanticRouter:
    """
    Router semântico baseado em similaridade com queries exemplares por agente.

    Exemplares são embeddings de queries canônicas pré-computados na primeira
    chamada (lazy init). Independe do banco de embeddings do usuário.
    """

    _instance: "SemanticRouter | None" = None
    _lock = __import__("threading").Lock()

    def __init__(self) -> None:
        self._embeddings: dict[str, list[list[float]]] = {}
        self._ready = False

    @classmethod
    def get(cls) -> "SemanticRouter":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _ensure_ready(self) -> None:
        if self._ready:
            return
        logger.info(
            "SemanticRouter: pré-computando embeddings de exemplares..."
        )
        computed: dict[str, list[list[float]]] = {}
        for agent_name, queries in _AGENT_EXEMPLARS.items():
            embs = []
            for q in queries:
                emb = LLMClient.embed(q)
                if emb:
                    embs.append(emb)
            if embs:
                computed[agent_name] = embs
                logger.debug(
                    "SemanticRouter: %d exemplares carregados para '%s'",
                    len(embs),
                    agent_name,
                )
        self._embeddings = computed
        self._ready = bool(computed)
        if self._ready:
            logger.info("SemanticRouter: pronto (%d agentes)", len(computed))
        else:
            logger.warning(
                "SemanticRouter: nenhum embedding gerado"
                " — Ollama indisponível?"
            )

    def score(self, query_embedding: list[float]) -> dict[str, float]:
        """Retorna max cosine similarity entre query
        e exemplares por agente."""
        self._ensure_ready()
        if not self._embeddings:
            return {}
        return {
            agent_name: max(
                _cosine_sim(query_embedding, ex) for ex in exemplars
            )
            for agent_name, exemplars in self._embeddings.items()
        }

    def is_ready(self) -> bool:
        return self._ready


# ── AgentRouter principal
# ──────────────────────────────────────────────────────


class AgentRouter:
    @staticmethod
    def select_by_name(name: str) -> BaseAgent | None:
        """Instancia agente diretamente pelo nome,
        sem roteamento automático."""
        name_map = _build_name_map()
        cls = name_map.get(name)
        if cls is None:
            logger.warning(
                "AgentRouter.select_by_name: agente '%s' não encontrado", name
            )
            return None
        logger.info("AgentRouter: override direto para agente '%s'", name)
        return cls()

    @staticmethod
    def select(
        ctx: AgentContext, agent_override: str | None = None
    ) -> BaseAgent:
        from app.config import cfg

        # Override direto: bypassa roteamento automático
        if agent_override:
            agent = AgentRouter.select_by_name(agent_override)
            if agent is not None:
                return agent
            logger.warning(
                "AgentRouter: override '%s' inválido,"
                " usando roteamento automático",
                agent_override,
            )

        registry = _build_registry()

        # Keyword scoring com normalização de acentos
        score_map: dict[BaseAgent, float] = {
            agent: agent.can_handle(ctx.query) for agent in registry
        }

        # Roteamento semântico (opcional via config)
        semantic_enabled = (
            cfg("LLM_SEMANTIC_ROUTING_ENABLED", "true").lower() == "true"
        )
        if semantic_enabled:
            query_embedding = LLMClient.embed(ctx.query)
            if query_embedding:
                try:
                    # Bônus 1: SemanticRouter via exemplares pré-computados
                    sr = SemanticRouter.get()
                    exemplar_scores = sr.score(query_embedding)
                    for agent in registry:
                        ex_score = exemplar_scores.get(agent.name, 0.0)
                        score_map[agent] += 0.30 * ex_score

                    # Bônus 2: pgvector com histórico real do usuário (1 query
                    # SQL)
                    domain_sims = semantic_domain_scores(
                        query_embedding, ctx.user_id
                    )
                    for agent in registry:
                        domain = _AGENT_TO_DOMAIN.get(agent.name)
                        if domain:
                            score_map[agent] += 0.15 * domain_sims.get(
                                domain, 0.0
                            )

                except Exception:
                    logger.warning(
                        "AgentRouter: scoring semântico falhou,"
                        " usando apenas keyword",
                        exc_info=True,
                    )

        best_agent = max(score_map, key=lambda a: score_map[a])
        best_score = score_map[best_agent]

        if best_score < 0.2:
            from agents.agents.insight_agent import InsightAgent

            best_agent = InsightAgent()
            logger.info(
                "AgentRouter: score baixo (%.2f) → fallback InsightAgent",
                best_score,
            )
        else:
            logger.info(
                "AgentRouter: selected=%s score=%.2f query=%r",
                best_agent.name,
                best_score,
                ctx.query[:80],
            )

        # Métrica de roteamento
        try:
            from app.metrics import record_agent_routing

            routing_method = "semantic" if semantic_enabled else "keyword"
            record_agent_routing(best_agent.name, routing_method, best_score)
        except Exception:
            pass

        return best_agent

    @staticmethod
    def route(
        ctx: AgentContext, agent_override: str | None = None
    ) -> AgentResponse:
        return AgentRouter.select(ctx, agent_override=agent_override).run(ctx)
