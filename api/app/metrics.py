"""
Métricas Prometheus de negócio e LLM para o MindLedger.

Importar este módulo garante que as métricas são registradas no registry global.
As views chamam as funções auxiliares para incrementar contadores.
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
    "mindledger_expenses_created_total",
    "Total de despesas criadas",
    ["category"],
)

revenues_created_total = Counter(
    "mindledger_revenues_created_total",
    "Total de receitas criadas",
    ["category"],
)

transfers_created_total = Counter(
    "mindledger_transfers_created_total",
    "Total de transferências criadas",
)

loans_created_total = Counter(
    "mindledger_loans_created_total",
    "Total de empréstimos criados",
    ["status"],
)

vault_deposits_total = Counter(
    "mindledger_vault_deposits_total",
    "Total de depósitos em cofres",
)

vault_withdrawals_total = Counter(
    "mindledger_vault_withdrawals_total",
    "Total de saques de cofres",
)

budget_exceeded_total = Counter(
    "mindledger_budget_exceeded_total",
    "Total de orçamentos ultrapassados",
    ["category"],
)

health_score_average = Gauge(
    "mindledger_health_score_average",
    "Score médio de saúde financeira dos usuários ativos",
)

active_users_gauge = Gauge(
    "mindledger_active_users_total",
    "Total de usuários ativos (com atividade nos últimos 30 dias)",
)

webhooks_delivered_total = Counter(
    "mindledger_webhooks_delivered_total",
    "Total de webhooks entregues com sucesso",
    ["event"],
)

webhooks_failed_total = Counter(
    "mindledger_webhooks_failed_total",
    "Total de entregas de webhook que falharam",
    ["event"],
)

# ============================================================================
# LLM METRICS
# ============================================================================

llm_requests_total = Counter(
    "mindledger_llm_requests_total",
    "Total de requisições ao LLM",
    ["provider", "agent", "status"],
)

llm_tokens_total = Counter(
    "mindledger_llm_tokens_total",
    "Total de tokens estimados consumidos",
    ["provider", "type"],  # values: input | output
)

llm_request_duration_seconds = Histogram(
    "mindledger_llm_request_duration_seconds",
    "Latência das requisições ao LLM",
    ["provider", "agent"],
    buckets=[0.5, 1, 2, 5, 10, 20, 30, 60],
)

llm_fallback_total = Counter(
    "mindledger_llm_fallback_total",
    "Total de vezes que o fallback de provider foi acionado",
    ["from_provider", "to_provider"],
)

llm_stream_sessions_total = Counter(
    "mindledger_llm_stream_sessions_total",
    "Total de sessões de streaming LLM",
    ["agent"],
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
    llm_requests_total.labels(provider=provider, agent=agent, status=status).inc()
    llm_request_duration_seconds.labels(provider=provider, agent=agent).observe(
        duration_s
    )
    if tokens_in:
        llm_tokens_total.labels(provider=provider, type="input").inc(tokens_in)
    if tokens_out:
        llm_tokens_total.labels(provider=provider, type="output").inc(tokens_out)


def record_llm_fallback(from_provider: str, to_provider: str) -> None:
    llm_fallback_total.labels(
        from_provider=from_provider, to_provider=to_provider
    ).inc()


def record_llm_stream_session(agent: str) -> None:
    llm_stream_sessions_total.labels(agent=agent).inc()
