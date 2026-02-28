# Filtros e Ordenação

## Visão Geral

A API do MindLedger suporta filtros via query parameters para facilitar buscas específicas e ordenação de resultados.

## Query Parameters

### Formato Geral

```
GET /api/v1/{resource}/?{param}={value}&{param2}={value2}
```

**Exemplo:**
```
GET /api/v1/expenses/?category=food&payed=false&date_from=2024-01-01
```

## Filtros por Módulo

### Expenses (Despesas)

**Endpoint:** `/api/v1/expenses/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `category` | string | Filtrar por categoria | `?category=food` |
| `payed` | boolean | Filtrar por status de pagamento | `?payed=true` |
| `account` | number | Filtrar por conta | `?account=1` |
| `date_from` | date | Data inicial (YYYY-MM-DD) | `?date_from=2024-01-01` |
| `date_to` | date | Data final (YYYY-MM-DD) | `?date_to=2024-12-31` |
| `member` | number | Filtrar por membro responsável | `?member=1` |
| `merchant` | string | Filtrar por comerciante | `?merchant=Amazon` |

**Exemplos:**

```bash
# Despesas não pagas de alimentação
GET /api/v1/expenses/?category=food&payed=false

# Despesas de janeiro de 2024
GET /api/v1/expenses/?date_from=2024-01-01&date_to=2024-01-31

# Despesas da conta específica
GET /api/v1/expenses/?account=1

# Combinação de filtros
GET /api/v1/expenses/?category=supermarket&payed=false&account=1
```

### Revenues (Receitas)

**Endpoint:** `/api/v1/revenues/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `category` | string | Filtrar por categoria | `?category=salary` |
| `received` | boolean | Filtrar por recebimento | `?received=true` |
| `account` | number | Filtrar por conta | `?account=1` |
| `date_from` | date | Data inicial | `?date_from=2024-01-01` |
| `date_to` | date | Data final | `?date_to=2024-12-31` |
| `member` | number | Filtrar por membro | `?member=1` |

**Exemplos:**

```bash
# Salários recebidos
GET /api/v1/revenues/?category=salary&received=true

# Receitas de fevereiro
GET /api/v1/revenues/?date_from=2024-02-01&date_to=2024-02-29
```

### Members (Membros)

**Endpoint:** `/api/v1/members/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `is_creditor` | boolean | Apenas credores | `?is_creditor=true` |
| `is_benefited` | boolean | Apenas beneficiados | `?is_benefited=true` |
| `active` | boolean | Status ativo | `?active=true` |
| `sex` | string | Filtrar por sexo | `?sex=M` |

**Exemplos:**

```bash
# Apenas membros ativos
GET /api/v1/members/?active=true

# Apenas credores
GET /api/v1/members/?is_creditor=true

# Membros do sexo feminino
GET /api/v1/members/?sex=F
```

### Credit Cards (Cartões de Crédito)

**Endpoint:** `/api/v1/credit-cards/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `is_active` | boolean | Cartões ativos | `?is_active=true` |
| `flag` | string | Bandeira | `?flag=MSC` |
| `owner` | number | Proprietário | `?owner=1` |

**Exemplos:**

```bash
# Cartões ativos
GET /api/v1/credit-cards/?is_active=true

# Cartões Visa
GET /api/v1/credit-cards/?flag=VSA
```

### Credit Card Bills (Faturas)

**Endpoint:** `/api/v1/credit-card-bills/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `credit_card` | number | ID do cartão | `?credit_card=1` |
| `year` | string | Ano | `?year=2024` |
| `month` | string | Mês | `?month=Jan` |
| `closed` | boolean | Fatura fechada | `?closed=false` |
| `status` | string | Status | `?status=open` |

**Exemplos:**

```bash
# Faturas abertas
GET /api/v1/credit-card-bills/?closed=false

# Faturas de janeiro de 2024
GET /api/v1/credit-card-bills/?year=2024&month=Jan

# Faturas de um cartão específico
GET /api/v1/credit-card-bills/?credit_card=1
```

### Transfers (Transferências)

**Endpoint:** `/api/v1/transfers/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `origin_account` | number | Conta de origem | `?origin_account=1` |
| `destiny_account` | number | Conta de destino | `?destiny_account=2` |
| `transfered` | boolean | Transferido | `?transfered=true` |
| `category` | string | Tipo | `?category=pix` |
| `date_from` | date | Data inicial | `?date_from=2024-01-01` |
| `date_to` | date | Data final | `?date_to=2024-12-31` |

**Exemplos:**

```bash
# Transferências PIX realizadas
GET /api/v1/transfers/?category=pix&transfered=true

# Transferências entre contas específicas
GET /api/v1/transfers/?origin_account=1&destiny_account=2
```

### Loans (Empréstimos)

**Endpoint:** `/api/v1/loans/`

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `creditor` | number | ID do credor | `?creditor=1` |
| `benefited` | number | ID do beneficiado | `?benefited=2` |
| `payed` | boolean | Quitado | `?payed=false` |
| `status` | string | Status | `?status=active` |
| `date_from` | date | Data inicial | `?date_from=2024-01-01` |
| `date_to` | date | Data final | `?date_to=2024-12-31` |

**Exemplos:**

```bash
# Empréstimos ativos não quitados
GET /api/v1/loans/?status=active&payed=false

# Empréstimos de um credor específico
GET /api/v1/loans/?creditor=1
```

## Ordenação (Ordering)

### Parâmetro `ordering`

Ordena resultados por um ou mais campos.

**Sintaxe:**
```
?ordering={field}           # Ascendente
?ordering=-{field}          # Descendente
?ordering={field1},-{field2} # Múltiplos campos
```

**Exemplos:**

```bash
# Despesas ordenadas por data (mais recente primeiro)
GET /api/v1/expenses/?ordering=-date

# Contas ordenadas por saldo (maior primeiro)
GET /api/v1/accounts/?ordering=-current_balance

# Membros ordenados por nome (A-Z)
GET /api/v1/members/?ordering=name

# Múltiplos campos: categoria (asc), valor (desc)
GET /api/v1/expenses/?ordering=category,-value
```

### Campos Ordenáveis por Modelo

**Expenses:**
- `date` - Data da despesa
- `value` - Valor
- `category` - Categoria
- `description` - Descrição

**Revenues:**
- `date` - Data da receita
- `value` - Valor
- `category` - Categoria

**Accounts:**
- `name` - Nome
- `current_balance` - Saldo atual
- `opening_date` - Data de abertura

**Members:**
- `name` - Nome
- `document` - Documento
- `created_at` - Data de criação

## Busca (Search)

### Parâmetro `search`

Busca textual em campos específicos.

**Sintaxe:**
```
?search={query}
```

**Exemplos:**

```bash
# Buscar despesas por descrição ou comerciante
GET /api/v1/expenses/?search=amazon

# Buscar membros por nome ou documento
GET /api/v1/members/?search=joão

# Buscar contas por nome
GET /api/v1/accounts/?search=nubank
```

### Campos de Busca por Modelo

**Expenses:**
- `description` - Descrição
- `merchant` - Comerciante
- `notes` - Observações

**Revenues:**
- `description` - Descrição
- `source` - Fonte
- `notes` - Observações

**Members:**
- `name` - Nome
- `document` - Documento
- `email` - Email

**Credit Cards:**
- `name` - Nome
- `on_card_name` - Nome no cartão

## Paginação

A API retorna resultados paginados automaticamente.

**Estrutura de Resposta:**
```json
{
  "count": 100,
  "next": "http://localhost:8002/api/v1/expenses/?page=2",
  "previous": null,
  "results": [
    // ... itens da página
  ]
}
```

### Parâmetros de Paginação

| Parâmetro | Descrição | Padrão |
|-----------|-----------|--------|
| `page` | Número da página | 1 |
| `page_size` | Itens por página | 10 (configurável) |

**Exemplos:**

```bash
# Segunda página
GET /api/v1/expenses/?page=2

# 50 itens por página
GET /api/v1/expenses/?page_size=50

# Terceira página com 25 itens
GET /api/v1/expenses/?page=3&page_size=25
```

## Combinação de Filtros

Combine múltiplos filtros para consultas complexas:

```bash
# Despesas não pagas de alimentação, ordenadas por data, com busca
GET /api/v1/expenses/?category=food&payed=false&ordering=-date&search=restaurante

# Membros ativos que são credores, ordenados por nome
GET /api/v1/members/?active=true&is_creditor=true&ordering=name

# Receitas de salário recebidas em 2024, ordenadas por valor
GET /api/v1/revenues/?category=salary&received=true&date_from=2024-01-01&date_to=2024-12-31&ordering=-value
```

## Uso no Frontend

### Service com Filtros

```typescript
// services/expenses-service.ts
interface ExpenseFilters {
  category?: string;
  payed?: boolean;
  account?: number;
  date_from?: string;
  date_to?: string;
}

class ExpensesService {
  async getAll(filters?: ExpenseFilters): Promise<Expense[]> {
    const response = await apiClient.get<PaginatedResponse<Expense>>(
      API_CONFIG.ENDPOINTS.EXPENSES,
      filters // Query params
    );
    return response.results;
  }
}
```

### Uso em Componente

```typescript
function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filters, setFilters] = useState<ExpenseFilters>({
    payed: false,
    category: 'food',
  });

  useEffect(() => {
    loadExpenses();
  }, [filters]);

  const loadExpenses = async () => {
    const data = await expensesService.getAll(filters);
    setExpenses(data);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <Select onValueChange={(v) => handleFilterChange('category', v)}>
        {/* Opções de categoria */}
      </Select>
      <Checkbox
        checked={filters.payed}
        onCheckedChange={(v) => handleFilterChange('payed', v)}
      />
      {/* Lista de despesas */}
    </div>
  );
}
```

## Implementação no Backend

### Django Filter

```python
from django_filters import rest_framework as filters

class ExpenseFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = Expense
        fields = ['category', 'payed', 'account', 'member']

class ExpenseViewSet(viewsets.ModelViewSet):
    filterset_class = ExpenseFilter
    search_fields = ['description', 'merchant', 'notes']
    ordering_fields = ['date', 'value', 'category']
    ordering = ['-date']
```

## Validação de Filtros

### Backend Validation

```python
from rest_framework.exceptions import ValidationError

class ExpenseViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = super().get_queryset()

        # Validar datas
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_from and date_to:
            if date_from > date_to:
                raise ValidationError({
                    'date_from': 'Data inicial não pode ser maior que final'
                })

        return queryset
```

## Boas Práticas

### 1. Use filtros ao invés de filtrar no frontend

```typescript
// ✅ Bom - filtra no backend
const expenses = await expensesService.getAll({ payed: false });

// ❌ Ruim - carrega tudo e filtra no frontend
const allExpenses = await expensesService.getAll();
const unpaid = allExpenses.filter(e => !e.payed);
```

### 2. Valide parâmetros

```typescript
// ✅ Bom
const filters: ExpenseFilters = {
  date_from: startDate.toISOString().split('T')[0], // YYYY-MM-DD
  date_to: endDate.toISOString().split('T')[0],
};

// ❌ Ruim - formato inválido
const filters = {
  date_from: '01/01/2024', // Formato errado
};
```

### 3. Cache resultados filtrados

```typescript
// Use React Query ou SWR para caching
import { useQuery } from '@tanstack/react-query';

function useExpenses(filters: ExpenseFilters) {
  return useQuery(
    ['expenses', filters],
    () => expensesService.getAll(filters),
    { staleTime: 5 * 60 * 1000 } // Cache por 5 minutos
  );
}
```

## Próximos Passos

- **Endpoints:** Veja [endpoints.md](./endpoints.md)
- **Tratamento de Erros:** Veja [tratamento-erros.md](./tratamento-erros.md)
