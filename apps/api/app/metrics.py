"""
Métricas Prometheus de negócio, LLM e roteamento de agentes para o Axiom.
"""

from prometheus_client import (  # type: ignore[import-not-found]
    Counter,
    Gauge,
    Histogram,
)

# ============================================================================
# BUSINESS METRICS
# ============================================================================

expenses_created_total = Counter(
    "axiom_expenses_created_total",
    "Total de despesas criadas",
    ["category"],
)

revenues_created_total = Counter(
    "axiom_revenues_created_total",
    "Total de receitas criadas",
    ["category"],
)

transfers_created_total = Counter(
    "axiom_transfers_created_total",
    "Total de transferências criadas",
)

loans_created_total = Counter(
    "axiom_loans_created_total",
    "Total de empréstimos criados",
    ["status"],
)

vault_deposits_total = Counter(
    "axiom_vault_deposits_total",
    "Total de depósitos em cofres",
)

vault_withdrawals_total = Counter(
    "axiom_vault_withdrawals_total",
    "Total de saques de cofres",
)

budget_exceeded_total = Counter(
    "axiom_budget_exceeded_total",
    "Total de orçamentos ultrapassados",
    ["category"],
)

health_score_average = Gauge(
    "axiom_health_score_average",
    "Score médio de saúde financeira dos usuários ativos",
)

active_users_gauge = Gauge(
    "axiom_active_users_total",
    "Total de usuários ativos (com atividade nos últimos 30 dias)",
)

webhooks_delivered_total = Counter(
    "axiom_webhooks_delivered_total",
    "Total de webhooks entregues com sucesso",
    ["event"],
)

webhooks_failed_total = Counter(
    "axiom_webhooks_failed_total",
    "Total de entregas de webhook que falharam",
    ["event"],
)

# ============================================================================
# LLM METRICS
# ============================================================================

llm_requests_total = Counter(
    "axiom_llm_requests_total",
    "Total de requisições ao LLM",
    ["provider", "agent", "status"],
)

llm_tokens_total = Counter(
    "axiom_llm_tokens_total",
    "Total de tokens estimados consumidos",
    ["provider", "type"],  # values: input | output
)

llm_request_duration_seconds = Histogram(
    "axiom_llm_request_duration_seconds",
    "Latência das requisições ao LLM",
    ["provider", "agent"],
    buckets=[0.5, 1, 2, 5, 10, 20, 30, 60],
)

llm_fallback_total = Counter(
    "axiom_llm_fallback_total",
    "Total de vezes que o fallback de provider foi acionado",
    ["from_provider", "to_provider"],
)

llm_stream_sessions_total = Counter(
    "axiom_llm_stream_sessions_total",
    "Total de sessões de streaming LLM",
    ["agent"],
)

# ============================================================================
# AGENT ROUTING METRICS
# ============================================================================

agent_routing_decisions_total = Counter(
    "axiom_agent_routing_decisions_total",
    "Decisões de roteamento por agente selecionado e método",
    [
        "agent_name",
        "routing_method",
    ],  # routing_method: keyword | semantic | fallback
)

agent_routing_score = Histogram(
    "axiom_agent_routing_score",
    "Score de confiança do roteamento (0.0–1.0)",
    ["agent_name"],
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

agent_fallback_total = Counter(
    "axiom_agent_fallback_total",
    "Ativações do InsightAgent por fallback (score < threshold)",
)

agent_context_build_duration_seconds = Histogram(
    "axiom_agent_context_build_duration_seconds",
    "Latência de build_context() por agente",
    ["agent_name"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

agent_context_timeout_total = Counter(
    "axiom_agent_context_timeout_total",
    "Total de timeouts em build_context() por agente",
    ["agent_name"],
)

agent_session_context_turns = Histogram(
    "axiom_agent_session_context_turns",
    "Número de turns (mensagens) no contexto de sessão",
    buckets=[0, 2, 4, 6, 8, 10, 14, 20],
)

ollama_circuit_breaker_open_total = Counter(
    "axiom_ollama_circuit_breaker_open_total",
    "Total de vezes que o circuit breaker do Ollama abriu",
)

embedding_cache_hits_total = Counter(
    "axiom_embedding_cache_hits_total",
    "Cache hits em embeddings de query",
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def record_expense_created(category: str) -> None:
    expenses_created_total.labels(category=category).inc()


def record_revenue_created(category: str) -> None:
    revenues_created_total.labels(category=category).inc()


def record_transfer_created() -> None:
    transfers_created_total.inc()


def record_loan_created(loan_status: str = "active") -> None:
    loans_created_total.labels(status=loan_status).inc()


def record_vault_deposit() -> None:
    vault_deposits_total.inc()


def record_vault_withdrawal() -> None:
    vault_withdrawals_total.inc()


def record_budget_exceeded(category: str) -> None:
    budget_exceeded_total.labels(category=category).inc()


def record_webhook_delivered(event: str) -> None:
    webhooks_delivered_total.labels(event=event).inc()


def record_webhook_failed(event: str) -> None:
    webhooks_failed_total.labels(event=event).inc()


def record_llm_request(
    provider: str,
    agent: str,
    status: str,
    duration_s: float,
    tokens_in: int = 0,
    tokens_out: int = 0,
) -> None:
    llm_requests_total.labels(
        provider=provider, agent=agent, status=status
    ).inc()
    llm_request_duration_seconds.labels(
        provider=provider, agent=agent
    ).observe(duration_s)
    if tokens_in:
        llm_tokens_total.labels(provider=provider, type="input").inc(tokens_in)
    if tokens_out:
        llm_tokens_total.labels(provider=provider, type="output").inc(
            tokens_out
        )


def record_llm_fallback(from_provider: str, to_provider: str) -> None:
    llm_fallback_total.labels(
        from_provider=from_provider, to_provider=to_provider
    ).inc()


def record_llm_stream_session(agent: str) -> None:
    llm_stream_sessions_total.labels(agent=agent).inc()


def record_agent_routing(
    agent_name: str, routing_method: str, score: float
) -> None:
    agent_routing_decisions_total.labels(
        agent_name=agent_name, routing_method=routing_method
    ).inc()
    agent_routing_score.labels(agent_name=agent_name).observe(score)
    if agent_name == "insight" and routing_method == "fallback":
        agent_fallback_total.inc()


def record_agent_context_build(agent_name: str, duration_s: float) -> None:
    agent_context_build_duration_seconds.labels(agent_name=agent_name).observe(
        duration_s
    )


def record_agent_context_timeout(agent_name: str) -> None:
    agent_context_timeout_total.labels(agent_name=agent_name).inc()


def record_session_context_size(n_turns: int) -> None:
    agent_session_context_turns.observe(n_turns)


def record_embedding_cache_hit() -> None:
    embedding_cache_hits_total.inc()
