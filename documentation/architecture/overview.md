# Visão Geral da Arquitetura

## Introdução

O Axiom é construído sobre uma arquitetura full-stack moderna, utilizando um monorepo que combina backend Django REST Framework e frontend React com TypeScript. A arquitetura foi projetada para ser modular, escalável e segura, com separação clara de responsabilidades entre as camadas.

Este documento apresenta a visão geral da arquitetura do sistema, suas camadas principais, padrões arquiteturais adotados e como os componentes se comunicam entre si.

## Arquitetura de Alto Nível

```mermaid
graph TB
    subgraph "Camada de Apresentação"
        Browser[Navegador Web]
        UI[Interface React]
        Store[Zustand Store]
        Router[React Router]
    end

    subgraph "Camada de API/Gateway"
        APIClient[API Client]
        Interceptors[Interceptors]
        ErrorHandler[Error Handler]
    end

    subgraph "Camada de Backend"
        Middleware[Middleware Layer]
        Auth[Autenticação JWT]
        DRF[Django REST Framework]

        subgraph "Apps Django"
            Finance[Finance Apps]
            Security[Security App]
            Library[Library App]
            AI[AI Assistant]
        end

        Encryption[Field Encryption]
        Permissions[Permission System]
    end

    subgraph "Camada de Dados"
        PostgreSQL[(PostgreSQL)]
        PGVector[pgvector Extension]
        Cache[Cache Layer]
    end

    subgraph "LLM Providers (via LLM_PROVIDER)"
        Ollama[Ollama local]
        Groq[Groq cloud]
        Anthropic[Anthropic Claude]
        OpenAI[OpenAI]
    end

    Browser --> UI
    UI --> Store
    UI --> Router
    Store --> APIClient
    APIClient --> Interceptors
    Interceptors --> ErrorHandler

    APIClient --> Middleware
    Middleware --> Auth
    Auth --> DRF

    DRF --> Finance
    DRF --> Security
    DRF --> Library
    DRF --> AI

    Finance --> Encryption
    Security --> Encryption
    Finance --> Permissions
    Security --> Permissions
    Library --> Permissions

    Finance --> PostgreSQL
    Security --> PostgreSQL
    Library --> PostgreSQL
    AI --> PostgreSQL
    AI --> PGVector

    Finance -.-> Cache
    Security -.-> Cache
    Library -.-> Cache

    AI --> Ollama
    AI -.-> Groq
    AI -.-> Anthropic
    AI -.-> OpenAI
```

## Estrutura do Monorepo

O projeto organiza o código em dois grandes agrupamentos na raiz — `apps/`
(código de produto: backend, frontend e mobile) e `infra/` (operação: Kubernetes,
Docker Compose e scripts) — além de `documentation/` e `e2e/`:

```
Axiom/
├── apps/
│   ├── api/                    # Backend Django (porta 39100)
│   │   ├── accounts/           # Contas bancárias
│   │   ├── credit_cards/       # Cartões de crédito e faturas
│   │   ├── expenses/           # Despesas
│   │   ├── revenues/           # Receitas
│   │   ├── loans/              # Empréstimos
│   │   ├── transfers/          # Transferências entre contas
│   │   ├── payables/           # Contas a pagar
│   │   ├── receivables/        # Contas a receber
│   │   ├── vaults/             # Cofres (poupança com objetivo)
│   │   ├── budgets/            # Orçamentos por categoria
│   │   ├── bank_reconciliation/ # Conciliação bancária (OFX/CSV)
│   │   ├── monthly_planning/   # Overrides de planejamento mensal
│   │   ├── exchange_rates/     # Cotações BRL (BCB PTAX)
│   │   ├── dashboard/          # Dashboard e métricas financeiras
│   │   ├── security/           # Cofre de senhas (sub-apps: passwords,
│   │   │                       # stored_cards, stored_accounts, archives,
│   │   │                       # activity_logs)
│   │   ├── library/            # Biblioteca pessoal (sub-apps: books,
│   │   │                       # authors, publishers, readings, summaries)
│   │   ├── personal_planning/  # Hábitos, metas, treinos e nutrição
│   │   ├── notifications/      # Notificações internas
│   │   ├── webhooks/           # Webhooks outbound assinados (HMAC)
│   │   ├── agents/             # Agentes de IA / LLM (RAG via pgvector)
│   │   ├── admin_panel/        # Configuração de sistema (Django Admin)
│   │   ├── authentication/     # JWT, 2FA, verificação de e-mail
│   │   ├── members/            # Sistema unificado de pessoas/membros
│   │   └── app/                # Configuração central, BaseModel, criptografia
│   ├── frontend/                # Frontend React (porta 39101)
│   │   ├── src/
│   │   │   ├── components/     # common/ e ui/ (Radix + Tailwind)
│   │   │   ├── pages/          # Páginas/rotas (lazy-loaded)
│   │   │   ├── services/       # Camada de serviços (BaseService + Axios)
│   │   │   ├── stores/         # Estado global (Zustand)
│   │   │   ├── hooks/          # Hooks compartilhados
│   │   │   ├── lib/            # Utilitários (formatters, animations, etc.)
│   │   │   ├── config/         # Constantes, traduções de dados, endpoints
│   │   │   ├── i18n/           # Localização de UI (react-i18next)
│   │   │   ├── types/          # Definições TypeScript
│   │   │   └── test/           # Setup de testes (Vitest)
│   │   └── public/             # Arquivos estáticos
│   └── mobile/                  # App Flutter (scaffolding — login screen
│                                 # estático, sem integração de API ainda)
├── infra/
│   ├── k8s/                     # Manifests Kubernetes (kustomize base + overlays)
│   ├── docker/                   # docker-compose.yml + Dockerfiles auxiliares (db-backup)
│   └── scripts/                  # Scripts de backup/restore e migração
├── documentation/                 # Documentação do projeto
└── .env                           # Variáveis de ambiente da raiz
```

### Vantagens do Monorepo

1. **Versionamento unificado**: Frontend e backend evoluem juntos
2. **Compartilhamento de código**: Tipos e interfaces podem ser compartilhados
3. **Desenvolvimento simplificado**: Um único repositório para clonar e configurar
4. **Refatorações mais seguras**: Mudanças na API podem ser feitas atomicamente
5. **Documentação centralizada**: Toda a documentação em um único lugar

## Camadas da Arquitetura

### 1. Camada de Apresentação (Frontend)

**Tecnologias**: React 19, Vite 7, TypeScript 5.9, TailwindCSS 3, Radix UI, React Router v7, Recharts, Framer Motion

A camada de apresentação é responsável pela interface do usuário e interações. Utiliza componentes React funcionais com hooks e TypeScript para tipagem forte.

**Componentes principais**:

- **UI Components**: Componentes reutilizáveis baseados em Radix UI (`components/ui/`)
- **Pages**: Componentes de página que representam rotas, todos lazy-loaded (`React.lazy()` + `Suspense`)
- **Layout Components**: Estrutura de layout (Sidebar, Header, etc.)
- **Feature Components**: Componentes específicos de funcionalidades

**Estado**:

- **Servidor**: TanStack Query v5 para dados remotos (cache, invalidação, refetch) — ver [Frontend Data-Fetching & Caching](../../CLAUDE.md#frontend-data-fetching--caching)
- **Global**: Zustand para autenticação, notificações e estado de UI compartilhado
- **Local**: React hooks (useState, useReducer) para estado de componente
- **Formulários**: React Hook Form + Zod para validação

### 2. Camada de API/Gateway (Frontend)

**Tecnologia**: Axios com interceptors customizados

Esta camada abstrai toda a comunicação HTTP entre frontend e backend, fornecendo uma interface consistente para todas as requisições.

**Responsabilidades**:

- Gerenciamento de requisições HTTP
- Refresh automático de tokens JWT
- Tratamento padronizado de erros
- Transformação de dados de/para API
- Headers e configurações centralizadas

**Padrão Service Layer**: Cada módulo possui um service dedicado que encapsula todas as chamadas de API relacionadas.

```typescript
// Exemplo de service
export const accountsService = {
  getAll: () => apiClient.get<Account[]>('/api/v1/accounts/'),
  getById: (id: string) => apiClient.get<Account>(`/api/v1/accounts/${id}/`),
  create: (data: CreateAccount) => apiClient.post('/api/v1/accounts/', data),
  update: (id: string, data: UpdateAccount) =>
    apiClient.put(`/api/v1/accounts/${id}/`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/accounts/${id}/`),
};
```

### 3. Camada de Backend (Django)

**Tecnologias**: Django 5.2.16, Django REST Framework 3.16.1

O backend é organizado em apps Django independentes, cada um com responsabilidade específica. Usa views genéricas do DRF (não ViewSets) através dos mixins `BaseListCreateView` / `BaseRetrieveUpdateDestroyView`.

**Estrutura de cada app**:

```
app_name/
├── models.py          # Modelos de dados (ORM), estendem BaseModel
├── serializers.py     # Serialização DRF (ModelSerializer)
├── views.py           # Views genéricas (list/create, retrieve/update/destroy)
├── urls.py            # Roteamento sob /api/v1/
├── signals.py         # Sinais Django (quando aplicável, registrados em apps.py)
├── admin.py           # Interface administrativa
└── tests.py           # Testes unitários
```

**Apps principais**:

**Financeiro**:
- `accounts`, `credit_cards`, `expenses`, `revenues`, `loans`, `transfers`
- `payables`, `receivables`: contas a pagar/receber
- `vaults`: cofres com objetivo (poupança)
- `budgets`: orçamentos por categoria
- `bank_reconciliation`: conciliação de extratos OFX/CSV
- `monthly_planning`: overrides de planejamento mensal
- `exchange_rates`: cotações BRL (BCB PTAX)
- `dashboard`: métricas e visualizações agregadas

**Sistema**:
- `authentication`: JWT, 2FA (TOTP), verificação de e-mail
- `members`: sistema unificado de pessoas
- `notifications`: notificações internas
- `webhooks`: entregas outbound assinadas (HMAC-SHA256)
- `admin_panel`: configuração de sistema (chaves LLM, e-mail, MinIO, backups)
- `app`: configuração central, `BaseModel`, criptografia (`FieldEncryption`)

**Estendidos** (multi-módulo — split em sub-packages):
- `security`: `passwords`, `stored_cards`, `stored_accounts`, `archives`, `activity_logs`
- `library`: `books`, `authors`, `publishers`, `readings`, `summaries`
- `personal_planning`: hábitos/rotinas, metas, treinos, nutrição
- `agents`: 6 agentes de IA especializados (finance, budget, forecast, insight, library, planning), RAG via pgvector

### 4. Camada de Middleware

O Django utiliza middlewares para processar requisições e respostas globalmente.

**Middleware customizado**:

- **JWTCookieMiddleware**: Extrai JWT de cookies HttpOnly e adiciona ao header Authorization
- **CORS Middleware**: Gerencia políticas de CORS
- **Security Middleware**: Headers de segurança (CSP, HSTS, etc.)
- **Logging Middleware**: Log estruturado de requisições

### 5. Camada de Dados

**Tecnologia**: PostgreSQL 16 com extensão pgvector

**Características**:

- **Banco relacional**: PostgreSQL para dados estruturados
- **Busca vetorial**: pgvector para embeddings e busca semântica
- **Migrations**: Sistema de migrações Django para versionamento de schema
- **ORM Django**: Abstração de banco de dados com consultas Python

**Estratégias de otimização**:

- Índices em campos de busca e foreign keys
- `select_related` e `prefetch_related` para evitar N+1 queries
- Queries otimizadas com annotations e aggregations
- Cache de queries frequentes (futuro)

### 6. Camada de LLM Providers

Configurado via `LLM_PROVIDER` — padrão: **Ollama local**.

**Ollama** (padrão):
- Chat: `mistral:7b-instruct` (ou `qwen2.5:7b` por agente)
- Embeddings: `nomic-embed-text` — 768 dimensões, cache Redis 5 min
- Completamente local e gratuito — requer ≥ 8GB RAM

**Groq** (cloud alternativo):
- Chat: `llama-3.1-8b-instant`
- Gratuito com limites; embeddings sempre via Ollama

**Anthropic** (cloud premium):
- Chat: `claude-haiku-4-5-20251001` (ou Sonnet/Opus)
- Requer `ANTHROPIC_API_KEY`; embeddings sempre via Ollama

**OpenAI** (cloud alternativo):
- Requer `OPENAI_API_KEY` / `OPENAI_MODEL`; embeddings sempre via Ollama

`LLM_FALLBACK_PROVIDERS` permite encadear provedores de fallback caso o primário falhe (ex.: `groq,anthropic`).

## Padrões Arquiteturais

### 1. Arquitetura em Camadas (Layered Architecture)

A separação em camadas garante baixo acoplamento e alta coesão. Cada camada tem responsabilidades bem definidas e se comunica apenas com a camada adjacente.

### 2. Service Layer Pattern

O frontend utiliza uma camada de serviços que abstrai toda a lógica de comunicação com a API. Isso permite:

- Reutilização de lógica de API
- Testes isolados
- Mudanças na API sem impactar componentes
- Tipagem forte com TypeScript

### 3. Repository Pattern (Django ORM)

O ORM do Django funciona como um Repository Pattern, abstraindo o acesso ao banco de dados e permitindo queries Python em vez de SQL direto.

### 4. ViewSet Pattern (DRF)

Django REST Framework utiliza ViewSets que agrupam operações CRUD em uma única classe, seguindo convenções REST.

```python
class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.filter(is_deleted=False)
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user.member)
```

### 5. Middleware Pattern

O Django utiliza middlewares para cross-cutting concerns como autenticação, logging, CORS, etc.

### 6. Strategy Pattern (Criptografia)

O módulo de criptografia (`app/encryption.py`) implementa uma estratégia única (Fernet) mas pode ser facilmente substituído por outras estratégias.

### 7. Singleton Pattern (API Client)

O API Client do frontend é um singleton que garante configuração única de interceptors e headers.

## Módulos do Sistema

### Módulo Finance

**Responsabilidade**: Gestão financeira completa

**Apps**: accounts, credit_cards, expenses, revenues, loans, transfers, payables, receivables, vaults, budgets, bank_reconciliation, monthly_planning, exchange_rates, dashboard

**Funcionalidades principais**:
- CRUD de contas bancárias e cartões
- Registro e categorização de despesas/receitas, com contas a pagar/receber
- Sistema de empréstimos com amortização
- Transferências entre contas, cofres com objetivo e orçamentos por categoria
- Conciliação de extratos bancários (OFX/CSV) e cotações BRL (BCB PTAX)
- Dashboard com métricas e gráficos

### Módulo Security

**Responsabilidade**: Armazenamento seguro de credenciais (cofre de senhas)

**App**: `security`, dividido nos sub-pacotes `passwords`, `stored_cards`, `stored_accounts`, `archives`, `activity_logs`

**Funcionalidades principais**:
- Gerenciamento de senhas criptografadas, com geração e compartilhamento via link temporário
- Armazenamento de cartões e contas bancárias
- Arquivos confidenciais criptografados
- Logs de auditoria de acesso (imutáveis)
- Dashboard de saúde das senhas (fracas/duplicadas)

### Módulo Library

**Responsabilidade**: Biblioteca pessoal digital

**App**: `library`, dividido nos sub-pacotes `books`, `authors`, `publishers`, `readings`, `summaries`

**Funcionalidades principais**:
- Catálogo de livros com metadados completos e leitor de PDF integrado
- Gestão de autores e editoras
- Resumos e highlights de leitura
- Status, fila e progresso de leitura (velocidade, streak)
- Dashboard com estatísticas

### Módulo Agents (Assistente de IA)

**Responsabilidade**: Assistentes conversacionais com contexto dos dados do usuário

**App**: `agents` (`apps/api/agents/`)

**Funcionalidades principais**:
- 6 agentes de domínio (`finance`, `budget`, `forecast`, `insight`, `library`, `planning`), selecionados automaticamente por `core/router.py`
- Endpoints: `ask/` (síncrono), `stream/` (SSE), `history/`, `sessions/`, `status/`
- Geração de embeddings via Ollama (`nomic-embed-text`, cache Redis)
- Busca vetorial com pgvector (`tools/rag_tools.py`)
- Múltiplos provedores de LLM (Ollama/Groq/Anthropic/OpenAI) com circuit breaker para Ollama
- Persistência de conversas em Redis + PostgreSQL, com compressão/summarização de contexto
- `providers/` é o único ponto do módulo autorizado a importar models de outras apps Django — ver `documentation/architecture/agents-llm-boundary.md`

**Arquitetura RAG (Retrieval Augmented Generation)**:

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Router
    participant DB
    participant LLM

    User->>Frontend: Pergunta em linguagem natural
    Frontend->>Backend: POST /api/v1/agents/stream/ (SSE)
    Backend->>Router: Seleciona agente (keyword + score semântico)
    Router->>LLM: embed(pergunta)
    LLM-->>Router: Vector (768 dim, nomic-embed-text)
    Router->>DB: Busca vetorial com pgvector (top-K por domínio)
    DB-->>Router: Resultados por similaridade
    Backend->>LLM: stream_chat(contexto + pergunta)
    LLM-->>Backend: Tokens em streaming
    Backend-->>Frontend: SSE token a token
    Frontend-->>User: Exibe resposta e fontes citadas
```

## Comunicação Entre Camadas

### Frontend → Backend

**Protocolo**: HTTP/HTTPS (REST API)

**Formato**: JSON

**Autenticação**: JWT em cookies HttpOnly

**Fluxo típico**:

1. Usuário interage com UI
2. Componente chama função do service
3. Service usa apiClient para fazer requisição
4. Interceptor adiciona headers necessários
5. Backend processa requisição
6. Resposta é transformada pelo interceptor
7. Service retorna dados tipados
8. Componente atualiza UI

### Backend → Banco de Dados

**Protocolo**: PostgreSQL wire protocol

**ORM**: Django ORM

**Fluxo típico**:

1. View/ViewSet recebe requisição
2. Serializer valida dados de entrada
3. View executa query via ORM
4. ORM traduz para SQL
5. PostgreSQL executa query
6. Resultados são mapeados para objetos Python
7. Serializer transforma em JSON
8. Response é enviada ao frontend

### Backend → Serviços Externos (LLM Providers)

**Ollama** (padrão, self-managed):
- Protocolo: HTTP, host configurável via `OLLAMA_BASE_URL`
- Chat e embeddings locais — sem envio de dados para fora
- Circuit breaker no `LLMClient` para lidar com indisponibilidade

**Groq / Anthropic / OpenAI** (cloud, opcionais):
- Protocolo: HTTPS, autenticação via API Key (`GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`)
- Selecionados via `LLM_PROVIDER`, com fallback em cadeia via `LLM_FALLBACK_PROVIDERS`
- Embeddings sempre via Ollama, independentemente do provedor de chat

## Escalabilidade e Performance

### Estratégias Implementadas

1. **Índices de banco de dados**: Em campos de busca, foreign keys e campos de filtro
2. **Lazy loading**: Componentes React carregados sob demanda
3. **Queries otimizadas**: select_related, prefetch_related, annotations
4. **Embeddings locais**: Sem latência de API externa
5. **Soft delete**: Preserva histórico sem impactar queries principais

### Estratégias Futuras

1. **Cache Redis**: Para dados frequentemente acessados
2. **Paginação**: Limitação de resultados em listas grandes
3. **CDN**: Para assets estáticos
4. **Database read replicas**: Para separar leitura/escrita
5. **Background jobs**: Celery para tarefas assíncronas

## Segurança na Arquitetura

### Camada de Transporte

- **HTTPS obrigatório em produção**
- **CORS configurado para origens específicas**
- **HttpOnly cookies para JWT** (proteção XSS)
- **SameSite=Lax para cookies** (proteção CSRF)

### Camada de Aplicação

- **JWT com refresh tokens**
- **Sistema de permissões granular**
- **Validações em múltiplas camadas** (frontend, serializer, model)
- **Rate limiting** (futuro)

### Camada de Dados

- **Criptografia Fernet para campos sensíveis**
- **Hashing de senhas com bcrypt**
- **Soft delete preservando auditoria**
- **Logs de atividade para ações críticas**

## Padrões de Nomenclatura

### Backend (Python/Django)

- **Models**: PascalCase (ex: `BankAccount`)
- **Variáveis/funções**: snake_case (ex: `get_balance`)
- **Constantes**: UPPER_SNAKE_CASE (ex: `DEFAULT_CURRENCY`)
- **URLs**: kebab-case (ex: `/api/v1/bank-accounts/`)

### Frontend (TypeScript/React)

- **Componentes**: PascalCase (ex: `AccountCard`)
- **Variáveis/funções**: camelCase (ex: `fetchAccounts`)
- **Tipos/Interfaces**: PascalCase (ex: `Account`, `CreateAccountData`)
- **Constantes**: UPPER_SNAKE_CASE (ex: `API_BASE_URL`)
- **Arquivos**: kebab-case (ex: `account-card.tsx`)

### Banco de Dados

- **Tabelas**: snake_case (ex: `bank_accounts`)
- **Colunas**: snake_case (ex: `account_number`)
- **Índices**: snake_case com prefixo (ex: `idx_accounts_owner`)

## Versionamento de API

Todas as APIs seguem o padrão de versionamento por URL:

```
/api/v1/<resource>/
```

**Benefícios**:
- Clareza sobre qual versão está sendo usada
- Suporte a múltiplas versões simultaneamente
- Migração gradual entre versões

**Convenções**:
- Versão atual: v1
- Retrocompatibilidade mantida dentro da mesma major version
- Breaking changes requerem nova major version

## Logs e Observabilidade

### Logs Estruturados

O sistema utiliza logs estruturados em formato JSON para facilitar parsing e análise.

**Níveis de log**:
- **DEBUG**: Informações detalhadas para debugging
- **INFO**: Eventos normais do sistema
- **WARNING**: Situações incomuns que não são erros
- **ERROR**: Erros que não impedem funcionamento
- **CRITICAL**: Erros graves que impedem funcionamento

**Logs registrados**:
- Requisições HTTP (entrada/saída)
- Erros e exceções
- Acessos a dados sensíveis
- Operações de criptografia
- Queries lentas (futuro)

### Health Checks

Três endpoints de saúde:

- **/health/**: Verifica conectividade com banco de dados
- **/ready/**: Indica se a aplicação está pronta para receber tráfego
- **/live/**: Indica se a aplicação está viva (liveness probe)

## Links Relacionados

- [Fluxo de Dados](./data_flow.md)
- [Decisões Arquiteturais](./architectural_decisions.md)
- [Diagramas UML](./diagrams.md)
- [Documentação Backend](../backend/README.md)
- [Documentação Frontend](../frontend/README.md)
- [Documentação API](../api/endpoints.md)
- [Banco de Dados](../database/schema.md)
- [Autenticação e Segurança](../authentication-security/authentication_flow.md)
