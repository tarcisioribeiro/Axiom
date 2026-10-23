# Estrutura das Apps Django

## Visão Geral

O backend do Axiom é organizado em apps Django modulares, cada uma responsável por um domínio específico da aplicação. A arquitetura segue os padrões Django e REST Framework com camadas bem definidas.

## Estrutura de Diretórios

```
apps/api/
├── app/                    # Configuração principal e utilitários
├── storage/                # Armazenamento de arquivos (local ou MinIO/S3)
├── authentication/         # Autenticação JWT via cookies + política de dispositivo Web
├── accounts/               # Contas bancárias
├── credit_cards/           # Cartões de crédito e faturas
├── expenses/               # Despesas e despesas fixas
├── loans/                  # Empréstimos
├── members/                # Gestão de membros
├── revenues/                # Receitas
├── transfers/              # Transferências entre contas
├── dashboard/              # Dashboard e estatísticas
├── security/               # Módulo de segurança (senhas, credenciais, vault)
├── library/                # Módulo de biblioteca (livros, Intelecto)
├── personal_planning/      # Planejamento pessoal (hábitos, metas, bem-estar, treinos)
├── payables/               # Contas a pagar
├── receivables/            # Contas a receber
├── vaults/                 # Cofres (poupança com objetivo)
├── notifications/          # Sistema de notificações
├── budgets/                # Orçamentos
├── bank_reconciliation/    # Conciliação bancária (OFX/CSV)
├── monthly_planning/       # Overrides de planejamento mensal (MonthlyPlan)
├── agents/                 # Assistente de IA (agentes especializados, roteador, providers)
├── admin_panel/            # Painel administrativo (SystemConfig, screens, acesso por tela)
├── webhooks/               # Webhooks outbound assinados (HMAC-SHA256)
├── exchange_rates/         # Cotações de câmbio (PTAX/Banco Central)
└── daily_review/           # Revisão diária bloqueante de pendências do dia anterior
```

Apps Django de terceiros relevantes em `INSTALLED_APPS`: `django_prometheus` (métricas), `django_admin_dracula` (tema do Django Admin), `django_celery_beat` (agendador do Celery Beat), além do stack DRF padrão (`rest_framework`, `rest_framework_simplejwt` + `token_blacklist`, `django_filters`, `drf_spectacular`, `corsheaders`).

## Apps Principais

### 1. App (Core)

**Responsabilidade**: Configuração central, modelos base, utilitários compartilhados.

**Componentes principais**:
- `settings.py`: Configurações Django e DRF
- `urls.py`: Roteamento principal
- `middleware.py`: Middlewares customizados (audit, security headers)
- `encryption.py`: Sistema de criptografia Fernet
- `permissions.py`: Permissões globais
- `models.py`: BaseModel abstrato
- `health.py`: Health checks

**Arquivos importantes**:
```python
# app/models.py
class BaseModel(models.Model):
    """Modelo abstrato com campos de auditoria"""
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, ...)
    updated_by = models.ForeignKey(User, ...)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True
```

### 2. Authentication

**Responsabilidade**: Autenticação JWT via cookies HttpOnly.

**Estrutura**:
```
authentication/
├── middleware.py      # JWTCookieMiddleware
├── views.py          # Login, logout, user info
└── urls.py           # Rotas de autenticação
```

**Endpoints principais**:
- `POST /api/v1/authentication/token/` - Login e geração de tokens
- `POST /api/v1/authentication/logout/` - Logout
- `GET /api/v1/me/` - Dados do usuário autenticado
- `GET /api/v1/user/permissions/` - Permissões do usuário
- `POST /api/v1/users/register/` - Registro de novos usuários

**Fluxo de autenticação**:
```mermaid
sequenceDiagram
    participant C as Cliente
    participant M as JWTCookieMiddleware
    participant DRF as DRF JWTAuth
    participant V as View

    C->>M: Request com cookie access_token
    M->>M: Extrai token do cookie
    M->>M: Adiciona header Authorization: Bearer <token>
    M->>DRF: Request com header
    DRF->>DRF: Valida JWT
    DRF->>V: Request autenticada
    V->>C: Response
```

### 3. Members

**Responsabilidade**: Gestão de membros da família/organização.

**Modelo principal**:
```python
class Member(BaseModel):
    name = models.CharField(max_length=200)
    document = models.CharField(max_length=14, unique=True)  # CPF
    phone = models.CharField(max_length=20)
    email = models.EmailField(unique=True)
    sex = models.CharField(max_length=1, choices=[('M', 'Masculino'), ('F', 'Feminino')])
    user = models.OneToOneField(User, null=True, blank=True, related_name='member')
    is_creditor = models.BooleanField(default=False)
    is_benefited = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
```

**Relacionamentos**:
- Vinculado opcionalmente a um User do Django
- Relacionado a contas, despesas, receitas, empréstimos, etc.

## Módulo Financeiro

### 4. Accounts

**Responsabilidade**: Contas bancárias e saldos.

**Características**:
- Saldo calculado automaticamente via signals
- Número da conta criptografado
- Suporte a múltiplos tipos de conta (corrente, poupança, etc.)

**Estrutura**:
```
accounts/
├── models.py              # Account
├── serializers.py         # AccountSerializer
├── views.py               # AccountCreateListView, AccountRetrieveUpdateDestroyView
├── signals.py             # Atualização automática de saldos
├── urls.py
└── management/
    └── commands/
        └── update_balances.py
```

### 5. Credit Cards

**Responsabilidade**: Cartões de crédito, faturas e despesas.

**Modelos**:
- `CreditCard`: Dados do cartão (número e CVV criptografados)
- `CreditCardBill`: Faturas mensais
- `CreditCardExpense`: Despesas parceladas no cartão

**Campos criptografados**:
```python
class CreditCard(BaseModel):
    _card_number = models.TextField()  # Criptografado
    _security_code = models.TextField()  # Criptografado

    @property
    def card_number(self):
        return FieldEncryption.decrypt_data(self._card_number)

    @card_number.setter
    def card_number(self, value):
        self._card_number = FieldEncryption.encrypt_data(str(value))
```

### 6. Expenses

**Responsabilidade**: Despesas e despesas fixas.

**Modelos**:
- `Expense`: Despesas pontuais
- `FixedExpense`: Despesas recorrentes (água, luz, aluguel)
- `FixedExpenseGenerationLog`: Log de geração automática

**Categorias**:
```python
EXPENSES_CATEGORIES = (
    ('food', 'Alimentação'),
    ('transport', 'Transporte'),
    ('health', 'Saúde'),
    ('education', 'Educação'),
    ('entertainment', 'Entretenimento'),
    ('housing', 'Moradia'),
    ('utilities', 'Contas'),
    ('shopping', 'Compras'),
    ('others', 'Outros')
)
```

### 7. Revenues

**Responsabilidade**: Receitas e entradas.

**Modelo principal**:
```python
class Revenue(BaseModel):
    description = models.CharField(max_length=200)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    horary = models.TimeField()
    category = models.CharField(max_length=200, choices=REVENUE_CATEGORIES)
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    received = models.BooleanField(default=False)
    member = models.ForeignKey(Member, on_delete=models.PROTECT)
    related_transfer = models.ForeignKey('transfers.Transfer', null=True, blank=True)
    related_loan = models.ForeignKey('loans.Loan', null=True, blank=True)
```

### 8. Loans

**Responsabilidade**: Gestão de empréstimos.

**Modelo principal**:
```python
class Loan(BaseModel):
    description = models.CharField(max_length=200)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    installments = models.IntegerField()
    installment_value = models.DecimalField(max_digits=10, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2)
    start_date = models.DateField()
    payment_day = models.IntegerField()
    status = models.CharField(max_length=20, choices=LOAN_STATUS_CHOICES)
    creditor = models.ForeignKey(Member, related_name='loans_given')
    debtor = models.ForeignKey(Member, related_name='loans_received')
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
```

**Signals**: Cria receitas automáticas para cada parcela paga.

### 9. Transfers

**Responsabilidade**: Transferências entre contas.

**Modelo principal**:
```python
class Transfer(BaseModel):
    description = models.CharField(max_length=200)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    date = models.DateField()
    horary = models.TimeField()
    origin_account = models.ForeignKey(Account, related_name='transfers_out')
    destiny_account = models.ForeignKey(Account, related_name='transfers_in')
    transfered = models.BooleanField(default=False)
    category = models.CharField(max_length=100, choices=TRANSFER_CATEGORIES)
    transaction_id = models.CharField(max_length=100, unique=True, null=True)
    member = models.ForeignKey(Member, on_delete=models.PROTECT)
```

**Signals**: Cria automaticamente uma despesa na conta origem e uma receita na conta destino.

### 10. Dashboard

**Responsabilidade**: Estatísticas e visualizações.

**Endpoints**:
- `GET /api/v1/dashboard/summary/` / `stats/` - Resumo e estatísticas financeiras
- `GET /api/v1/dashboard/account-balances/` - Saldos das contas
- `GET /api/v1/dashboard/credit-card-expenses-by-category/` - Gastos de cartão por categoria
- `GET /api/v1/dashboard/balance-forecast/` / `cash-flow-forecast/` - Projeções de saldo e fluxo de caixa
- `GET /api/v1/dashboard/monthly-statement/` - Extrato mensal
- `GET /api/v1/dashboard/financial-alerts/` / `alerts/stream/` - Alertas (lista e SSE)
- `GET /api/v1/dashboard/health-score/`, `spending-insights/`, `anomalies/`, `debt-payoff-plan/`
- `GET /api/v1/dashboard/ir-report/`, `lgpd-export/` - Relatório de IR e exportação LGPD

## Módulo de Segurança

### 11. Security

**Responsabilidade**: Armazenamento seguro de senhas, credenciais e arquivos confidenciais.

**Modelos**:
- `Password`: Senhas de sites/serviços (criptografadas)
- `StoredCreditCard`: Credenciais de cartões (criptografadas)
- `StoredBankAccount`: Credenciais bancárias (criptografadas)
- `Archive`: Arquivos confidenciais
- `ActivityLog`: Log de atividades do usuário

**Exemplo**:
```python
class Password(BaseModel):
    title = models.CharField(max_length=200)
    site = models.URLField(max_length=500, blank=True, null=True)
    username = models.CharField(max_length=200)
    _password = models.TextField()  # Criptografado
    category = models.CharField(max_length=100, choices=PASSWORD_CATEGORIES)
    notes = models.TextField(blank=True, null=True)
    last_password_change = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(Member, on_delete=models.PROTECT)

    @property
    def password(self):
        return FieldEncryption.decrypt_data(self._password)

    @password.setter
    def password(self, value):
        self._password = FieldEncryption.encrypt_data(str(value))
```

**Estrutura**:
```
security/
├── models.py              # Modelos de segurança
├── serializers.py         # Serializers com campos mascarados
├── views.py               # Views com validação extra
├── urls.py
├── vault_config.py        # Configuração do vault
├── vault_crypto.py        # Criptografia do vault
└── importers.py           # Importação de dados
```

## Módulo de Biblioteca

### 12. Library

**Responsabilidade**: Gestão de livros, leituras e resumos.

**Modelos**:
- `Author`: Autores
- `Publisher`: Editoras
- `Book`: Livros
- `Summary`: Resumos de livros
- `Reading`: Registros de leitura

**Estrutura**:
```
library/
├── models.py
├── serializers.py
├── views.py
└── urls.py
```

**Exemplo de modelo**:
```python
class Book(BaseModel):
    title = models.CharField(max_length=500)
    authors = models.ManyToManyField(Author, related_name='books')
    pages = models.IntegerField()
    publisher = models.ForeignKey(Publisher, on_delete=models.PROTECT)
    language = models.CharField(max_length=50, choices=LANGUAGE_CHOICES)
    genre = models.CharField(max_length=100, choices=GENRE_CHOICES)
    literarytype = models.CharField(max_length=100, choices=LITERARY_TYPE_CHOICES)
    publish_date = models.DateField()
    synopsis = models.TextField(blank=True, null=True)
    edition = models.CharField(max_length=50, blank=True, null=True)
    media_type = models.CharField(max_length=50, choices=MEDIA_TYPE_CHOICES)
    rating = models.IntegerField(null=True, blank=True)
    read_status = models.CharField(max_length=50, choices=READ_STATUS_CHOICES)
    owner = models.ForeignKey(Member, on_delete=models.PROTECT)
```

## Apps Complementares

### 13. Payables

**Responsabilidade**: Controle de contas a pagar.

**Estrutura**:
```
payables/
├── models.py
├── serializers.py
├── views.py
├── signals.py
└── urls.py
```

### 14. Budgets

**Responsabilidade**: Orçamentos financeiros por categoria e período.

**Estrutura**:
```
budgets/
├── models.py
├── serializers.py
├── services.py
├── views.py
└── urls.py
```

### 15. Bank Reconciliation

**Responsabilidade**: Conciliação bancária (importação e reconciliação de extratos).

**Estrutura**:
```
bank_reconciliation/
├── models.py
├── serializers.py
├── services.py
├── parsers.py
├── views.py
└── urls.py
```

### 16. Notifications

**Responsabilidade**: Sistema de notificações internas para o usuário.

**Estrutura**:
```
notifications/
├── models.py
├── serializers.py
├── services.py
├── views.py
├── urls.py
└── management/
    └── commands/
```

### 17. Vaults

**Responsabilidade**: Cofres de poupança com objetivo (não confundir com o cofre de senhas da app `security`) — dinheiro separado de uma conta bancária para uma meta com valor e data-alvo, incluindo rendimento (yield) e contribuições recorrentes.

**Modelos**:
- `Vault`: Cofre vinculado a uma conta, com meta de valor/data e configuração de rendimento
- `VaultTransaction`: Movimentações de depósito/retirada/rendimento do cofre
- `VaultRecurringContribution`: Contribuições automáticas recorrentes
- `FinancialGoal`: Metas financeiras de médio/longo prazo (quitação de dívida, imóvel, aposentadoria)

**Estrutura**:
```
vaults/
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── services/
└── management/
    └── commands/        # check_vault_yield_health, generate_vault_contributions, reconcile_vault_yield
```

### 18. Personal Planning

**Responsabilidade**: Planejamento pessoal, metas e rotinas.

**Modelos**:
- `RoutineTask`: Tarefas da rotina
- `DailyTaskRecord`: Registros diários de tarefas
- `Goal`: Metas pessoais
- `DailyReflection`: Reflexões diárias

**Estrutura**:
```
personal_planning/
├── models.py
├── serializers.py
├── views.py
├── signals.py             # Atualização de progresso de metas
└── urls.py
```

### 19. Receivables

**Responsabilidade**: Contas a receber — espelho de `payables`. Registrar o recebimento (`received_value`) dispara a criação da receita correspondente, não a criação do `Receivable` em si.

**Modelos**: `Receivable` (status `active`/`received`/`overdue`/`cancelled`), `ReceivableInstallment`.

### 20. Monthly Planning

**Responsabilidade**: Overrides de planejamento por usuário e por mês (receitas extras, ajustes de orçamento), expostos via `monthly-plan/summary/` e `monthly-plan/apply/`.

**Modelos**: `MonthlyPlan` (`extra_revenues`, `budget_overrides`, etc.).

### 21. Admin Panel

**Responsabilidade**: Painel administrativo — configuração do sistema, controle de acesso por tela e defaults de novos usuários.

**Modelos**: `SystemConfig` (config criptografada: chaves de LLM, e-mail, MinIO — editável via Django Admin em `/admin/`), `UserScreenAccess`, `ScreenDefault`.

**Outros arquivos**: `screens.py` (fonte única de rotas/ações por tela, usada pelo `ScreenAccessMiddleware`), `access.py` (resolve as ações permitidas de um usuário), `defaults.py` (aplica `ScreenDefault` a usuários novos).

### 22. Webhooks

**Responsabilidade**: Entrega de webhooks outbound assinados quando eventos relevantes ocorrem (nova despesa, fatura fechada, orçamento excedido, depósito em cofre, etc.), via `dispatch_event(event, payload, user=user)` em `webhooks/dispatch.py`.

**Modelos**: `Webhook`, `WebhookDelivery`. Assinatura HMAC-SHA256 no header `X-Axiom-Signature`. Entregas processadas por tarefa Celery (`tasks.py`).

### 23. Exchange Rates

**Responsabilidade**: Cotações oficiais do Banco Central (PTAX) para moedas e criptomoedas em relação ao Real, atualizadas por tarefa Celery periódica.

**Modelos**: `ExchangeRate`. Conversão via `ExchangeRate.convert(amount, from_currency, to_currency)` (cross-rate via BRL).

### 24. Daily Review

**Responsabilidade**: Revisão diária bloqueante das pendências do dia anterior (despesas/receitas não confirmadas, etc.) antes de liberar o uso normal do sistema no dia.

**Modelos**: `ReviewProgress` (último dia revisado por membro), `ReviewResolution` (justificativa dada a um item pendente — `skip` ou `keep_pending`).

**Endpoints**: `daily-review/`, `daily-review/resolve/`, `daily-review/backlog/`, `daily-review/complete/`.

### 25. Storage

**Responsabilidade**: Abstração de armazenamento de arquivos — local em disco ou MinIO/S3, conforme `MINIO_ENDPOINT` estar configurado.

**Arquivos principais**: `backends.py` (seleção do backend), `health.py` (health check usado no painel administrativo), `media_proxy.py` (proxy de acesso a arquivos). Comandos de management: `migrate_media_to_minio`, `fix_storage_config_for_local`.

### 26. Agents (Assistente de IA)

**Responsabilidade**: Agentes especializados do assistente de IA (Finance, Budget, Forecast, Insight, Library, Planning), selecionados por `core/router.py`. Ver [`documentation/backend/agents.md`](./agents.md) para detalhes.

## Padrões de Organização

### Estrutura Padrão de uma App

```
<app_name>/
├── __init__.py
├── apps.py                # Configuração da app
├── models.py              # Modelos de dados
├── serializers.py         # Serializers DRF
├── views.py               # ViewSets e APIViews
├── urls.py                # Roteamento
├── admin.py               # Admin Django
├── tests.py               # Testes
├── signals.py             # Signals Django (opcional)
├── permissions.py         # Permissões customizadas (opcional)
├── filters.py             # Filtros customizados (opcional)
└── management/            # Comandos de gerenciamento (opcional)
    └── commands/
        └── <command>.py
```

### Convenções de Nomenclatura

**Modelos**:
- Singular, PascalCase: `Account`, `CreditCard`, `Expense`
- Herdam de `BaseModel` para auditoria

**Serializers**:
- Sufixo `Serializer`: `AccountSerializer`
- Separar para leitura/escrita quando necessário: `BookSerializer`, `BookCreateUpdateSerializer`

**Views**:
- Generic views: `AccountCreateListView`, `AccountRetrieveUpdateDestroyView`
- ViewSets: `AccountViewSet`
- APIViews para lógica customizada: `DashboardSummaryView`

**URLs**:
- Padrão REST: `/api/v1/<resource>/`
- Ações customizadas: `/api/v1/<resource>/<action>/`
- Versionamento obrigatório: `/api/v1/`

## Instalação de Apps

Todas as apps devem ser registradas em `app/settings.py`:

```python
INSTALLED_APPS = [
    # Django apps
    'django.contrib.admin',
    'django.contrib.auth',
    ...

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',

    # Core app
    'app',

    # Authentication
    'authentication',

    # Financial apps
    'accounts',
    'credit_cards',
    'expenses',
    'loans',
    'members',
    'revenues',
    'transfers',
    'dashboard',

    # Security Module
    'security',

    # Library Module
    'library',

    # Personal Planning Module
    'personal_planning',

    # Financial utilities
    'payables',
    'budgets',
    'bank_reconciliation',

    # Notifications
    'notifications',

    # Vaults
    'vaults',
]
```

## Dependências entre Apps

```mermaid
graph TD
    A[app - Core] --> B[authentication]
    A --> C[members]
    C --> D[accounts]
    D --> E[expenses]
    D --> F[revenues]
    D --> G[transfers]
    D --> H[credit_cards]
    D --> I[loans]
    D --> P[payables]
    D --> Q[budgets]
    D --> R[bank_reconciliation]
    C --> J[security]
    C --> K[library]
    C --> M[personal_planning]
    C --> S[vaults]
    C --> T[notifications]
    E --> N[dashboard]
    F --> N
    H --> N
    I --> N
    G --> E
    G --> F
```

**Regras de dependência**:
1. Todas as apps dependem de `app` (core)
2. Apps financeiras dependem de `members` e `accounts`
3. Apps de módulos (security, library, vaults) dependem apenas de `members`
4. Dashboard agrega dados de várias apps
5. Evitar dependências circulares

## Considerações de Performance

### Otimizações Implementadas

1. **Índices de Banco de Dados**:
   - Campos frequentemente consultados têm `db_index=True`
   - Índices compostos para queries comuns (ex: `user + domain` em `AgentEmbedding`)

2. **Select Related / Prefetch Related**:
   - ViewSets usam `select_related` para ForeignKeys
   - `prefetch_related` para ManyToManyFields

3. **Paginação**:
   - Paginação padrão de 50 itens por página
   - Configurável via query param `page_size`

4. **Caching**:
   - Redis disponível via `CACHES['redis']`
   - Cache de embeddings para consultas semelhantes
   - Cache de sessões do AI Assistant

5. **Throttling**:
   - 100 requests/min para usuários anônimos
   - 1000 requests/min para usuários autenticados

## Próximos Passos

- [Modelos de Dados](./data_models.md) - Documentação detalhada dos modelos
- [Serializers](./serializers.md) - Padrões de serialização
- [ViewSets e Views](./viewsets_views.md) - Lógica de API
- [Middleware e Signals](./middleware_signals.md) - Interceptadores e eventos
- [Criptografia](./criptography.md) - Sistema de criptografia
- [Comandos Management](./management_commands.md) - Comandos customizados
