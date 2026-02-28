# Endpoints da API

## Visão Geral

A API do MindLedger segue o padrão REST, com versionamento (`/api/v1/`) e autenticação JWT via cookies httpOnly.

**Base URL:** `http://localhost:8002/api/v1/`

## Estrutura de Endpoints

Todos os endpoints seguem o padrão:
```
/api/v1/{module}/{resource}/
```

## Autenticação

### POST `/authentication/login/`

Realiza login e define cookies httpOnly com tokens JWT.

**Request:**
```json
{
  "username": "usuario",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "message": "Login realizado com sucesso",
  "user": {
    "id": 1,
    "username": "usuario",
    "email": "usuario@email.com"
  }
}
```

**Cookies definidos:**
- `access_token` (httpOnly, secure)
- `refresh_token` (httpOnly, secure)
- `user_data` (não httpOnly - para acesso do frontend)
- `user_permissions` (não httpOnly - para acesso do frontend)

### POST `/authentication/logout/`

Remove cookies de autenticação.

**Requires:** Autenticação

**Response (200):**
```json
{
  "message": "Logout realizado com sucesso"
}
```

### POST `/authentication/token/refresh/`

Renova access token usando refresh token do cookie.

**Request:** Body vazio (tokens vêm dos cookies)

**Response (200):**
```json
{
  "message": "Token renovado com sucesso"
}
```

### POST `/authentication/token/verify/`

Verifica se access token é válido.

**Request:** Body vazio (token vem do cookie)

**Response (200):**
```json
{
  "message": "Token válido"
}
```

### GET `/authentication/user-permissions/`

Retorna permissões do usuário autenticado.

**Requires:** Autenticação

**Response (200):**
```json
{
  "username": "usuario",
  "permissions": [
    "accounts.add_account",
    "accounts.view_account",
    "expenses.add_expense"
  ],
  "is_staff": false,
  "is_superuser": false
}
```

### GET `/authentication/me/`

Retorna dados completos do usuário autenticado (User + Member vinculado).

**Requires:** Autenticação

**Response (200):**
```json
{
  "id": 1,
  "username": "usuario",
  "email": "usuario@email.com",
  "first_name": "João",
  "last_name": "Silva",
  "is_staff": false,
  "is_superuser": false,
  "permissions": [...],
  "member": {
    "id": 1,
    "name": "João Silva",
    "document": "12345678901",
    "phone": "11999887766",
    "email": "joao@email.com"
  }
}
```

### POST `/authentication/register/`

Cria novo usuário e membro vinculado.

**Request:**
```json
{
  "username": "novousuario",
  "password": "senha123",
  "name": "Nome Completo",
  "document": "12345678901",
  "phone": "11999887766",
  "email": "email@exemplo.com"
}
```

**Response (201):**
```json
{
  "message": "Usuário criado com sucesso",
  "user_id": 2,
  "member_id": 2,
  "username": "novousuario"
}
```

## Módulo Financeiro

### Contas (Accounts)

**Base:** `/accounts/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/accounts/` | Lista todas as contas |
| POST | `/accounts/` | Cria nova conta |
| GET | `/accounts/{id}/` | Detalhes de uma conta |
| PUT | `/accounts/{id}/` | Atualiza conta (completo) |
| PATCH | `/accounts/{id}/` | Atualiza conta (parcial) |
| DELETE | `/accounts/{id}/` | Exclui conta |

**Exemplo GET `/accounts/`:**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "NUB",
      "account_type": "CC",
      "current_balance": "2500.50",
      "is_active": true,
      "account_number_masked": "****1234",
      "owner": 1
    }
  ]
}
```

**Campos obrigatórios (POST/PUT):**
- `name` - Nome da instituição (NUB, SIC, MPG, IFB, CEF)
- `account_type` - Tipo (CC, CS, FG, VA)
- `is_active` - Status (boolean)

### Despesas (Expenses)

**Base:** `/expenses/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/expenses/` | Lista todas as despesas |
| POST | `/expenses/` | Cria nova despesa |
| GET | `/expenses/{id}/` | Detalhes de uma despesa |
| PUT | `/expenses/{id}/` | Atualiza despesa |
| DELETE | `/expenses/{id}/` | Exclui despesa |

**Query params (filtros):**
- `?category=food` - Filtrar por categoria
- `?payed=true` - Filtrar por status de pagamento
- `?account=1` - Filtrar por conta
- `?date_from=2024-01-01` - Data inicial
- `?date_to=2024-12-31` - Data final

**Exemplo GET `/expenses/?category=food&payed=false`:**
```json
{
  "count": 15,
  "results": [
    {
      "id": 1,
      "description": "Supermercado",
      "value": "234.50",
      "date": "2024-01-15",
      "horary": "19:30:00",
      "category": "supermarket",
      "account": 1,
      "payed": false,
      "merchant": "Extra",
      "payment_method": "debit_card"
    }
  ]
}
```

**Categorias disponíveis:**
`food and drink`, `bills and services`, `electronics`, `family and friends`, `pets`, `digital signs`, `house`, `purchases`, `donate`, `education`, `loans`, `entertainment`, `taxes`, `investments`, `others`, `vestuary`, `health and care`, `professional services`, `supermarket`, `rates`, `transport`, `travels`

### Receitas (Revenues)

**Base:** `/revenues/`

Mesma estrutura de endpoints das despesas.

**Categorias disponíveis:**
`deposit`, `award`, `salary`, `ticket`, `income`, `refund`, `cashback`, `transfer`, `received_loan`, `loan_devolution`

### Cartões de Crédito (Credit Cards)

**Base:** `/credit-cards/`

**Endpoints:**
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/credit-cards/` | Lista todos os cartões |
| POST | `/credit-cards/` | Cria novo cartão |
| GET | `/credit-cards/{id}/` | Detalhes do cartão |
| PUT | `/credit-cards/{id}/` | Atualiza cartão |
| DELETE | `/credit-cards/{id}/` | Exclui cartão |

**Segurança:**
- `security_code` (CVV) é criptografado e **nunca retornado**
- `card_number` é criptografado e retornado como `card_number_masked` (****1234)

**Exemplo POST:**
```json
{
  "name": "Cartão Principal",
  "on_card_name": "JOAO SILVA",
  "flag": "MSC",
  "validation_date": "2028-12-31",
  "security_code": "123",
  "credit_limit": "5000.00",
  "max_limit": "10000.00",
  "associated_account": 1
}
```

**Bandeiras disponíveis:**
`MSC` (MasterCard), `VSA` (Visa), `ELO`, `EXP` (American Express), `HCD` (Hipercard)

### Faturas de Cartão (Credit Card Bills)

**Base:** `/credit-card-bills/`

Mesma estrutura de endpoints CRUD.

**Campos principais:**
- `credit_card` - ID do cartão
- `year` - Ano (2025, 2026, etc.)
- `month` - Mês (Jan, Feb, Mar, etc.)
- `invoice_beginning_date` - Data inicial
- `invoice_ending_date` - Data final
- `closed` - Se a fatura está fechada
- `total_amount` - Valor total
- `status` - Status (open, closed, paid, overdue)

### Despesas do Cartão (Credit Card Expenses)

**Base:** `/credit-card-expenses/`

Despesas realizadas com cartão de crédito.

**Campos principais:**
- `card` - ID do cartão
- `bill` - ID da fatura (opcional)
- `installment` - Parcela atual
- `total_installments` - Total de parcelas

### Transferências (Transfers)

**Base:** `/transfers/`

**Campos principais:**
- `origin_account` - Conta de origem
- `destiny_account` - Conta de destino
- `value` - Valor
- `category` - Tipo (doc, ted, pix)
- `transfered` - Se foi transferido
- `fee` - Taxa cobrada

### Empréstimos (Loans)

**Base:** `/loans/`

**Campos principais:**
- `account` - Conta
- `benefited` - ID do beneficiado (Member)
- `creditor` - ID do credor (Member)
- `value` - Valor total
- `payed_value` - Valor já pago
- `payed` - Se foi quitado
- `installments` - Número de parcelas
- `interest_rate` - Taxa de juros (%)
- `status` - Status (active, paid, overdue, cancelled)

### Membros (Members)

**Base:** `/members/`

**Query params (filtros):**
- `?is_creditor=true` - Apenas credores
- `?is_benefited=true` - Apenas beneficiados
- `?active=true` - Apenas ativos

**Campos principais:**
- `name` - Nome completo (obrigatório)
- `document` - CPF/CNPJ (obrigatório, único)
- `phone` - Telefone (obrigatório)
- `sex` - M ou F (obrigatório)
- `is_creditor` - Se pode ser credor
- `is_benefited` - Se pode ser beneficiado
- `user` - ID do usuário vinculado (opcional)

## Módulo Security

### Senhas (Passwords)

**Base:** `/security/passwords/`

Armazena senhas criptografadas.

**Campos principais:**
- `title` - Título/identificação
- `username` - Usuário
- `_password` - Senha (criptografada)
- `url` - URL do site
- `notes` - Observações

### Cartões Armazenados (Stored Cards)

**Base:** `/security/stored-cards/`

Cartões armazenados de forma segura (não são cartões de crédito próprios).

### Contas Armazenadas (Stored Accounts)

**Base:** `/security/stored-accounts/`

Contas de terceiros armazenadas de forma segura.

### Arquivos (Archives)

**Base:** `/security/archives/`

Upload e armazenamento seguro de arquivos.

### Logs de Atividade (Activity Logs)

**Base:** `/security/activity-logs/`

Apenas leitura (GET). Logs automáticos de ações no sistema.

## Módulo Library

### Livros (Books)

**Base:** `/library/books/`

**Campos principais:**
- `title` - Título
- `author` - ID do autor
- `publisher` - ID da editora
- `isbn` - ISBN
- `pages` - Número de páginas
- `publication_year` - Ano de publicação
- `status` - Status (to_read, reading, read)

### Autores (Authors)

**Base:** `/library/authors/`

**Campos principais:**
- `name` - Nome do autor
- `biography` - Biografia
- `birth_date` - Data de nascimento

### Editoras (Publishers)

**Base:** `/library/publishers/`

**Campos principais:**
- `name` - Nome da editora
- `country` - País

### Resumos (Summaries)

**Base:** `/library/summaries/`

Resumos de livros.

### Leituras (Readings)

**Base:** `/library/readings/`

Registro de leituras de livros.

## Módulo AI Assistant

### POST `/ai-assistant/query/`

Consulta o assistente de IA com uma pergunta.

**Request:**
```json
{
  "query": "Qual foi minha despesa total em janeiro?"
}
```

**Response (200):**
```json
{
  "answer": "Sua despesa total em janeiro foi de R$ 4.500,00...",
  "sources": [
    {
      "type": "expense",
      "id": 1,
      "content": "Supermercado - R$ 234,50"
    }
  ]
}
```

### POST `/ai-assistant/stream/`

Versão streaming da consulta (SSE - Server-Sent Events).

## Módulo Dashboard

### GET `/dashboard/summary/`

Retorna resumo financeiro geral.

**Response:**
```json
{
  "total_balance": "10500.50",
  "total_expenses": "3200.00",
  "total_revenues": "5000.00",
  "pending_bills": 3,
  "active_loans": 2
}
```

## Módulo Personal Planning

### Tarefas de Rotina (Routine Tasks)

**Base:** `/planning/routine-tasks/`

### Metas (Goals)

**Base:** `/planning/goals/`

### Instâncias de Tarefas (Task Instances)

**Base:** `/planning/task-instances/`

### Reflexões Diárias (Daily Reflections)

**Base:** `/planning/daily-reflections/`

## Padrões de Resposta

### Sucesso

**200 OK - GET, PUT, PATCH:**
```json
{
  "id": 1,
  "field": "value",
  ...
}
```

**201 Created - POST:**
```json
{
  "id": 1,
  "field": "value",
  ...
}
```

**204 No Content - DELETE:**
(sem body)

### Paginação

```json
{
  "count": 100,
  "next": "http://localhost:8002/api/v1/accounts/?page=2",
  "previous": null,
  "results": [...]
}
```

### Erro

```json
{
  "field_name": ["Mensagem de erro"],
  "another_field": ["Outro erro"]
}
```

Ou:

```json
{
  "detail": "Mensagem de erro genérica"
}
```

## Headers Importantes

**Request:**
```
Content-Type: application/json
Cookie: access_token=...; refresh_token=...
```

**Response:**
```
Content-Type: application/json
Set-Cookie: access_token=...; HttpOnly; Secure
Set-Cookie: refresh_token=...; HttpOnly; Secure
```

## Permissões

Cada endpoint requer permissões específicas:

- `view_{model}` - Visualizar
- `add_{model}` - Criar
- `change_{model}` - Editar
- `delete_{model}` - Excluir

Exemplo: `accounts.add_account` para criar contas.

## Rate Limiting

Não implementado atualmente, mas planejado para o futuro.

## Próximos Passos

- **Autenticação:** Veja [autenticacao-tokens.md](./autenticacao-tokens.md)
- **Tratamento de Erros:** Veja [tratamento-erros.md](./tratamento-erros.md)
- **Filtros:** Veja [filtros-ordenacao.md](./filtros-ordenacao.md)
