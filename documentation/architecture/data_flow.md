# Fluxo de Dados

## Introdução

Este documento detalha como os dados fluem através do MindLedger, desde a interação do usuário na interface até a persistência no banco de dados e vice-versa. Compreender esses fluxos é essencial para entender o comportamento do sistema, fazer debugging e implementar novas funcionalidades.

## Visão Geral dos Fluxos

O MindLedger possui cinco fluxos principais de dados:

1. **Fluxo de Autenticação**: Login, refresh de tokens, logout
2. **Fluxo CRUD Padrão**: Operações de criação, leitura, atualização e exclusão
3. **Fluxo de Dados Sensíveis**: Leitura e gravação de dados criptografados
4. **Fluxo de Busca Semântica**: Consultas ao AI Assistant
5. **Fluxo de Dashboard**: Agregação e visualização de métricas

## 1. Fluxo de Autenticação

### Login (Fluxo Completo)

```mermaid
sequenceDiagram
    participant User
    participant LoginForm
    participant AuthService
    participant APIClient
    participant Backend
    participant JWTMiddleware
    participant AuthView
    participant Database
    participant AuthStore

    User->>LoginForm: Insere credenciais
    LoginForm->>LoginForm: Validação Zod
    LoginForm->>AuthService: login(username, password)
    AuthService->>APIClient: POST /api/v1/auth/login/

    APIClient->>Backend: HTTP Request
    Backend->>JWTMiddleware: Processa requisição
    JWTMiddleware->>AuthView: Forward request

    AuthView->>Database: Verifica credenciais
    Database-->>AuthView: User data
    AuthView->>AuthView: Gera access_token e refresh_token
    AuthView->>AuthView: Cria cookies HttpOnly

    AuthView-->>Backend: Response com cookies
    Backend-->>APIClient: Set-Cookie headers
    APIClient->>APIClient: Valida response
    APIClient->>APIClient: Extrai user data de cookies não-HttpOnly

    APIClient-->>AuthService: User data
    AuthService->>AuthStore: setUser(user)
    AuthService->>AuthStore: setIsAuthenticated(true)

    AuthStore-->>LoginForm: Success
    LoginForm->>LoginForm: Redireciona para /dashboard
    LoginForm-->>User: Mostra dashboard
```

**Detalhamento**:

1. **Frontend - Validação**:
   - React Hook Form valida campos do formulário
   - Zod schema valida tipos e requisitos
   - Feedback visual de erros ao usuário

2. **Frontend - Service**:
   - `authService.login()` é chamado
   - Dados são enviados via `apiClient.post()`

3. **Backend - Middleware**:
   - `JWTCookieMiddleware` processa requisição
   - CORS middleware valida origem

4. **Backend - Autenticação**:
   - `AuthView` recebe credenciais
   - Django autentica com `authenticate()`
   - Gera tokens JWT (access e refresh)
   - Cria cookies HttpOnly para tokens
   - Cria cookies não-HttpOnly para dados de usuário

5. **Frontend - Resposta**:
   - Navegador armazena cookies automaticamente
   - `apiClient` extrai dados de usuário
   - `authStore` é atualizado
   - UI reage ao estado de autenticação

### Refresh de Token (Automático)

```mermaid
sequenceDiagram
    participant Component
    participant APIClient
    participant Interceptor
    participant Backend
    participant Cookie

    Component->>APIClient: Qualquer requisição
    APIClient->>Backend: Request com cookies
    Backend-->>APIClient: 401 Unauthorized

    Interceptor->>Interceptor: Detecta 401
    Interceptor->>APIClient: POST /api/v1/auth/refresh/
    APIClient->>Backend: Request com refresh_token cookie

    Backend->>Backend: Valida refresh_token
    Backend->>Backend: Gera novo access_token
    Backend-->>APIClient: Novo access_token em cookie

    APIClient->>Cookie: Atualiza cookie
    Interceptor->>APIClient: Repete requisição original
    APIClient->>Backend: Request com novo token
    Backend-->>APIClient: 200 OK

    APIClient-->>Component: Dados solicitados
```

**Detalhamento**:

1. **Detecção de Token Expirado**:
   - Qualquer requisição pode retornar 401
   - Interceptor de resposta detecta automaticamente

2. **Refresh Automático**:
   - Interceptor chama `/auth/refresh/`
   - Backend valida `refresh_token` do cookie
   - Novo `access_token` é gerado e retornado

3. **Retry da Requisição**:
   - Interceptor automaticamente repete requisição original
   - Nova requisição usa token atualizado
   - Usuário não percebe o refresh

**Exceções**:
- Refresh só ocorre se não for endpoint de autenticação
- Se refresh falhar, usuário é deslogado
- Múltiplas requisições simultâneas usam mesma promise de refresh

### Logout

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant AuthService
    participant APIClient
    participant Backend
    participant AuthStore

    User->>Component: Clica em Logout
    Component->>AuthService: logout()
    AuthService->>APIClient: POST /api/v1/auth/logout/

    APIClient->>Backend: Request
    Backend->>Backend: Invalida refresh_token
    Backend->>Backend: Remove cookies (Set-Cookie com Max-Age=0)
    Backend-->>APIClient: 200 OK

    APIClient-->>AuthService: Success
    AuthService->>AuthStore: clearAuth()
    AuthStore->>AuthStore: isAuthenticated = false
    AuthStore->>AuthStore: user = null

    AuthStore-->>Component: State updated
    Component->>Component: Redireciona para /login
    Component-->>User: Mostra tela de login
```

## 2. Fluxo CRUD Padrão

### Leitura (GET List)

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Service
    participant APIClient
    participant Backend
    participant ViewSet
    participant Serializer
    participant Database

    User->>Component: Acessa página
    Component->>Component: useEffect monta
    Component->>Service: getAll()
    Service->>APIClient: GET /api/v1/accounts/

    APIClient->>Backend: HTTP Request com JWT cookie
    Backend->>ViewSet: get_queryset()
    ViewSet->>ViewSet: Filtra is_deleted=False
    ViewSet->>ViewSet: Filtra por owner (request.user.member)
    ViewSet->>Database: SELECT * FROM accounts WHERE...

    Database-->>ViewSet: Rows
    ViewSet->>Serializer: Serializa cada objeto
    Serializer->>Serializer: Transforma campos
    Serializer->>Serializer: Mascara dados sensíveis
    Serializer-->>ViewSet: JSON data

    ViewSet-->>Backend: Response
    Backend-->>APIClient: JSON array
    APIClient->>APIClient: Valida response
    APIClient-->>Service: Typed data
    Service-->>Component: Account[]

    Component->>Component: Atualiza estado
    Component->>Component: Re-renderiza
    Component-->>User: Exibe lista de contas
```

**Detalhamento**:

1. **Frontend - Montagem**:
   - Componente monta e dispara `useEffect`
   - Service layer é chamado
   - Loading state ativado

2. **Backend - Filtragem**:
   - ViewSet aplica filtros automáticos
   - `is_deleted=False` (soft delete)
   - Filtro de ownership (usuário só vê seus dados)
   - Filtros adicionais via query params

3. **Backend - Serialização**:
   - `Serializer` transforma objetos Python em JSON
   - Campos sensíveis são mascarados ou omitidos
   - Campos calculados são adicionados
   - Relacionamentos são serializados

4. **Frontend - Atualização**:
   - Estado do componente é atualizado
   - Loading desativado
   - UI re-renderiza com dados

### Criação (POST)

```mermaid
sequenceDiagram
    participant User
    participant Form
    participant Service
    participant APIClient
    participant Backend
    participant ViewSet
    participant Serializer
    participant Model
    participant Encryption
    participant Database

    User->>Form: Preenche formulário
    User->>Form: Clica em Salvar
    Form->>Form: Validação Zod
    Form->>Service: create(data)
    Service->>APIClient: POST /api/v1/accounts/

    APIClient->>Backend: HTTP Request com data
    Backend->>ViewSet: create(request.data)
    ViewSet->>Serializer: is_valid()
    Serializer->>Serializer: Valida tipos e constraints

    alt Validação falha
        Serializer-->>ViewSet: ValidationError
        ViewSet-->>Backend: 400 Bad Request
        Backend-->>APIClient: Erros de validação
        APIClient-->>Form: Mostra erros
    else Validação OK
        Serializer->>Model: save()
        Model->>Model: Adiciona created_by e owner

        alt Campo sensível
            Model->>Encryption: encrypt_data(field)
            Encryption-->>Model: Encrypted value
        end

        Model->>Database: INSERT INTO accounts...
        Database-->>Model: Novo registro com ID
        Model-->>Serializer: Instance
        Serializer->>Serializer: Serializa resposta
        Serializer-->>ViewSet: JSON
        ViewSet-->>Backend: 201 Created
        Backend-->>APIClient: JSON data
        APIClient-->>Service: Account
        Service-->>Form: Success
        Form->>Form: Redireciona ou atualiza lista
        Form-->>User: Feedback de sucesso
    end
```

**Detalhamento**:

1. **Frontend - Validação**:
   - React Hook Form valida em tempo real
   - Zod schema valida ao submeter
   - Erros mostrados inline nos campos

2. **Backend - Validação Serializer**:
   - Tipos de dados validados
   - Constraints (required, max_length, etc.)
   - Validações customizadas
   - Validação de relacionamentos

3. **Backend - Criptografia**:
   - Se campo é sensível (ex: account_number)
   - `Model.save()` chama `FieldEncryption.encrypt_data()`
   - Valor criptografado antes de INSERT

4. **Backend - Auditoria**:
   - `created_by` = `request.user`
   - `created_at` = timestamp atual
   - `owner` = `request.user.member`
   - UUID gerado automaticamente

5. **Frontend - Feedback**:
   - Toast de sucesso
   - Redirecionamento ou atualização de lista
   - Form é resetado

### Atualização (PUT/PATCH)

Similar ao POST, mas:
- Usa `PATCH` para atualização parcial ou `PUT` para completa
- Backend chama `update()` em vez de `create()`
- `updated_by` e `updated_at` são atualizados
- Campos não enviados mantêm valores anteriores (PATCH)

### Exclusão (DELETE - Soft Delete)

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Service
    participant APIClient
    participant Backend
    participant ViewSet
    participant Model
    participant Database

    User->>Component: Clica em Excluir
    Component->>Component: Confirmação modal
    User->>Component: Confirma exclusão
    Component->>Service: delete(id)
    Service->>APIClient: DELETE /api/v1/accounts/{id}/

    APIClient->>Backend: HTTP Request
    Backend->>ViewSet: destroy(id)
    ViewSet->>Model: get object by ID
    Model->>Model: is_deleted = True
    Model->>Model: deleted_at = now()
    Model->>Model: deleted_by = request.user
    Model->>Database: UPDATE accounts SET is_deleted=true...

    Database-->>Model: Success
    Model-->>ViewSet: Success
    ViewSet-->>Backend: 204 No Content
    Backend-->>APIClient: Success
    APIClient-->>Service: Success
    Service-->>Component: Success
    Component->>Component: Remove da lista local
    Component-->>User: Feedback de sucesso
```

**Soft Delete**:
- Registro não é removido do banco
- Flag `is_deleted=True` marca como excluído
- Timestamp `deleted_at` registra quando
- `deleted_by` registra quem excluiu
- Queries padrão filtram automaticamente deletados
- Permite auditoria e recuperação futura

## 3. Fluxo de Dados Sensíveis

### Escrita de Dados Criptografados

```mermaid
sequenceDiagram
    participant User
    participant Form
    participant Service
    participant Backend
    participant Model
    participant Encryption
    participant Database

    User->>Form: Insere senha ou CVV
    Form->>Service: create({ password: "secret123" })
    Service->>Backend: POST com dados plain

    Backend->>Model: save(password="secret123")
    Model->>Encryption: encrypt_data("secret123")
    Encryption->>Encryption: Carrega ENCRYPTION_KEY do .env
    Encryption->>Encryption: Fernet.encrypt()
    Encryption-->>Model: "gAAAAABf..."

    Model->>Model: self.encrypted_password = "gAAAAABf..."
    Model->>Database: INSERT ... encrypted_password = "gAAAAABf..."
    Database-->>Model: Success
    Model-->>Backend: Success
    Backend-->>Service: Success (sem devolver campo criptografado)
```

**Criptografia Fernet**:

- Algoritmo: AES-128 em modo CBC
- HMAC com SHA256 para integridade
- Timestamp incluso (detecta adulteração)
- Chave: 44 caracteres base64 (`ENCRYPTION_KEY` no .env)

**Campos criptografados**:
- `CreditCard.cvv`
- `CreditCard.card_number`
- `Account.account_number`
- `Password.encrypted_password`
- `BankAccountSecure.account_number`
- `BankAccountSecure.bank_password`
- `BankAccountSecure.digital_password`
- `CardSecure.card_number`
- `CardSecure.cvv`
- `ConfidentialFile.encrypted_content`

### Leitura de Dados Criptografados

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Service
    participant Backend
    participant ViewSet
    participant Serializer
    participant Model
    participant Encryption
    participant ActivityLog

    User->>Component: Clica em "Revelar Senha"
    Component->>Service: revealPassword(id)
    Service->>Backend: POST /api/v1/passwords/{id}/reveal/

    Backend->>ViewSet: reveal(id)
    ViewSet->>Model: get object by ID
    Model->>Model: Verifica permissões
    Model->>Encryption: decrypt_data(self.encrypted_password)

    Encryption->>Encryption: Carrega ENCRYPTION_KEY
    Encryption->>Encryption: Fernet.decrypt()
    alt Descriptografia bem-sucedida
        Encryption-->>Model: "secret123"
        Model->>ActivityLog: Registra ação "VIEW_PASSWORD"
        ActivityLog->>ActivityLog: Salva user, IP, timestamp
        Model-->>ViewSet: { password: "secret123" }
        ViewSet-->>Backend: 200 OK
        Backend-->>Service: Plain data
        Service-->>Component: "secret123"
        Component->>Component: Exibe em campo revelado
        Component-->>User: Mostra senha temporariamente
    else Descriptografia falha
        Encryption-->>Model: InvalidToken error
        Model-->>ViewSet: 500 Error
        ViewSet-->>Backend: Erro de descriptografia
        Backend-->>Service: Error
        Service-->>Component: Error message
        Component-->>User: "Erro ao descriptografar"
    end
```

**Segurança**:

1. **Endpoints dedicados**: Dados sensíveis só são descriptografados em endpoints específicos (`/reveal/`)
2. **Auditoria**: Toda visualização é registrada em `ActivityLog`
3. **Permissões**: Verificação de ownership antes de descriptografar
4. **Nunca em listagens**: Campos criptografados nunca aparecem em GET lists
5. **Mascaramento**: Números de cartão são mascarados (ex: `****1234`)

## 4. Fluxo de Busca Semântica (AI Assistant)

### Geração de Embeddings

```mermaid
sequenceDiagram
    participant Admin
    participant Backend
    participant FinanceApp
    participant SecurityApp
    participant LibraryApp
    participant Transformers
    participant Database

    Admin->>Backend: Cria/Atualiza registro

    alt Finance - Expense
        Backend->>FinanceApp: save() triggered
        FinanceApp->>FinanceApp: Extrai description
        FinanceApp->>Transformers: encode("Compra no supermercado")
        Transformers->>Transformers: all-MiniLM-L6-v2 model
        Transformers-->>FinanceApp: [0.123, -0.456, ...] (384 dims)
        FinanceApp->>Database: UPDATE expense SET embedding = [...]
    else Security - Password
        Backend->>SecurityApp: save() triggered
        SecurityApp->>SecurityApp: Extrai title + notes
        SecurityApp->>Transformers: encode("Gmail - Email pessoal")
        Transformers-->>SecurityApp: embedding vector
        SecurityApp->>Database: UPDATE password SET embedding = [...]
    else Library - Book Summary
        Backend->>LibraryApp: save() triggered
        LibraryApp->>LibraryApp: Extrai summary content
        LibraryApp->>Transformers: encode(summary_text)
        Transformers-->>LibraryApp: embedding vector
        LibraryApp->>Database: UPDATE book_summary SET embedding = [...]
    end
```

**Modelo de Embedding**:

- **Nome**: all-MiniLM-L6-v2
- **Dimensões**: 384
- **Tamanho**: ~80MB
- **Latência**: ~50ms por texto
- **Multilingual**: Sim (inclui português)
- **Custo**: Grátis (local)

**Quando embeddings são gerados**:

- Na criação de novo registro
- Na atualização de campos de texto
- Via signal `post_save` no Django
- Automático e transparente

### Busca Semântica

```mermaid
sequenceDiagram
    participant User
    participant ChatUI
    participant Service
    participant Backend
    participant Transformers
    participant PGVector
    participant Groq
    participant ActivityLog

    User->>ChatUI: "Quanto gastei no mercado?"
    ChatUI->>Service: askQuestion(query)
    Service->>Backend: POST /api/v1/ai-assistant/ask/

    Backend->>Backend: Extrai dados de Finance/Security/Library
    Backend->>Transformers: encode("Quanto gastei no mercado?")
    Transformers-->>Backend: query_embedding [384 dims]

    Backend->>PGVector: SELECT * FROM (...) ORDER BY embedding <-> query_embedding
    PGVector->>PGVector: Cosine similarity search
    PGVector-->>Backend: Top-K results com scores

    Backend->>Backend: Formata contexto com resultados
    Backend->>Groq: POST com prompt + contexto
    Groq->>Groq: llama-3.3-70b-versatile gera resposta
    Groq-->>Backend: Resposta em português com citações

    Backend->>ActivityLog: Registra query do usuário
    Backend-->>Service: { answer, sources, scores }
    Service-->>ChatUI: Resposta formatada
    ChatUI->>ChatUI: Exibe resposta + fontes
    ChatUI-->>User: Mostra resultado com citações
```

**Busca Vetorial com pgvector**:

```sql
SELECT
    id,
    content,
    source_type,
    1 - (embedding <=> query_embedding) as similarity_score
FROM ai_content
WHERE 1 - (embedding <=> query_embedding) > 0.7
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**Operadores pgvector**:
- `<->`: Distância L2 (Euclidiana)
- `<=>`: Distância de cosseno (usado no MindLedger)
- `<#>`: Produto interno negativo

**Estrutura da Resposta**:

```json
{
  "answer": "Você gastou R$ 450,00 no mercado em janeiro...",
  "sources": [
    {
      "id": "uuid-123",
      "type": "expense",
      "content": "Compra no Supermercado Extra",
      "score": 0.89,
      "metadata": {
        "amount": 450.0,
        "date": "2026-01-10"
      }
    }
  ],
  "query": "Quanto gastei no mercado?",
  "timestamp": "2026-01-12T10:30:00Z"
}
```

## 5. Fluxo de Dashboard (Agregações)

### Carregamento de Dashboard

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant Service
    participant Backend
    participant Database

    User->>Dashboard: Acessa /dashboard
    Dashboard->>Dashboard: Renderiza loading

    par Requisições Paralelas
        Dashboard->>Service: getAccountsSummary()
        Service->>Backend: GET /api/v1/dashboard/accounts-summary/
        Backend->>Database: SELECT SUM(balance) FROM accounts...
        Database-->>Backend: Total balance
        Backend-->>Service: { total_balance: 5000 }
        Service-->>Dashboard: Summary data
    and
        Dashboard->>Service: getExpensesByCategory()
        Service->>Backend: GET /api/v1/dashboard/expenses-by-category/
        Backend->>Database: SELECT category, SUM(amount) FROM expenses GROUP BY...
        Database-->>Backend: Categorias e totais
        Backend-->>Service: [{ category, total }]
        Service-->>Dashboard: Category data
    and
        Dashboard->>Service: getRevenuesVsExpenses()
        Service->>Backend: GET /api/v1/dashboard/monthly-summary/
        Backend->>Database: Complex query com JOIN e GROUP BY
        Database-->>Backend: Meses com receitas e despesas
        Backend-->>Service: Monthly data
        Service-->>Dashboard: Chart data
    end

    Dashboard->>Dashboard: Combina todos os dados
    Dashboard->>Dashboard: Renderiza gráficos
    Dashboard-->>User: Exibe dashboard completo
```

**Otimizações de Dashboard**:

1. **Requisições paralelas**: Múltiplas chamadas simultâneas
2. **Agregações no banco**: Cálculos feitos via SQL
3. **Índices**: Em campos usados em GROUP BY e WHERE
4. **Annotations**: Django ORM usa `annotate()` e `aggregate()`
5. **Caching (futuro)**: Resultados armazenados por 5 minutos

**Exemplo de Query Otimizada**:

```python
# Backend - Dashboard ViewSet
def expenses_by_category(self, request):
    queryset = Expense.objects.filter(
        owner=request.user.member,
        is_deleted=False,
        date__gte=start_of_month,
        date__lte=end_of_month
    ).values('category__name').annotate(
        total=Sum('amount'),
        count=Count('id')
    ).order_by('-total')

    return Response(queryset)
```

Gera SQL:

```sql
SELECT
    category.name,
    SUM(expense.amount) as total,
    COUNT(expense.id) as count
FROM expenses expense
INNER JOIN categories category ON expense.category_id = category.id
WHERE
    expense.owner_id = %s
    AND expense.is_deleted = false
    AND expense.date >= %s
    AND expense.date <= %s
GROUP BY category.name
ORDER BY total DESC;
```

## Fluxos de Erro e Recuperação

### Tratamento de Erros HTTP

```mermaid
sequenceDiagram
    participant Component
    participant Service
    participant APIClient
    participant Interceptor
    participant ErrorHandler

    Component->>Service: Chama método
    Service->>APIClient: HTTP request
    APIClient->>Backend: Request
    Backend-->>APIClient: 400/401/403/404/500

    APIClient->>Interceptor: Response interceptor
    Interceptor->>ErrorHandler: handleError(response)

    alt 400 Bad Request
        ErrorHandler->>ErrorHandler: new ValidationError()
        ErrorHandler-->>Service: ValidationError
        Service-->>Component: Erros de campo
        Component->>Component: Mostra erros inline
    else 401 Unauthorized
        ErrorHandler->>ErrorHandler: Tenta refresh token
        alt Refresh OK
            ErrorHandler->>APIClient: Retry request
        else Refresh falha
            ErrorHandler->>AuthStore: clearAuth()
            ErrorHandler->>Router: redirect('/login')
        end
    else 403 Forbidden
        ErrorHandler->>ErrorHandler: new PermissionError()
        ErrorHandler-->>Component: Erro de permissão
        Component->>Component: Toast de erro
    else 404 Not Found
        ErrorHandler->>ErrorHandler: new NotFoundError()
        ErrorHandler-->>Component: Recurso não encontrado
        Component->>Router: redirect('/404')
    else 500 Server Error
        ErrorHandler->>ErrorHandler: new ServerError()
        ErrorHandler-->>Component: Erro do servidor
        Component->>Component: Toast de erro genérico
        Component->>Component: Log error para Sentry (futuro)
    end
```

### Validação em Múltiplas Camadas

```mermaid
graph TD
    A[Usuário insere dados] --> B[Validação Frontend - Zod]
    B --> |Erro| C[Mostra erro inline]
    B --> |OK| D[Envia para backend]
    D --> E[Validação Serializer - DRF]
    E --> |Erro| F[400 Bad Request]
    E --> |OK| G[Validação Model - Django]
    G --> |Erro| H[500 Server Error]
    G --> |OK| I[Validação Database - Constraints]
    I --> |Erro| J[IntegrityError]
    I --> |OK| K[Dados salvos]

    F --> L[Frontend mostra erros]
    H --> L
    J --> L
```

**Camadas de Validação**:

1. **Frontend (Zod)**:
   - Tipos corretos
   - Campos obrigatórios
   - Formatos (email, URL, etc.)
   - Limites de tamanho

2. **Serializer (DRF)**:
   - Validações de negócio
   - Relacionamentos válidos
   - Valores permitidos
   - Validações customizadas

3. **Model (Django)**:
   - Constraints de banco
   - Validações de integridade
   - Valores default

4. **Database (PostgreSQL)**:
   - NOT NULL
   - UNIQUE
   - FOREIGN KEY
   - CHECK constraints

## Performance e Otimizações

### N+1 Queries Problem - Solução

**Problema**:

```python
# Gera N+1 queries (ruim)
accounts = Account.objects.all()
for account in accounts:
    print(account.owner.name)  # Query adicional por account!
```

**Solução**:

```python
# Gera apenas 2 queries (bom)
accounts = Account.objects.select_related('owner').all()
for account in accounts:
    print(account.owner.name)  # Já carregado, sem query extra
```

**Estratégias**:

- `select_related()`: Para ForeignKey e OneToOne (JOIN)
- `prefetch_related()`: Para ManyToMany e reverse ForeignKey (IN query)
- `only()`: Carrega apenas campos específicos
- `defer()`: Adia carregamento de campos pesados

### Caching (Futuro)

**Estratégia de cache planejada**:

```python
# Backend - com decorador
@cache_page(60 * 5)  # Cache por 5 minutos
def dashboard_summary(request):
    # Query pesada
    return Response(data)

# Com Redis
cache.set(f'dashboard:{user_id}', data, timeout=300)
cached = cache.get(f'dashboard:{user_id}')
```

**Dados a cachear**:
- Dashboard summaries
- Listas frequentemente acessadas
- Configurações de usuário
- Dados de referência (categorias, tipos)

### Lazy Loading (Frontend)

```typescript
// Componentes carregados sob demanda
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));

// Na rota
<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

**Benefícios**:
- Bundle inicial menor
- Carregamento mais rápido
- Recursos carregados apenas quando necessários

## Links Relacionados

- [Visão Geral da Arquitetura](./visao-geral.md)
- [Decisões Arquiteturais](./decisoes-arquiteturais.md)
- [Documentação da API](../05-api/endpoints.md)
- [Autenticação](../07-authentication-security/autenticacao.md)
- [Segurança](../07-authentication-security/seguranca.md)
