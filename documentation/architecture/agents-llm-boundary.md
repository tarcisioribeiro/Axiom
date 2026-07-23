# Fronteiras do módulo LLM (`agents/`)

Este documento descreve as fronteiras internas do módulo de agentes/LLM
(`apps/api/agents/`) — o que é acoplado ao restante do backend Django e o
que já é (ou pode se tornar) uma camada independente. Complementa
[`documentation/backend/agents.md`](../backend/agents.md) (arquitetura
funcional e pipeline de request) e
[`documentation/llm/infrastructure.md`](../llm/infrastructure.md) (infra do
Ollama externo).

## Duas camadas dentro de `agents/`

```
agents/
├── core/        ← "motor LLM": chat, memória, roteamento, compressão
├── agents/       ← agentes de domínio (finance, budget, forecast, ...)
├── tools/        ← funções de dados consumidas pelos agentes de domínio
├── providers/    ← ÚNICO ponto de import de models de outros apps
└── views.py      ← endpoints HTTP (ask/, stream/, history/, ...)
```

**`core/`** é o motor de LLM propriamente dito: seleção/roteamento de
provider, cliente HTTP multi-provider, memória de conversa, compressão de
contexto, sumarização. É consumido pela camada de agentes de domínio, mas
não sabe nada sobre finanças, orçamentos ou biblioteca.

**`agents/agents/` + `agents/tools/` + `views.py`** são os "agentes de
domínio": sabem buscar dados financeiros/pessoais/de biblioteca, montar
prompts e decidir qual agente deve responder a uma pergunta. Dependem
diretamente do resto do backend Django (ORM, sessão, usuário autenticado).

## O que já é portável hoje

`core/llm_client.py` (`LLMClient`) não tem nenhuma dependência do ORM
Django — usa apenas `app.config.cfg()` (que cai para `os.getenv()` fora de
um contexto Django) e imports opcionais/soft de `django.core.cache` e
`app.metrics`, sempre protegidos por `try/except`. Junto de
`circuit_breaker.py`, `prompts.py`, `temporal.py`, `response_formatter.py`,
`context_compressor.py` e `summarizer.py`, esse conjunto é o candidato
natural para um futuro serviço externo (ex.: um microsserviço de LLM
separado, ou uma lib compartilhada) — não precisariam de nenhuma mudança
estrutural para isso.

`memory.py` (persistência de conversa em Redis + PostgreSQL), `router.py`
(seleção de agente) e toda a camada de `agents/agents/` + `agents/tools/`
ficam presos ao Django: precisam do ORM, da sessão HTTP e do usuário
autenticado. Não são candidatos a extração sem uma reformulação maior (ex.:
expor os dados via API interna em vez de ORM direto).

## Regra da fronteira: `agents/providers/`

Só o pacote `agents/providers/` importa models de outros apps Django
(`accounts`, `expenses`, `revenues`, `budgets`, `personal_planning`,
`library`, `security`). Todo o restante de `agents/` — `agents/agents/*.py`,
`agents/tools/*.py`, `views.py` — consome esses dados exclusivamente através
das funções expostas pelos providers:

| Provider | Cobre | Consumido por |
|---|---|---|
| `financial_provider.py` | `accounts`, `expenses`, `revenues`, `budgets` | `tools/financial_tools.py`, `tools/forecast_tools.py`, `tools/budget_tools.py` |
| `personal_provider.py` | `personal_planning` | `tools/planning_tools.py`, `tools/personal_tools.py` |
| `library_provider.py` | `library` | `agents/library_agent.py`, `agents/intellect_agent.py`, `views.py` |
| `security_provider.py` | `security` | `tools/security_tools.py`, `views.py` |

Os providers expõem funções simples (recebem `user`/ids/datas, devolvem
dicts/listas) — não é uma camada de abstração genérica (sem repositórios,
DTOs ou interfaces ABC), só um ponto único e nomeado de acesso ao ORM. A
lógica de negócio (cache, formatação, projeções) permanece em `tools/` e
`agents/agents/`; os providers só fazem a query.

### Exceção documentada: `tasks.py` e `management/commands/`

`agents/tasks.py` (tasks Celery em batch — insights semanais, notificações)
e `agents/management/commands/{index_library,vectorize_existing}.py`
(scripts de indexação offline) continuam importando models de outros apps
diretamente. Não fazem parte do caminho de request interativo (`ask/`,
`stream/`) que esta fronteira isola, e já são pontos nativamente acoplados
ao Django (jobs em batch/management commands, não endpoints). Estender a
regra a eles não traria benefício de isolamento real.

## Por que isso importa

1. **Auditoria de acoplamento**: para saber tudo que `agents/` lê do resto
   do backend, basta olhar os 4 arquivos em `providers/` — não é preciso
   varrer `tools/`, `agents/agents/` e `views.py` inteiros.
2. **Extração futura**: se o "motor LLM" (`core/`) for extraído para um
   serviço separado, a camada de agentes de domínio (que fica no Django)
   passa a ser o único cliente desse serviço — a fronteira de dados
   (`providers/`) já está isolada da fronteira de LLM (`core/`).
3. **Testabilidade**: mockar uma função de provider é mais simples e mais
   estável do que mockar uma query ORM inline dentro de uma tool.
