# Guia de Contribuição

Este guia estabelece padrões e boas práticas para contribuir com o Axiom.

## Índice

- [Como Contribuir](#como-contribuir)
- [Padrões de Código](#padrões-de-código)
- [Convenções de Commits](#convenções-de-commits)
- [Estratégia de Branches](#estratégia-de-branches)
- [Processo de Pull Request](#processo-de-pull-request)
- [Code Review](#code-review)
- [Documentação](#documentação)

## Como Contribuir

### 1. Fork e Clone

```bash
# Fork no GitHub (botão Fork)
# Clone seu fork
git clone https://github.com/seu-usuario/Axiom.git
cd Axiom

# Adicione o repositório original como upstream
git remote add upstream https://github.com/original-repo/Axiom.git
```

### 2. Configurar Ambiente

Siga o [Guia de Instalação](./installation.md) para configurar seu ambiente local.

### 3. Criar Branch

```bash
# Atualize main
git checkout main
git pull upstream main

# Crie uma branch para sua feature/fix
git checkout -b feature/nome-da-feature
```

### 4. Desenvolver

- Siga os [Padrões de Código](#padrões-de-código)
- Escreva testes para código novo
- Mantenha commits pequenos e focados
- Documente código complexo

### 5. Testar

```bash
# Backend
docker-compose exec api python manage.py test
docker-compose exec api pytest --cov

# Frontend
cd frontend
npm run lint
npm run build  # Verifica TypeScript
```

### 6. Commit e Push

```bash
# Stage changes
git add .

# Commit seguindo convenções
git commit -m "feat: adiciona autenticação OAuth"

# Push para seu fork
git push origin feature/nome-da-feature
```

### 7. Abrir Pull Request

- Vá ao GitHub e abra um Pull Request
- Preencha o template de PR
- Aguarde code review

## Padrões de Código

### Backend (Python/Django)

#### Estilo de Código

**Seguimos PEP 8 com algumas personalizações:**

- **Linha máxima**: 100 caracteres (não 79)
- **Formatador**: Black
- **Import organizer**: isort
- **Linter**: flake8

```python
# ✅ BOM
class AccountViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar contas bancárias.

    Endpoints:
    - GET /api/v1/accounts/ - Lista todas as contas
    - POST /api/v1/accounts/ - Cria nova conta
    - GET /api/v1/accounts/{id}/ - Detalhes de uma conta
    - PUT /api/v1/accounts/{id}/ - Atualiza conta
    - DELETE /api/v1/accounts/{id}/ - Remove conta
    """
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retorna apenas contas do usuário autenticado."""
        return self.queryset.filter(user=self.request.user)


# ❌ RUIM
class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)  # O que isso faz?
```

#### Nomes de Variáveis

```python
# ✅ BOM - descritivo, snake_case
user_account_balance = 1000.00
total_monthly_expenses = 5000.00
is_active_user = True

# ❌ RUIM - abreviado, camelCase
uab = 1000.00
totMoExp = 5000.00
active = True
```

#### Imports

**Ordem:**
1. Biblioteca padrão Python
2. Bibliotecas de terceiros
3. Django
4. DRF
5. Módulos locais

```python
# ✅ BOM
import os
from datetime import datetime

from cryptography.fernet import Fernet

from django.db import models
from django.contrib.auth.models import User

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from app.encryption import FieldEncryption
from accounts.models import Account


# ❌ RUIM - imports desorganizados
from accounts.models import Account
from django.db import models
import os
from rest_framework import viewsets
```

#### Docstrings

Use docstrings do tipo Google:

```python
def calculate_balance(account_id: int, start_date: datetime, end_date: datetime) -> float:
    """
    Calcula o saldo de uma conta em um período específico.

    Args:
        account_id: ID da conta bancária
        start_date: Data inicial do período
        end_date: Data final do período

    Returns:
        Saldo calculado da conta no período especificado

    Raises:
        Account.DoesNotExist: Se a conta não existir
        ValueError: Se start_date for maior que end_date

    Example:
        >>> balance = calculate_balance(1, datetime(2026, 1, 1), datetime(2026, 1, 31))
        >>> print(balance)
        5000.00
    """
    if start_date > end_date:
        raise ValueError("start_date não pode ser maior que end_date")

    # Implementação...
```

#### Models

```python
from django.db import models

class Account(models.Model):
    """Modelo para contas bancárias."""

    # Campos com verbose_name e help_text
    name = models.CharField(
        max_length=100,
        verbose_name="Nome da Conta",
        help_text="Nome descritivo da conta bancária"
    )

    balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Saldo",
        help_text="Saldo atual da conta"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Conta Bancária"
        verbose_name_plural = "Contas Bancárias"

    def __str__(self):
        return self.name
```

#### Serializers

```python
from rest_framework import serializers
from .models import Account

class AccountSerializer(serializers.ModelSerializer):
    """Serializer para o modelo Account."""

    # Campos read-only computados
    total_transactions = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['id', 'name', 'balance', 'total_transactions', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_total_transactions(self, obj):
        """Retorna o número total de transações da conta."""
        return obj.transactions.count()

    def validate_balance(self, value):
        """Valida que o saldo não seja negativo."""
        if value < 0:
            raise serializers.ValidationError("Saldo não pode ser negativo")
        return value
```

### Frontend (TypeScript/React)

#### Estilo de Código

**Seguimos Airbnb Style Guide com personalizações:**

- **Linha máxima**: 100 caracteres
- **Quotes**: Single quotes para strings, double para JSX
- **Semicolons**: Obrigatórios
- **Indentação**: 2 espaços

```typescript
// ✅ BOM
interface Account {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
}

export const AccountCard: React.FC<{ account: Account }> = ({ account }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="account-card">
      <h3>{account.name}</h3>
      <p>Saldo: R$ {account.balance.toFixed(2)}</p>
      <button onClick={handleToggle}>
        {isExpanded ? 'Menos' : 'Mais'}
      </button>
    </div>
  );
};


// ❌ RUIM
export const AccountCard = ({ account }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  return <div className="account-card"><h3>{account.name}</h3></div>
}
```

#### Nomes de Arquivos

```
✅ BOM
AccountCard.tsx         # Componente
account-service.ts      # Service
useAccounts.ts          # Custom hook
types.ts                # Tipos
index.ts                # Barrel export

❌ RUIM
accountCard.tsx
AccountService.ts
use_accounts.ts
```

#### Componentes

```typescript
// ✅ BOM - Componente funcional com tipos
import { useState } from 'react';
import { Account } from '@/types';

interface AccountCardProps {
  account: Account;
  onEdit?: (account: Account) => void;
  onDelete?: (id: number) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onEdit,
  onDelete
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(account);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">{account.name}</h3>
      <p className="text-gray-600">
        Saldo: R$ {account.balance.toFixed(2)}
      </p>

      {onEdit && (
        <button onClick={handleEdit} disabled={isLoading}>
          Editar
        </button>
      )}
    </div>
  );
};
```

#### Services

```typescript
// ✅ BOM - Service com tipos e tratamento de erros
import { apiClient } from './api-client';
import { Account, CreateAccountData, UpdateAccountData } from '@/types';

export const accountService = {
  /**
   * Lista todas as contas do usuário autenticado
   */
  getAll: async (): Promise<Account[]> => {
    const response = await apiClient.get<Account[]>('/api/v1/accounts/');
    return response.data;
  },

  /**
   * Busca uma conta por ID
   */
  getById: async (id: number): Promise<Account> => {
    const response = await apiClient.get<Account>(`/api/v1/accounts/${id}/`);
    return response.data;
  },

  /**
   * Cria uma nova conta
   */
  create: async (data: CreateAccountData): Promise<Account> => {
    const response = await apiClient.post<Account>('/api/v1/accounts/', data);
    return response.data;
  },

  /**
   * Atualiza uma conta existente
   */
  update: async (id: number, data: UpdateAccountData): Promise<Account> => {
    const response = await apiClient.put<Account>(
      `/api/v1/accounts/${id}/`,
      data
    );
    return response.data;
  },

  /**
   * Remove uma conta
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/accounts/${id}/`);
  },
};
```

#### Hooks Personalizados

```typescript
// ✅ BOM - Custom hook com tipos e tratamento de erros
import { useState, useEffect } from 'react';
import { accountService } from '@/services/account-service';
import { Account } from '@/types';

interface UseAccountsReturn {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAccounts = (): UseAccountsReturn => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await accountService.getAll();
      setAccounts(data);
    } catch (err) {
      setError('Erro ao carregar contas');
      console.error('Error fetching accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
  };
};
```

## Convenções de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/).

### Formato

```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé opcional]
```

### Tipos

- **feat**: Nova funcionalidade
- **fix**: Correção de bug
- **docs**: Apenas documentação
- **style**: Formatação, falta de ponto e vírgula, etc (sem mudança de código)
- **refactor**: Refatoração de código (sem adicionar feature ou corrigir bug)
- **perf**: Melhoria de performance
- **test**: Adição ou correção de testes
- **chore**: Mudanças em build, configs, etc
- **ci**: Mudanças em CI/CD

### Exemplos

```bash
# ✅ BOM
feat(accounts): adiciona filtro por tipo de conta
fix(auth): corrige token refresh infinito
docs(readme): atualiza instruções de instalação
style(frontend): formata código com prettier
refactor(api): extrai lógica de cálculo de saldo
perf(queries): otimiza query de listagem de despesas
test(accounts): adiciona testes para AccountSerializer
chore(deps): atualiza Django para 5.2.5

# ❌ RUIM
fixed bug
updates
changes
working on feature
```

### Corpo do Commit

Use o corpo para explicar **o que** e **por que**, não **como**:

```bash
git commit -m "feat(ai-assistant): adiciona cache semântico com Redis

Implementa cache de embeddings e resultados de busca para reduzir
latência e custos de API. Cache TTL configurável via settings.

- Adiciona RedisClient em ai_assistant/cache.py
- Implementa semantic_search com cache-aside pattern
- TTL padrão: 1 hora (configurável)

Closes #123"
```

### Breaking Changes

Se a mudança quebra compatibilidade, adicione `BREAKING CHANGE:` no rodapé:

```bash
git commit -m "feat(api): altera formato de resposta de contas

BREAKING CHANGE: campo 'saldo' renomeado para 'balance' na API de contas.
Clientes devem atualizar para usar o novo campo."
```

## Estratégia de Branches

### Branch Principal

- **main**: Código em produção, sempre estável

### Branches de Desenvolvimento

```
main
  ├── feature/nome-da-feature
  ├── fix/nome-do-bug
  ├── hotfix/problema-critico
  └── release/v1.2.0
```

### Nomenclatura

```bash
# Features
feature/oauth-authentication
feature/export-csv
feature/dark-mode

# Fixes
fix/balance-calculation
fix/token-refresh-loop
fix/missing-validation

# Hotfixes (correções críticas em produção)
hotfix/security-vulnerability
hotfix/data-loss-bug

# Releases
release/v1.2.0
release/v2.0.0-beta
```

### Fluxo de Trabalho

1. **Criar branch a partir de main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/nova-feature
   ```

2. **Desenvolver e commitar**
   ```bash
   git add .
   git commit -m "feat: adiciona nova feature"
   ```

3. **Manter atualizado com main**
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/nova-feature
   git rebase main
   ```

4. **Push e PR**
   ```bash
   git push origin feature/nova-feature
   # Abrir Pull Request no GitHub
   ```

5. **Após merge, deletar branch**
   ```bash
   git branch -d feature/nova-feature
   git push origin --delete feature/nova-feature
   ```

## Processo de Pull Request

### Template de PR

```markdown
## Descrição
Breve descrição do que este PR faz.

## Tipo de Mudança
- [ ] Bug fix (mudança que corrige um problema)
- [ ] Nova feature (mudança que adiciona funcionalidade)
- [ ] Breaking change (mudança que quebra compatibilidade)
- [ ] Documentação

## Como Testar
1. Passo a passo para testar as mudanças
2. Exemplos de uso
3. Screenshots (se aplicável)

## Checklist
- [ ] Código segue os padrões do projeto
- [ ] Testes escritos e passando
- [ ] Documentação atualizada
- [ ] Sem conflitos com main
- [ ] Code review solicitado

## Issues Relacionadas
Closes #123
Refs #456
```

### Antes de Abrir PR

```bash
# 1. Atualizar com main
git checkout main
git pull origin main
git checkout sua-branch
git rebase main

# 2. Executar testes
docker-compose exec api python manage.py test
docker-compose exec api pytest --cov
cd frontend && npm run lint && npm run build

# 3. Code quality
docker-compose exec api black .
docker-compose exec api isort .
docker-compose exec api flake8 .

# 4. Verificar commits
git log main..HEAD --oneline

# 5. Push
git push origin sua-branch
```

### Durante o PR

- Responda feedbacks rapidamente
- Faça commits adicionais (não force push)
- Mantenha discussão focada e respeitosa
- Atualize o PR se main mudou

### Após Aprovação

O merge será feito por um maintainer usando "Squash and merge" para manter histórico limpo.

## Code Review

### Como Revisor

**O que verificar:**

- [ ] Código segue padrões do projeto
- [ ] Lógica está correta
- [ ] Testes cobrem casos principais
- [ ] Sem vulnerabilidades de segurança
- [ ] Performance adequada
- [ ] Documentação clara
- [ ] Sem código comentado ou debug prints
- [ ] Sem secrets ou credenciais

**Como dar feedback:**

```markdown
✅ BOM
"Sugiro extrair essa lógica para um método separado para melhorar a testabilidade."
"Excelente uso de type hints aqui!"

❌ RUIM
"Isso está errado."
"Por que você fez assim?"
```

**Níveis de feedback:**

- **🔴 Blocker**: Deve ser corrigido antes do merge
- **🟡 Suggestion**: Sugestão opcional, pode ser feito em PR futuro
- **🟢 Nit**: Detalhes menores (formatação, typos)
- **💬 Question**: Dúvida sobre a implementação

### Como Autor

- Seja receptivo a feedbacks
- Explique decisões técnicas quando necessário
- Não leve críticas para o pessoal
- Pergunte se não entender o feedback
- Agradeça os revisores

## Documentação

### O que Documentar

- **Código complexo**: Use docstrings e comentários
- **Decisões técnicas**: Documente o "por quê"
- **APIs**: Adicione exemplos de uso
- **Configuração**: Atualize guias de instalação
- **Breaking changes**: Documente migrações necessárias

### Onde Documentar

```
documentation/
├── overview/           # Visão geral do sistema
├── architecture/       # Arquitetura e design
├── api/               # Documentação de APIs
├── frontend/          # Frontend específico
├── backend/           # Backend específico
├── development/       # Guias de desenvolvimento (este arquivo)
└── deployment/        # Deploy e produção
```

### Atualizando Documentação

Se seu PR muda comportamento visível:

1. Atualize docstrings no código
2. Atualize documentation/ se aplicável
3. Atualize CLAUDE.md se muda padrões
4. Adicione exemplos de uso

## Perguntas Frequentes

### Posso contribuir sem conhecer tudo?

Sim! Contribuições de todos os níveis são bem-vindas. Comece com issues marcadas como "good first issue".

### Como encontrar algo para trabalhar?

1. Veja issues abertas no GitHub
2. Procure por TODOs no código
3. Melhore documentação
4. Reporte bugs que encontrar

### Meu PR foi rejeitado, e agora?

Não desanime! Leia os feedbacks, faça as correções sugeridas e reenvie. Todo mundo passa por isso.

### Quanto tempo leva para revisar meu PR?

Geralmente 1-3 dias úteis. PRs menores são revisados mais rapidamente.

## Próximos Passos

- Leia [Workflow de Desenvolvimento](./development_workflow.md) para comandos diários
- Veja [Troubleshooting](./troubleshooting.md) se encontrar problemas
- Consulte [Configuração](./configuration.md) para ajustes avançados

---

**Lembre-se**: Código bom é código que outros conseguem entender e manter!
