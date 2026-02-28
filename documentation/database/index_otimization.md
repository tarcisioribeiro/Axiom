# Índices e Otimização de Banco de Dados - MindLedger

> Guia completo de índices compostos, estratégias de performance e resolução de N+1 queries

## Índice

- [Visão Geral](#visão-geral)
- [Índices por Módulo](#índices-por-módulo)
- [Estratégias de Otimização](#estratégias-de-otimização)
- [Resolução de N+1 Queries](#resolução-de-n1-queries)
- [Índices pgvector](#índices-pgvector)
- [Monitoramento e Análise](#monitoramento-e-análise)
- [Boas Práticas](#boas-práticas)

---

## Visão Geral

O MindLedger utiliza índices estrategicamente posicionados para otimizar consultas frequentes, especialmente aquelas envolvendo:

- **Filtragem por data**: Transações financeiras ordenadas cronologicamente
- **Filtragem por owner**: Dados isolados por usuário (multi-tenant)
- **Busca por categoria**: Agrupamento de despesas/receitas
- **Busca vetorial**: Similaridade semântica com pgvector

### Tipos de Índices Utilizados

1. **Índices simples** (db_index=True): Para chaves estrangeiras e campos únicos
2. **Índices compostos** (Meta.indexes): Para queries com múltiplos filtros
3. **Índices de texto completo**: Para busca em campos TEXT
4. **Índices vetoriais** (pgvector): IVFFlat e HNSW para embeddings

### Impacto de Performance

```
Sem índice:  SELECT * FROM expenses WHERE account_id=X AND date>Y  -> ~200ms (10k rows)
Com índice:  SELECT * FROM expenses WHERE account_id=X AND date>Y  -> ~5ms (mesma query)
```

---

## Índices por Módulo

### 1. Expenses (Despesas)

**Tabela**: `expenses_expense`

```python
class Meta:
    ordering = ['-date']
    indexes = [
        # Índice para ordenação padrão
        models.Index(fields=['-date']),

        # Índice para filtro por categoria + data
        # Query: Expense.objects.filter(category='food', date__gte=start)
        models.Index(fields=['category', 'date']),

        # Índice para filtro por conta + data (multi-tenant por conta)
        # Query: Expense.objects.filter(account=acc, date__range=(start, end))
        models.Index(fields=['account', 'date']),

        # Índice para filtro de despesas pagas/não pagas por data
        # Query: Expense.objects.filter(payed=False, date__lte=today)
        models.Index(fields=['payed', 'date']),

        # Índice para agregação por conta e categoria
        # Query: Expense.objects.filter(account=acc, category='food').aggregate(Sum('value'))
        models.Index(fields=['account', 'category']),

        # Índices para relacionamentos de cascade
        models.Index(fields=['related_transfer']),
        models.Index(fields=['related_loan'])
    ]
```

**Queries Otimizadas**:

```python
# ✅ Usa índice (account, date)
Expense.objects.filter(
    account=account,
    date__gte=start_date
).order_by('-date')

# ✅ Usa índice (payed, date)
unpaid_overdue = Expense.objects.filter(
    payed=False,
    date__lt=timezone.now().date()
)

# ✅ Usa índice (category, date)
food_expenses_this_month = Expense.objects.filter(
    category='food and drink',
    date__month=this_month
).aggregate(total=Sum('value'))

# ❌ NÃO usa índice (inverte ordem dos campos)
Expense.objects.filter(
    date__gte=start_date,
    account=account  # account não está na posição correta
).order_by('-date')
```

**Dica**: A ordem dos campos no índice importa! O índice `[account, date]` é eficiente para `account=X` ou `account=X AND date=Y`, mas não para apenas `date=Y`.

---

### 2. Revenues (Receitas)

**Tabela**: `revenues_revenue`

```python
class Meta:
    ordering = ['-date']
    indexes = [
        models.Index(fields=['-date']),
        models.Index(fields=['category', 'date']),
        models.Index(fields=['account', 'date']),
        models.Index(fields=['received', 'date']),
        models.Index(fields=['account', 'category']),
        models.Index(fields=['related_transfer']),
        models.Index(fields=['related_loan'])
    ]
```

**Padrão Idêntico às Despesas**: Mesma lógica de otimização, queries análogas.

---

### 3. Fixed Expenses (Despesas Fixas)

**Tabela**: `expenses_fixedexpense`

```python
class Meta:
    ordering = ['due_day', 'description']
    indexes = [
        # Filtro por conta + status ativo
        # Query: FixedExpense.objects.filter(account=acc, is_active=True)
        models.Index(fields=['account', 'is_active']),

        # Ordenação por dia de vencimento + filtro ativo
        # Query: FixedExpense.objects.filter(is_active=True, due_day__lte=15)
        models.Index(fields=['due_day', 'is_active'])
    ]
```

**Query Típica - Geração de Despesas do Mês**:

```python
# ✅ Usa índice (due_day, is_active)
fixed_expenses_to_generate = FixedExpense.objects.filter(
    is_active=True,
    due_day__lte=today.day
).exclude(
    last_generated_month=current_month
)
```

---

### 4. Routine Tasks (Tarefas Rotineiras)

**Tabela**: `personal_planning_routinetask`

```python
class Meta:
    ordering = ['category', 'name']
    indexes = [
        # Filtro por owner + status ativo
        # Query: RoutineTask.objects.filter(owner=member, is_active=True)
        models.Index(fields=['owner', 'is_active']),

        # Filtro por periodicidade + status ativo
        # Query: RoutineTask.objects.filter(periodicity='daily', is_active=True)
        models.Index(fields=['periodicity', 'is_active'])
    ]
```

**Query Típica - Tarefas do Dia**:

```python
# ✅ Usa índice (owner, is_active)
active_tasks = RoutineTask.objects.filter(
    owner=member,
    is_active=True
)

# Filtragem adicional em Python (lógica complexa)
tasks_for_today = [
    task for task in active_tasks
    if task.should_appear_on_date(today)
]
```

**Nota**: A lógica de `should_appear_on_date()` é complexa (JSON fields, custom rules), então filtramos primeiro pelo índice e depois em memória.

---

### 5. Task Instances (Instâncias de Tarefas)

**Tabela**: `personal_planning_taskinstance`

```python
class Meta:
    ordering = ['scheduled_date', 'scheduled_time', 'occurrence_index']
    unique_together = [['template', 'scheduled_date', 'occurrence_index', 'owner']]
    indexes = [
        # Kanban view: tarefas do usuário por data
        # Query: TaskInstance.objects.filter(owner=member, scheduled_date=today)
        models.Index(fields=['owner', 'scheduled_date']),

        # Busca de instâncias de um template específico
        # Query: TaskInstance.objects.filter(template=task, scheduled_date=today)
        models.Index(fields=['template', 'scheduled_date']),

        # Filtro por status + data (ex: tarefas atrasadas)
        # Query: TaskInstance.objects.filter(status='pending', scheduled_date__lt=today)
        models.Index(fields=['status', 'scheduled_date']),

        # Ordenação temporal completa
        models.Index(fields=['scheduled_date', 'scheduled_time'])
    ]
```

**Queries Otimizadas**:

```python
# ✅ Usa índice (owner, scheduled_date)
today_tasks = TaskInstance.objects.filter(
    owner=member,
    scheduled_date=today
).order_by('scheduled_time')

# ✅ Usa índice (status, scheduled_date)
overdue_tasks = TaskInstance.objects.filter(
    status__in=['pending', 'in_progress'],
    scheduled_date__lt=today
)

# ✅ Usa índice (template, scheduled_date)
task_history = TaskInstance.objects.filter(
    template=routine_task,
    scheduled_date__range=(start, end)
)
```

---

### 6. Goals (Objetivos)

**Tabela**: `personal_planning_goal`

```python
class Meta:
    ordering = ['-created_at']
    indexes = [
        # Filtro por owner + status
        # Query: Goal.objects.filter(owner=member, status='active')
        models.Index(fields=['owner', 'status']),

        # Listagem geral por status + data de criação
        # Query: Goal.objects.filter(status='completed').order_by('-created_at')
        models.Index(fields=['status', '-created_at'])
    ]
```

---

### 7. Daily Reflections (Reflexões Diárias)

**Tabela**: `personal_planning_dailyreflection`

```python
class Meta:
    ordering = ['-date']
    unique_together = [['date', 'owner']]
    indexes = [
        # Paginação de reflexões do usuário
        # Query: DailyReflection.objects.filter(owner=member).order_by('-date')
        models.Index(fields=['owner', '-date'])
    ]
```

**Query Típica - Histórico de Humor**:

```python
# ✅ Usa índice (owner, -date)
last_30_days = DailyReflection.objects.filter(
    owner=member,
    date__gte=today - timedelta(days=30)
).values('date', 'mood')
```

---

### 8. Content Embeddings (AI Assistant)

**Tabela**: `ai_assistant_contentembedding`

```python
class Meta:
    ordering = ['-created_at']
    unique_together = [['content_type', 'content_id', 'owner']]
    indexes = [
        # Filtro por owner + tipo de conteúdo
        # Query: ContentEmbedding.objects.filter(owner=member, tipo='financeiro')
        models.Index(fields=['owner', 'tipo'], name='idx_owner_tipo'),

        # Filtro por owner + sensibilidade (roteamento de LLM)
        # Query: ContentEmbedding.objects.filter(owner=member, sensibilidade='alta')
        models.Index(fields=['owner', 'sensibilidade'], name='idx_owner_sens'),

        # Filtro por owner + status de indexação
        # Query: ContentEmbedding.objects.filter(owner=member, is_indexed=False)
        models.Index(fields=['owner', 'is_indexed'], name='idx_owner_indexed'),

        # Busca reversa: dado content_type + content_id, achar embedding
        # Query: ContentEmbedding.objects.get(content_type='expense', content_id=123)
        models.Index(fields=['content_type', 'content_id'], name='idx_content_ref'),

        # Filtro temporal por owner
        # Query: ContentEmbedding.objects.filter(owner=member, data_referencia__gte=start)
        models.Index(fields=['owner', '-data_referencia'], name='idx_owner_data')
    ]
```

**Queries Otimizadas - Busca Semântica**:

```python
# ✅ Usa índice (owner, tipo) + pgvector index
from pgvector.django import CosineDistance

similar_content = ContentEmbedding.objects.filter(
    owner=member,
    tipo='financeiro',
    is_indexed=True
).annotate(
    distance=CosineDistance('embedding', query_embedding)
).order_by('distance')[:10]

# ✅ Usa índice (owner, sensibilidade)
sensitive_content = ContentEmbedding.objects.filter(
    owner=member,
    sensibilidade='alta'
)
```

**Nota**: Para o campo `embedding`, veja seção [Índices pgvector](#índices-pgvector).

---

## Estratégias de Otimização

### 1. Select Related (ForeignKey)

Use `select_related()` para reduzir queries em relacionamentos ForeignKey:

```python
# ❌ Ruim: N+1 queries (1 query + 10 queries para account)
expenses = Expense.objects.all()[:10]
for expense in expenses:
    print(expense.account.account_name)  # Query extra!

# ✅ Bom: 1 query com JOIN
expenses = Expense.objects.select_related('account', 'member').all()[:10]
for expense in expenses:
    print(expense.account.account_name)  # Sem query extra!
```

**Quando Usar**:
- Relacionamentos OneToOne e ForeignKey
- Quando você SEMPRE precisará do objeto relacionado

**Exemplo Real - View de Despesas**:

```python
# Serializer precisará de: account, member, related_transfer
expenses = Expense.objects.select_related(
    'account',
    'member',
    'related_transfer__origin_account',
    'related_transfer__destiny_account'
).filter(account=account, date__gte=start_date)
```

---

### 2. Prefetch Related (ManyToMany e Reverse FK)

Use `prefetch_related()` para relacionamentos ManyToMany e reverse ForeignKeys:

```python
# ❌ Ruim: N+1 queries
books = Book.objects.all()[:10]
for book in books:
    print(book.authors.all())  # Query extra!

# ✅ Bom: 2 queries (1 para books, 1 para authors com JOIN em Book_Authors)
books = Book.objects.prefetch_related('authors').all()[:10]
for book in books:
    print(book.authors.all())  # Sem query extra!
```

**Quando Usar**:
- ManyToManyField
- Reverse ForeignKey (ex: `book.readings.all()`)
- Quando você SEMPRE precisará da coleção relacionada

**Exemplo Real - Dashboard de Livros**:

```python
# Precisamos: autores, editora, resumo, sessões de leitura
books = Book.objects.select_related(
    'publisher',  # ForeignKey
    'owner'       # ForeignKey
).prefetch_related(
    'authors',    # ManyToMany
    'readings',   # Reverse FK
    'summary'     # Reverse OneToOne
).filter(owner=member)
```

---

### 3. Only e Defer

Use `only()` para carregar apenas campos necessários ou `defer()` para excluir campos pesados:

```python
# ✅ Carregar apenas campos necessários para listagem
archives = Archive.objects.only(
    'id', 'title', 'category', 'archive_type', 'created_at'
).filter(owner=member)
# NÃO carrega: _encrypted_text, encrypted_file (campos pesados)

# ✅ Excluir apenas campos pesados
books = Book.objects.defer('synopsis').filter(read_status='read')
# Carrega todos os campos EXCETO synopsis
```

**Quando Usar**:
- Listagens que não precisam de todos os campos
- Campos TEXT ou BLOB grandes
- Serializers com diferentes níveis de detalhe (list vs retrieve)

---

### 4. Values e Values List

Use `values()` ou `values_list()` quando você só precisa de alguns campos (retorna dicionários ou tuplas):

```python
# ✅ Agregação simples (não precisa de objetos completos)
expense_totals = Expense.objects.filter(
    account=account,
    date__month=this_month
).values('category').annotate(
    total=Sum('value')
).order_by('-total')
# Retorna: [{'category': 'food', 'total': 1500.00}, ...]

# ✅ Pegar apenas IDs
expense_ids = Expense.objects.filter(
    payed=False
).values_list('id', flat=True)
# Retorna: [1, 2, 3, 4, 5]
```

---

### 5. Aggregate e Annotate

Use `aggregate()` para calcular valores agregados e `annotate()` para adicionar campos calculados:

```python
# ✅ Total de despesas (retorna dict)
total = Expense.objects.filter(
    account=account,
    date__month=this_month
).aggregate(
    total_spent=Sum('value'),
    avg_expense=Avg('value'),
    count=Count('id')
)
# Retorna: {'total_spent': 5000.00, 'avg_expense': 250.00, 'count': 20}

# ✅ Total por categoria (retorna QuerySet com campo extra)
expenses_by_category = Expense.objects.filter(
    account=account,
    date__month=this_month
).values('category').annotate(
    total=Sum('value')
).order_by('-total')
# Cada objeto tem: expense.category e expense.total
```

**Exemplo Real - Dashboard Financeiro**:

```python
from django.db.models import Sum, Count, Q

dashboard_data = {
    # Totais do mês
    'expenses_total': Expense.objects.filter(
        account=account,
        date__month=this_month
    ).aggregate(total=Sum('value'))['total'] or 0,

    'revenues_total': Revenue.objects.filter(
        account=account,
        date__month=this_month
    ).aggregate(total=Sum('value'))['total'] or 0,

    # Despesas por categoria (top 5)
    'top_categories': Expense.objects.filter(
        account=account,
        date__month=this_month
    ).values('category').annotate(
        total=Sum('value')
    ).order_by('-total')[:5],

    # Contadores
    'pending_expenses': Expense.objects.filter(
        account=account,
        payed=False
    ).count()
}
```

---

### 6. Bulk Operations

Use operações em lote para inserir/atualizar múltiplos registros:

```python
# ❌ Ruim: N queries
for i in range(100):
    Expense.objects.create(...)

# ✅ Bom: 1 query
expenses = [
    Expense(description=f"Expense {i}", value=100, account=account, ...)
    for i in range(100)
]
Expense.objects.bulk_create(expenses, batch_size=500)

# ❌ Ruim: N queries
tasks = TaskInstance.objects.filter(scheduled_date=today)
for task in tasks:
    task.status = 'pending'
    task.save()

# ✅ Bom: 1 query
TaskInstance.objects.filter(scheduled_date=today).update(status='pending')
```

**Limitações**:
- `bulk_create()` não chama `save()` nem sinais (signals)
- `update()` não chama `save()` nem sinais
- Use quando não precisar de lógica customizada

---

## Resolução de N+1 Queries

### O que é N+1?

Problema onde você faz 1 query para obter N objetos e depois N queries adicionais para obter dados relacionados.

```python
# ❌ N+1 Query Problem
expenses = Expense.objects.all()[:10]  # 1 query
for expense in expenses:
    print(expense.account.account_name)  # +10 queries = 11 queries total
```

### Exemplos Práticos e Soluções

#### Exemplo 1: Lista de Despesas com Conta e Membro

```python
# ❌ Ruim: 1 + N + M queries
expenses = Expense.objects.filter(account=account, date__gte=start)
for expense in expenses:
    print(expense.account.account_name)  # +N queries
    print(expense.member.name if expense.member else None)  # +M queries

# ✅ Bom: 1 query com JOINs
expenses = Expense.objects.select_related(
    'account',
    'member'
).filter(account=account, date__gte=start)
```

**SQL Gerado**:
```sql
-- Com select_related
SELECT expense.*, account.*, member.*
FROM expenses_expense expense
LEFT JOIN accounts_account account ON expense.account_id = account.id
LEFT JOIN members_member member ON expense.member_id = member.id
WHERE expense.account_id = %s AND expense.date >= %s
```

---

#### Exemplo 2: Livros com Autores (ManyToMany)

```python
# ❌ Ruim: 1 + N queries
books = Book.objects.filter(owner=member)
for book in books:
    authors = ", ".join(author.name for author in book.authors.all())  # +N queries

# ✅ Bom: 2 queries
books = Book.objects.prefetch_related('authors').filter(owner=member)
for book in books:
    authors = ", ".join(author.name for author in book.authors.all())  # Sem queries extras!
```

**SQL Gerado**:
```sql
-- Query 1: Buscar livros
SELECT * FROM library_book WHERE owner_id = %s;

-- Query 2: Buscar autores de todos os livros de uma vez
SELECT author.*, book_authors.book_id
FROM library_author author
INNER JOIN library_book_authors book_authors ON author.id = book_authors.author_id
WHERE book_authors.book_id IN (1, 2, 3, 4, 5);
```

---

#### Exemplo 3: Transferências com Contas de Origem e Destino

```python
# ❌ Ruim: 1 + 2N queries
transfers = Transfer.objects.filter(member=member)
for transfer in transfers:
    print(transfer.origin_account.account_name)  # +N queries
    print(transfer.destiny_account.account_name)  # +N queries

# ✅ Bom: 1 query com múltiplos JOINs
transfers = Transfer.objects.select_related(
    'origin_account',
    'destiny_account',
    'member'
).filter(member=member)
```

---

#### Exemplo 4: Cartões de Crédito com Última Fatura

```python
# ❌ Ruim: 1 + N queries
cards = CreditCard.objects.filter(owner=member)
for card in cards:
    last_bill = card.creditcardbill_set.order_by('-created_at').first()  # +N queries

# ✅ Bom: 2 queries (com Prefetch)
from django.db.models import Prefetch

cards = CreditCard.objects.prefetch_related(
    Prefetch(
        'creditcardbill_set',
        queryset=CreditCardBill.objects.order_by('-created_at'),
        to_attr='last_bills'
    )
).filter(owner=member)

for card in cards:
    last_bill = card.last_bills[0] if card.last_bills else None
```

**Nota**: `Prefetch` customizado permite filtrar/ordenar o relacionamento antes de carregar.

---

#### Exemplo 5: Tarefas Rotineiras com Instâncias Recentes

```python
# ❌ Ruim: 1 + N queries
tasks = RoutineTask.objects.filter(owner=member, is_active=True)
for task in tasks:
    last_instance = task.instances.order_by('-scheduled_date').first()  # +N queries

# ✅ Bom: 2 queries
tasks = RoutineTask.objects.prefetch_related(
    Prefetch(
        'instances',
        queryset=TaskInstance.objects.order_by('-scheduled_date')[:1],
        to_attr='recent_instance'
    )
).filter(owner=member, is_active=True)
```

---

### Debug de N+1 com Django Debug Toolbar

Instale e use Django Debug Toolbar para detectar N+1:

```python
# settings.py
INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
INTERNAL_IPS = ['127.0.0.1']

# urls.py
if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path('__debug__/', include(debug_toolbar.urls))]
```

No painel "SQL", procure por queries duplicadas com filtros similares.

---

## Índices pgvector

### O que é pgvector?

Extensão PostgreSQL para armazenar e buscar vetores (embeddings) com alta performance.

### Tipos de Índices Vetoriais

#### 1. IVFFlat (Inverted File with Flat Compression)

Índice aproximado baseado em clustering:

```sql
-- Criar índice IVFFlat para busca por cosine similarity
CREATE INDEX idx_embedding_cosine ON ai_assistant_contentembedding
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Criar índice IVFFlat para busca por L2 distance
CREATE INDEX idx_embedding_l2 ON ai_assistant_contentembedding
USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);
```

**Características**:
- `lists`: Número de clusters (tipicamente `sqrt(num_rows)`)
- Mais rápido que HNSW para datasets menores (< 1M vetores)
- Recall ~90-95% (não 100% exato)
- Requer `probes` em runtime:
  ```sql
  SET ivfflat.probes = 10;  -- Busca em 10 clusters
  ```

**Quando Usar**:
- Datasets pequenos a médios (< 1M embeddings)
- Busca rápida com recall aceitável
- Menor uso de memória

---

#### 2. HNSW (Hierarchical Navigable Small World)

Índice aproximado baseado em grafos:

```sql
-- Criar índice HNSW para busca por cosine similarity
CREATE INDEX idx_embedding_hnsw ON ai_assistant_contentembedding
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Características**:
- `m`: Número de conexões por nó (16-64, default=16)
- `ef_construction`: Fator de expansão na construção (64-200, default=64)
- Mais rápido que IVFFlat para datasets grandes (> 1M vetores)
- Recall ~95-99%
- Usa mais memória

**Quando Usar**:
- Datasets grandes (> 1M embeddings)
- Alta exigência de recall
- Queries muito frequentes

---

### Índice Recomendado para MindLedger

```sql
-- Para datasets típicos (< 100k embeddings), use IVFFlat
CREATE INDEX idx_contentembedding_vector ON ai_assistant_contentembedding
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Setar probes em runtime (mais probes = melhor recall, mais lento)
SET ivfflat.probes = 10;
```

**Justificativa**:
- MindLedger tem datasets pequenos por usuário (< 10k por owner)
- Filtro `owner=X` reduz drasticamente o conjunto de busca
- IVFFlat é mais simples e eficiente para este caso

---

### Query Otimizada com pgvector

```python
from pgvector.django import CosineDistance

# ✅ Query com filtros + busca vetorial
similar = ContentEmbedding.objects.filter(
    owner=member,               # Índice: (owner, tipo)
    tipo='financeiro',          # Filtra antes da busca vetorial
    is_indexed=True             # Garante que embedding existe
).annotate(
    distance=CosineDistance('embedding', query_embedding)
).order_by('distance')[:10]    # Top 10 mais similares
```

**SQL Gerado**:
```sql
SELECT *, (embedding <=> %s) AS distance
FROM ai_assistant_contentembedding
WHERE owner_id = %s
  AND tipo = 'financeiro'
  AND is_indexed = true
ORDER BY distance
LIMIT 10;
```

**Performance**:
- Sem índice: ~500ms (1k rows)
- Com IVFFlat: ~20ms (1k rows)
- Com filtro owner: ~5ms (100 rows por owner)

---

### Operadores de Distância pgvector

```python
from pgvector.django import CosineDistance, L2Distance, MaxInnerProduct

# Cosine similarity (0 = idêntico, 2 = oposto)
.annotate(distance=CosineDistance('embedding', query_embedding))

# L2 distance (Euclidean)
.annotate(distance=L2Distance('embedding', query_embedding))

# Inner product (dot product)
.annotate(distance=MaxInnerProduct('embedding', query_embedding))
```

**Recomendação**: Use `CosineDistance` para embeddings normalizados (all-MiniLM-L6-v2 já normaliza).

---

## Monitoramento e Análise

### 1. Django Debug Toolbar

Já mencionado acima. Essencial para desenvolvimento.

### 2. EXPLAIN ANALYZE

Use `EXPLAIN ANALYZE` para entender planos de execução:

```python
# No Django shell
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("EXPLAIN ANALYZE " + str(queryset.query))
    print("\n".join(row[0] for row in cursor.fetchall()))
```

**Exemplo**:
```sql
EXPLAIN ANALYZE
SELECT * FROM expenses_expense
WHERE account_id = 1 AND date >= '2026-01-01'
ORDER BY date DESC;
```

**Output Esperado**:
```
Index Scan using expenses_expense_account_date_idx
  (cost=0.29..8.31 rows=1 width=200) (actual time=0.015..0.015 rows=0 loops=1)
  Index Cond: ((account_id = 1) AND (date >= '2026-01-01'::date))
Planning Time: 0.123 ms
Execution Time: 0.045 ms
```

**O que procurar**:
- ✅ `Index Scan`: Índice está sendo usado
- ❌ `Seq Scan`: Scan completo da tabela (lento!)
- ✅ `actual time`: Tempo real de execução

---

### 3. pg_stat_statements

Extensão PostgreSQL para monitorar queries lentas em produção:

```sql
-- Habilitar extensão
CREATE EXTENSION pg_stat_statements;

-- Ver queries mais lentas
SELECT
    calls,
    total_time / 1000 AS total_seconds,
    mean_time / 1000 AS avg_seconds,
    query
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;
```

---

### 4. Django Query Logging

Logue queries lentas em produção:

```python
# settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'WARNING',
        },
    },
}
```

Para queries lentas, use middleware customizado:

```python
# middleware.py
import time
from django.db import connection

class QueryCountDebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        queries_before = len(connection.queries)
        start_time = time.time()

        response = self.get_response(request)

        queries_after = len(connection.queries)
        total_time = time.time() - start_time

        num_queries = queries_after - queries_before
        if num_queries > 20 or total_time > 1.0:
            print(f"⚠️  Slow request: {request.path} - {num_queries} queries in {total_time:.2f}s")

        return response
```

---

## Boas Práticas

### 1. Índices Compostos: Ordem Importa

```python
# Índice: ['account', 'date']

# ✅ Usa índice
.filter(account=X)
.filter(account=X, date=Y)
.filter(account=X, date__gte=Y)

# ❌ NÃO usa índice (campo 'date' não está sozinho no início)
.filter(date=Y)
```

**Regra**: Índice `[A, B, C]` funciona para `A`, `A+B`, `A+B+C`, mas NÃO para `B`, `C`, ou `B+C`.

---

### 2. Evite OR com Campos Diferentes

```python
# ❌ OR impede uso de índice
.filter(Q(account=X) | Q(member=Y))  # Seq Scan!

# ✅ Use IN quando possível
.filter(account__in=[X, Y])

# ✅ Ou faça duas queries separadas e una em Python
results = list(query1) + list(query2)
```

---

### 3. Limite Uso de LIKE

```python
# ❌ LIKE com % inicial não usa índice
.filter(description__icontains='food')  # WHERE description ILIKE '%food%'

# ✅ LIKE sem % inicial pode usar índice
.filter(description__istartswith='food')  # WHERE description ILIKE 'food%'

# ✅ Para busca full-text, use SearchVector
from django.contrib.postgres.search import SearchVector
.annotate(search=SearchVector('description', 'notes')).filter(search='food')
```

---

### 4. Paginação Eficiente

```python
# ❌ Ruim: offset alto é lento
Page.objects.all()[10000:10020]  # Scan de 10020 rows!

# ✅ Bom: cursor-based pagination
last_id = 10000
Page.objects.filter(id__gt=last_id).order_by('id')[:20]
```

---

### 5. Cuidado com Count()

```python
# ❌ Count em queryset grande é lento
total = Expense.objects.filter(account=account).count()

# ✅ Use EXISTS quando possível
has_expenses = Expense.objects.filter(account=account).exists()

# ✅ Para contadores frequentes, use cache
from django.core.cache import cache
cache_key = f"expense_count_{account.id}"
total = cache.get(cache_key)
if total is None:
    total = Expense.objects.filter(account=account).count()
    cache.set(cache_key, total, timeout=3600)
```

---

### 6. Índices Não São de Graça

- **Custo de escrita**: Cada INSERT/UPDATE/DELETE atualiza índices
- **Espaço em disco**: Índices ocupam espaço (20-50% do tamanho da tabela)
- **Memória**: Índices ativos ficam em RAM

**Regra de Ouro**: Só crie índices para queries FREQUENTES e LENTAS.

---

### 7. Manutenção de Índices

```sql
-- Reindexar tabela após muitas inserções/deleções
REINDEX TABLE expenses_expense;

-- Analisar estatísticas (importante após bulk operations)
ANALYZE expenses_expense;

-- Vacuum (limpa dead tuples)
VACUUM ANALYZE expenses_expense;
```

Configure `autovacuum` no PostgreSQL para manutenção automática.

---

### 8. Use Database Functions

```python
# ✅ Agregação no banco (rápido)
total = Expense.objects.filter(
    account=account
).aggregate(Sum('value'))['value__sum']

# ❌ Agregação em Python (lento)
expenses = Expense.objects.filter(account=account)
total = sum(expense.value for expense in expenses)
```

---

## Checklist de Otimização

Ao criar uma nova view/endpoint:

- [ ] Identifiquei todas as queries?
- [ ] Usei `select_related()` para ForeignKeys?
- [ ] Usei `prefetch_related()` para ManyToMany/reverse FK?
- [ ] Verifiquei N+1 com Debug Toolbar?
- [ ] Queries frequentes usam índices existentes?
- [ ] Considerei `only()` ou `defer()` para campos pesados?
- [ ] Agregações são feitas no banco (não em Python)?
- [ ] Paginação está implementada?
- [ ] Testei com volume realista de dados?

---

## Próximos Passos

- [Extensão pgvector (detalhes)](./pgvector.md)
- [Guia de Migrations](./migrations.md)
- [Schema Completo](./schema.md)

---

**Última Atualização**: 2026-01-12
**PostgreSQL**: 14+ com pgvector 0.5+
