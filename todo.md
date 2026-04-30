# Agents AI — Plano de Implementação

> Referência: conversa de planejamento em 2026-04-30.
> Cada seção é um issue GitLab independente, implementável em sessões separadas.
> Ordem sugerida: Fase 1 → Fase 4 → Fase 3 → Fase 2 → Fase 5 → Fase 6.

---

## Issue 1 — feat(agents): schema vetorial pgvector + model AgentEmbedding + command vectorize_existing

**Labels**: `feat`, `agents`, `backend`, `database`
**Milestone**: Agents v2
**Depende de**: nada (ponto de partida)

### Descrição

Substituir o campo `embedding_json` (texto JSON) do modelo `EmbeddingDocument` por um `VectorField` real do pgvector, armazenado num schema dedicado `vectors` dentro do PostgreSQL existente. Criar o management command `vectorize_existing` para popular o novo schema com os registros já existentes no banco.

### Contexto técnico

- Modelo atual: `agents/models.py::EmbeddingDocument` com campo `embedding_json = TextField`
- Pacote a instalar: `pgvector` (suporte nativo a Django com `VectorField`)
- O schema `vectors` é criado via `RunSQL` em migration — sem container adicional
- `db_table = '"vectors"."agent_embeddings"'` funciona no PostgreSQL com Django

### Acceptance Criteria

**Schema e modelo:**
- [ ] `pgvector` adicionado em `api/requirements.txt` (versão exata, sem `^`)
- [ ] Migration com `RunSQL` que executa `CREATE EXTENSION IF NOT EXISTS vector` e `CREATE SCHEMA IF NOT EXISTS vectors`
- [ ] Novo model `AgentEmbedding` em `agents/models.py` com campos:
  - `id` (UUID PK)
  - `user` (FK → User)
  - `domain` (CharField choices: `finance`, `budget`, `planning`, `library`, `general`)
  - `source_type` (CharField: `expense`, `revenue`, `budget`, `task`, `goal`, `routine`, `book_summary`, `reading_note`, `highlight`, `credit_card_bill`)
  - `source_id` (UUIDField)
  - `source_title` (CharField 255)
  - `content` (TextField — frase em linguagem natural que foi embedada)
  - `embedding` (VectorField dim=768)
  - `is_deleted` (BooleanField default=False)
  - `created_at`, `updated_at` (auto)
  - `Meta.db_table = '"vectors"."agent_embeddings"'`
- [ ] Índice IVFFLAT: `USING ivfflat (embedding vector_cosine_ops)` via `AddIndex` na migration
- [ ] Índice composto `(user_id, domain)` na migration
- [ ] Índice em `source_id` na migration
- [ ] `EmbeddingDocument` original mantido com `managed=True` para não quebrar migration history; adicionado deprecation comment

**Management command `vectorize_existing`:**
- [ ] Arquivo `agents/management/commands/vectorize_existing.py`
- [ ] Argumentos:
  - `--domain` (choices: `finance`, `budget`, `planning`, `library`, `all`; default: `all`)
  - `--reset` (flag: limpa embeddings do domínio antes de reprocessar)
  - `--batch-size` (int, default: 50)
  - `--user` (username: processa apenas um usuário)
- [ ] Geração de texto natural por source_type:
  - `expense`: `"Despesa de R$ {value} em {category} — {merchant} em {date}"`
  - `revenue`: `"Receita de R$ {value} em {category} em {date}"`
  - `budget`: `"Orçamento de {category}: limite R$ {limit}, gasto R$ {spent} ({pct}%) em {month}/{year}"`
  - `task`/`routine`: `"Rotina '{name}': {description}, frequência {frequency}"`
  - `goal`: `"Meta '{title}': {description}, progresso {progress}%, prazo {deadline}"`
  - `book_summary`/`reading_note`/`highlight`: conteúdo original (já é texto)
- [ ] Barra de progresso via `self.stdout.write` com contador `[N/Total]`
- [ ] Erros por registro são logados mas não abortam o lote (`try/except` por item)
- [ ] Uso do `LLMClient.embed()` existente para gerar os vetores
- [ ] Ao final: resumo `"Domínio X: N embeddings gerados, M erros"`

**Busca vetorial atualizada em `rag_tools.py`:**
- [ ] Função `search_embeddings(query, user, domain, top_k=5)` substitui `search_library_chunks`
- [ ] `_pgvector_search`: query na tabela `vectors.agent_embeddings` filtrando por `user_id` e `domain`, usando operador `<=>` (cosine distance), retornando `1 - distance` como score
- [ ] `_python_search`: fallback cosine similarity em Python (para testes com SQLite)
- [ ] `_fallback_keyword_search`: fallback por `content__icontains` quando embedding falha
- [ ] `search_library_chunks` redirecionada para `search_embeddings(domain='library')` para não quebrar `LibraryAgent`

**Testes:**
- [ ] Testes unitários do command `vectorize_existing` com mock do `LLMClient.embed`
- [ ] Teste de `search_embeddings` com Python fallback (SQLite)
- [ ] `ci-check.sh` passa sem erros

---

## Issue 2 — feat(agents): auto-vetorização de novos registros via Django signals

**Labels**: `feat`, `agents`, `backend`
**Milestone**: Agents v2
**Depende de**: Issue 1

### Descrição

Cada novo registro criado ou atualizado no sistema deve gerar automaticamente um embedding no schema `vectors.agent_embeddings`. Implementar via signal handlers nos apps existentes, usando `transaction.on_commit()` para garantir consistência.

### Contexto técnico

- Apps com signals já existentes: `expenses`, `revenues`, `loans`, `payables`, `personal_planning`, `transfers`
- Apps sem signals ainda: `budgets`, `library`, `credit_cards`
- `transaction.on_commit(lambda: generate_embedding(...))` — embedding gerado após commit, não durante o request
- Service centralizado em `agents/services/embedding_service.py`

### Acceptance Criteria

**Service `agents/services/embedding_service.py`:**
- [ ] Função `generate_embedding_for_instance(instance, domain, source_type, content_fn)`:
  - Recebe a instância do model, o domínio, o source_type e uma função que gera o texto natural
  - Chama `LLMClient.embed(content)`
  - Faz upsert em `AgentEmbedding` (atualiza se `source_id` já existe, cria se não)
  - Marca `is_deleted=True` se `instance.is_deleted` for True
  - Silencia exceções — falha no embedding não deve quebrar o request principal
- [ ] Função `delete_embedding_for_instance(source_id)`: marca `is_deleted=True`

**Signal handlers por app:**

- [ ] `expenses/signals.py`: `post_save` em `Expense` → domain `finance`, source_type `expense`
- [ ] `revenues/signals.py`: `post_save` em `Revenue` → domain `finance`, source_type `revenue`
- [ ] `budgets/signals.py`: criar signals; `post_save` em `Budget` → domain `budget`, source_type `budget`; registrar em `budgets/apps.py::ready()`
- [ ] `personal_planning/signals.py`: `post_save` em `RoutineTask` → domain `planning`, source_type `routine`; `post_save` em `Goal` → domain `planning`, source_type `goal`
- [ ] `library/signals.py`: criar signals; `post_save` em `BookSummary` → domain `library`, source_type `book_summary`; `post_save` em `ReadingNote` → domain `library`, source_type `reading_note`; registrar em `library/apps.py::ready()`
- [ ] `credit_cards/signals.py`: `post_save` em `CreditCardExpense` (se existir) → domain `finance`, source_type `credit_card_bill`

**Cada handler:**
- [ ] Usa `transaction.on_commit()` internamente
- [ ] Não bloqueia o request (sem await, sem thread explícita — o on_commit é suficiente para operações rápidas; se latência do Ollama for problema, usar `threading.Thread` ou Celery futuramente)
- [ ] Soft-delete: se `instance.is_deleted`, chama `delete_embedding_for_instance` em vez de gerar

**Testes:**
- [ ] Teste de integração: criar um `Expense` → verificar que `AgentEmbedding` é criado (mock do LLMClient.embed)
- [ ] Teste de soft-delete: setar `is_deleted=True` → verificar que embedding é marcado como deletado
- [ ] `ci-check.sh` passa

---

## Issue 3 — feat(agents): modelo LLM específico por agente

**Labels**: `feat`, `agents`, `backend`
**Milestone**: Agents v2
**Depende de**: nada (independente)

### Descrição

Cada agente declara o modelo LLM mais adequado à sua natureza. `LLMClient` passa a aceitar `model` como parâmetro por chamada, sobrescrevendo o env var global. Novos modelos Ollama são adicionados ao docker-compose.

### Contexto técnico

- Hoje: `OLLAMA_MODEL` e `ANTHROPIC_MODEL` são globais, iguais para todos os agentes
- Mudança: `BaseAgent.ollama_model` e `BaseAgent.anthropic_model` como atributos de classe
- `LLMClient.chat(messages, model=None)` — `model` opcional, usa o global se None

### Acceptance Criteria

**`agents/core/llm_client.py`:**
- [ ] `LLMClient.chat(messages, stream=False, model=None)`: se `model` fornecido, usa-o; caso contrário, usa `settings.OLLAMA_MODEL` / `settings.ANTHROPIC_MODEL`
- [ ] `LLMClient.stream_chat(messages, model=None)`: novo método gerador que faz streaming — yields tokens (str) conforme chegam
  - Ollama: `POST /api/chat` com `"stream": true`, itera sobre linhas JSON `{"message": {"content": "..."}}`
  - Anthropic: usa `client.messages.stream()` context manager, yields `event.delta.text`
- [ ] Compatibilidade mantida: `chat()` sem `model` continua funcionando igual ao atual

**`agents/core/base_agent.py`:**
- [ ] Atributos de classe: `ollama_model: str` e `anthropic_model: str` com defaults do env var
- [ ] Método `get_model() -> str`: retorna `self.ollama_model` se provider=ollama, `self.anthropic_model` se provider=anthropic
- [ ] Método `run()` passa `model=self.get_model()` para o LLMClient

**Modelos por agente (em cada arquivo `agents/agents/*.py`):**

- [ ] `FinanceAgent`: `ollama_model = "qwen2.5:7b"`, `anthropic_model = "claude-haiku-4-5-20251001"`
- [ ] `BudgetAgent`: `ollama_model = "qwen2.5:7b"`, `anthropic_model = "claude-haiku-4-5-20251001"`
- [ ] `ForecastAgent`: `ollama_model = "qwen2.5:14b"`, `anthropic_model = "claude-sonnet-4-6"`
- [ ] `PlanningAgent`: `ollama_model = "llama3.1:8b"`, `anthropic_model = "claude-haiku-4-5-20251001"`
- [ ] `LibraryAgent`: `ollama_model = "llama3.1:8b"`, `anthropic_model = "claude-sonnet-4-6"`
- [ ] `InsightAgent`: `ollama_model = "llama3.1:8b"`, `anthropic_model = "claude-sonnet-4-6"`

**`docker-compose.yml`:**
- [ ] Bloco de pull do container `ollama` inclui: `qwen2.5:7b`, `qwen2.5:14b`, `llama3.1:8b` (além do `mistral:7b-instruct` e `nomic-embed-text` já existentes)
- [ ] Limite de memória do container `ollama` revisado se necessário (14b precisa de mais RAM)

**`agents/views.py` — endpoint `/status/`:**
- [ ] Retorna lista de agentes com o modelo que cada um usará no provider atual

**Testes:**
- [ ] Teste unitário: `FinanceAgent.get_model()` retorna `qwen2.5:7b` quando provider=ollama
- [ ] Teste unitário: `LLMClient.chat(messages, model="custom-model")` envia `"model": "custom-model"` no payload
- [ ] `ci-check.sh` passa

---

## Issue 4 — feat(agents): streaming SSE no backend

**Labels**: `feat`, `agents`, `backend`
**Milestone**: Agents v2
**Depende de**: Issue 3 (precisa do `stream_chat` no LLMClient)

### Descrição

Criar endpoint de streaming `POST /api/v1/agents/stream/` que retorna `StreamingHttpResponse` em formato SSE (Server-Sent Events). Resposta aparece token a token. Endpoint `/ask/` existente é mantido para compatibilidade.

### Contexto técnico

- Django `StreamingHttpResponse` com `content_type="text/event-stream"`
- Formato SSE: cada linha é `data: {json}\n\n`
- CSRF: decorar a view com `@csrf_exempt` (autenticação via JWT cookie continua funcionando — o CSRF só é problema para form submissions, não para fetch com Bearer/cookie JWT)
- GZip middleware pode bufferizar o stream — view deve setar `X-Accel-Buffering: no` no header

### Acceptance Criteria

**`agents/views.py` — nova `AgentStreamView`:**
- [ ] Endpoint: `POST /api/v1/agents/stream/`
- [ ] Mesma `AgentAskSerializer` para validação do request (`query`, `session_id`, `date_from`, `date_to`, `forecast_days`)
- [ ] Gera `query_id = str(uuid.uuid4())` no início do request
- [ ] Chama o router para selecionar o agente (mesma lógica do `/ask/`)
- [ ] Agente expõe método `stream(query, metadata) -> Generator[str, None, None]` que:
  1. Monta o contexto (DB queries via tools)
  2. Chama `LLMClient.stream_chat(messages, model=self.get_model())`
  3. Yields cada token recebido
- [ ] View itera sobre os tokens e yields linhas SSE:
  - Por token: `f'data: {{"token": {json.dumps(token)}}}\n\n'`
  - Ao final: `f'data: {{"done": true, "agent": "{agent_name}", "sources": {json.dumps(sources)}, "query_id": "{query_id}"}}\n\n'`
- [ ] Após o stream terminar: salva conversa completa em Redis + DB (mesmo comportamento do `/ask/`)
- [ ] Headers obrigatórios na response:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `X-Accel-Buffering: no`
- [ ] `@method_decorator(csrf_exempt)` na view (JWT cookie não depende de CSRF token)
- [ ] Tratamento de `GeneratorExit` / cliente desconectado: encerra o stream graciosamente

**`agents/core/base_agent.py`:**
- [ ] Método `stream(query: str, metadata: dict) -> Generator[str, None, None]`: versão streaming do `run()`
- [ ] Cada agente herda `stream()` sem precisar sobrescrever (usa `stream_chat` do LLMClient)

**`agents/urls.py`:**
- [ ] `path('stream/', AgentStreamView.as_view(), name='agent-stream')`

**Testes:**
- [ ] Teste do endpoint `/stream/`: resposta é `text/event-stream`, contém eventos `token` e evento `done`
- [ ] Teste de mock do LLMClient: tokens chegam na ordem correta
- [ ] Teste de desconexão: sem exceção não tratada
- [ ] `ci-check.sh` passa

---

## Issue 5 — feat(agents): query_id + roteamento aprimorado com vetor semântico

**Labels**: `feat`, `agents`, `backend`
**Milestone**: Agents v2
**Depende de**: Issue 1, Issue 2

### Descrição

Adicionar `query_id` rastreável em toda a pipeline. Melhorar o roteamento combinando o score por palavras-chave atual com um score semântico baseado em similaridade vetorial, usando embeddings de perguntas-exemplo por domínio.

### Contexto técnico

- Roteamento atual: keyword matching puro (`router.py`)
- Melhoria: embed a pergunta do usuário → comparar com centroide vetorial de cada domínio → bônus de score para o domínio mais próximo
- `query_id` salvo em `AgentConversation` e retornado em todos os responses

### Acceptance Criteria

**`agents/models.py` — `AgentConversation`:**
- [ ] Novo campo `query_id = UUIDField(null=True, blank=True, db_index=True)`
- [ ] Migration gerada e commitada

**`agents/views.py`:**
- [ ] `AgentAskView` e `AgentStreamView` geram `query_id = uuid.uuid4()` no início
- [ ] `query_id` incluído no response JSON do `/ask/` e no evento `done` do `/stream/`
- [ ] `query_id` salvo ao criar registros `AgentConversation`

**`agents/core/router.py` — roteamento semântico:**
- [ ] Função `semantic_domain_scores(query_embedding, user) -> dict[str, float]`:
  - Para cada domínio, busca os 3 embeddings mais próximos em `vectors.agent_embeddings`
  - Calcula média dos scores de similaridade
  - Retorna dict `{domain: avg_similarity}`
- [ ] `AgentRouter.route(query, user, metadata)`:
  1. Calcula keyword scores (igual ao atual)
  2. Embeda a query com `LLMClient.embed(query)` (pode falhar silenciosamente)
  3. Se embedding disponível: calcula semantic scores e adiciona bônus de `0.15 * semantic_score` ao keyword score do agente correspondente ao domínio
  4. Seleciona agente com maior score final
  5. Fallback: InsightAgent se score máximo < 0.2 (igual ao atual)
- [ ] Se `LLMClient.embed()` falhar (Ollama offline), roteamento continua apenas com keywords sem erro

**Testes:**
- [ ] Teste: `query_id` presente no response do `/ask/`
- [ ] Teste: roteamento semântico com mock de embeddings seleciona domínio correto
- [ ] Teste: roteamento degrada graciosamente quando embed falha (só keywords)
- [ ] `ci-check.sh` passa

---

## Issue 6 — feat(agents): frontend streaming UI + bloqueio de input

**Labels**: `feat`, `agents`, `frontend`
**Milestone**: Agents v2
**Depende de**: Issue 4

### Descrição

Consumir o endpoint SSE `/api/v1/agents/stream/` no frontend. Texto da resposta aparece token a token. Input e botão de envio ficam bloqueados enquanto a resposta não terminar. Cursor piscando indica que o agente está escrevendo.

### Contexto técnico

- Página de chat dos agentes: `frontend/src/pages/Agents.tsx` (arquivo novo, não commitado ainda)
- Consumo de SSE via `fetch` + `ReadableStream` (não `EventSource`, pois precisa de POST com body)
- Hook em `frontend/src/hooks/use-agent-stream.ts`
- Serviço atual em `frontend/src/services/agent-service.ts`

### Acceptance Criteria

**`frontend/src/services/agent-service.ts`:**
- [ ] Método `stream(payload: AgentAskPayload): AsyncGenerator<AgentStreamEvent>`:
  - Faz `fetch` para `/api/v1/agents/stream/` com `method: POST`, `body: JSON.stringify(payload)`, `credentials: 'include'`
  - Lê `response.body` como `ReadableStream`
  - Parseia linhas SSE: split por `\n\n`, extrai `data:` JSON
  - Yields cada evento parseado
  - Yield evento `done` ao receber `{"done": true, ...}`

**`frontend/src/hooks/use-agent-stream.ts`:**
- [ ] Estado: `isStreaming: boolean`, `accumulatedText: string`, `currentAgent: string | null`, `sources: string[]`, `queryId: string | null`, `error: string | null`
- [ ] Método `send(query: string, sessionId: string)`:
  - Seta `isStreaming = true`, limpa `accumulatedText`
  - Consome o `agentService.stream()` via `for await`
  - Acumula tokens: `accumulatedText += event.token`
  - Ao receber `done`: seta `currentAgent`, `sources`, `queryId`, `isStreaming = false`
  - Em erro: seta `error`, `isStreaming = false`
- [ ] `AbortController` para cancelar o stream se necessário (ex: usuário navega para outra página)
- [ ] Cleanup no `useEffect` — cancela stream se componente desmonta

**`frontend/src/pages/Agents.tsx` (ou componente de chat):**
- [ ] Input de texto: `disabled={isStreaming}`
- [ ] Botão de enviar: `disabled={isStreaming}`
- [ ] Mensagem do agente em streaming:
  - Renderiza `accumulatedText` em tempo real
  - Cursor piscando `|` no final do texto enquanto `isStreaming` (CSS `animate-pulse` ou `animate-blink`)
  - Ao terminar: exibe badge com nome do agente (`currentAgent`) e lista de fontes (`sources`)
- [ ] Histórico de mensagens: rola automaticamente para o final a cada token (`scrollIntoView`)
- [ ] Estado de erro: exibe toast destrutivo se `error` setado
- [ ] Indicador visual durante conexão inicial (antes do primeiro token): spinner ou "Agente está processando..."

**i18n:**
- [ ] Chaves adicionadas em `frontend/src/i18n/locales/pt-BR.json` e `en-US.json`:
  - `agents.streaming.processing`
  - `agents.streaming.typing`
  - `agents.streaming.sources`
  - `agents.streaming.error`

**Testes:**
- [ ] Teste do hook `useAgentStream`: mock do `agentService.stream`, verifica acumulação de tokens
- [ ] Teste: input desabilitado durante `isStreaming=true`
- [ ] Teste: input habilitado após evento `done`
- [ ] `npm run test -- --run` passa

---

## Checklist de conclusão (preencher ao final de todas as fases)

- [ ] Issue 1 concluída e merged
- [ ] Issue 2 concluída e merged
- [ ] Issue 3 concluída e merged
- [ ] Issue 4 concluída e merged
- [ ] Issue 5 concluída e merged
- [ ] Issue 6 concluída e merged
- [ ] `docker compose up --build -d` passa sem erros
- [ ] `vectorize_existing --domain all` executa com sucesso em produção
- [ ] Modelos Ollama adicionais baixados no container (`qwen2.5:7b`, `qwen2.5:14b`, `llama3.1:8b`)
- [ ] Streaming testado manualmente no browser (tokens aparecem em tempo real)
- [ ] Input bloqueado durante resposta verificado manualmente
