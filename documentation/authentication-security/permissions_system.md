# Sistema de Permissões do Axiom

Documentação completa do sistema de permissões baseado em grupos Django e controle de acesso granular por modelo e ação.

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura de Permissões](#arquitetura-de-permissões)
- [GlobalDefaultPermission](#globaldefaultpermission)
- [Grupos e Permissões](#grupos-e-permissões)
- [Setup de Permissões](#setup-de-permissões)
- [Permissões Customizadas](#permissões-customizadas)
- [Integração com Frontend](#integração-com-frontend)
- [Casos de Uso](#casos-de-uso)
- [Troubleshooting](#troubleshooting)

## Visão Geral

O Axiom implementa um sistema de permissões robusto baseado no sistema nativo de permissões do Django, estendido para trabalhar perfeitamente com Django REST Framework (DRF).

### Características Principais

- **Permissões por modelo**: Cada modelo tem permissões CRUD (view, add, change, delete)
- **Baseado em grupos**: Usuários herdam permissões dos grupos
- **GlobalDefaultPermission**: Mapeamento automático de HTTP methods para permissões Django
- **Verificação automática**: Todas as ViewSets DRF verificam permissões automaticamente
- **Granularidade**: Controle fino por módulo e ação
- **Superusuários bloqueados**: Superusuários não podem acessar interface de membros

### Fluxo de Verificação de Permissões

```mermaid
graph TB
    A[Request HTTP] --> B{Usuário autenticado?}
    B -->|Não| C[401 Unauthorized]
    B -->|Sim| D{É superusuário?}
    D -->|Sim| E[Acesso permitido*]
    D -->|Não| F[GlobalDefaultPermission]
    F --> G[Identifica modelo da ViewSet]
    G --> H[Mapeia HTTP method para ação]
    H --> I{Usuário tem permissão<br/>app.ação_modelo?}
    I -->|Sim| J[200 OK - Acesso permitido]
    I -->|Não| K[403 Forbidden]

    E -.->|*Exceto em alguns casos| L[Bloqueio em endpoints<br/>específicos]
```

## Arquitetura de Permissões

### Modelo de Permissões Django

Cada modelo Django automaticamente gera 4 permissões:

| Permissão | Codename | Descrição |
|-----------|----------|-----------|
| **view** | `app.view_modelname` | Visualizar registros (GET, HEAD, OPTIONS) |
| **add** | `app.add_modelname` | Criar registros (POST) |
| **change** | `app.change_modelname` | Modificar registros (PUT, PATCH) |
| **delete** | `app.delete_modelname` | Deletar registros (DELETE) |

**Exemplo**: Para o modelo `Account` no app `accounts`:
- `accounts.view_account`
- `accounts.add_account`
- `accounts.change_account`
- `accounts.delete_account`

### Estrutura de Permissões

```
┌─────────────────────────────────────────────────────┐
│                    USUÁRIO                          │
│  - username, email, is_staff, is_superuser         │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ pertence a
                   ▼
┌─────────────────────────────────────────────────────┐
│                    GRUPOS                           │
│  - admins (todas as permissões)                    │
│  - members (permissões limitadas)                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ possui
                   ▼
┌─────────────────────────────────────────────────────┐
│                 PERMISSÕES                          │
│  - accounts.view_account                           │
│  - expenses.add_expense                            │
│  - revenues.change_revenue                         │
│  - ...                                             │
└─────────────────────────────────────────────────────┘
```

## GlobalDefaultPermission

### Arquivo
`apps/api/app/permissions.py`

### Código Completo

```python
from rest_framework import permissions


class GlobalDefaultPermission(permissions.BasePermission):
    """
    Permissão global que verifica permissões Django baseadas no modelo
    e método HTTP da request.

    Mapeia automaticamente:
    - GET/HEAD/OPTIONS -> view
    - POST -> add
    - PUT/PATCH -> change
    - DELETE -> delete
    """

    def has_permission(self, request, view):
        """
        Verifica se o usuário tem permissão para acessar a view.

        Args:
            request: Request HTTP
            view: ViewSet sendo acessada

        Returns:
            bool: True se tem permissão, False caso contrário
        """
        model_permission_codename = self._get_model_permission_codename(
            method=request.method,
            view=view,
        )

        if not model_permission_codename:
            return False

        return request.user.has_perm(model_permission_codename)

    def _get_model_permission_codename(self, method, view):
        """
        Constrói o codename da permissão baseado no modelo e método HTTP.

        Args:
            method: Método HTTP (GET, POST, PUT, PATCH, DELETE)
            view: ViewSet sendo acessada

        Returns:
            str: Codename da permissão (ex: 'accounts.view_account')
            None: Se não conseguir identificar o modelo
        """
        try:
            model_name = view.queryset.model._meta.model_name
            app_label = view.queryset.model._meta.app_label
            action = self._get_action_sufix(method)
            return f'{app_label}.{action}_{model_name}'
        except AttributeError:
            return None

    def _get_action_sufix(self, method):
        """
        Mapeia método HTTP para sufixo de permissão Django.

        Args:
            method: Método HTTP

        Returns:
            str: Sufixo da permissão ('view', 'add', 'change', 'delete')
        """
        method_actions = {
            'GET': 'view',
            'POST': 'add',
            'PUT': 'change',
            'PATCH': 'change',
            'DELETE': 'delete',
            'OPTIONS': 'view',
            'HEAD': 'view',
        }
        return method_actions.get(method, '')
```

### Como Funciona

#### Exemplo 1: GET /api/v1/accounts/

```python
# Request
GET /api/v1/accounts/

# GlobalDefaultPermission
1. Identifica: view = AccountViewSet
2. Extrai: model = Account, app_label = 'accounts'
3. Mapeia: method 'GET' -> action 'view'
4. Constrói: 'accounts.view_account'
5. Verifica: request.user.has_perm('accounts.view_account')

# Resultado
✅ Se usuário tem permissão -> 200 OK
❌ Se não tem permissão -> 403 Forbidden
```

#### Exemplo 2: POST /api/v1/expenses/

```python
# Request
POST /api/v1/expenses/
Body: { "description": "Almoço", "amount": 25.00 }

# GlobalDefaultPermission
1. Identifica: view = ExpenseViewSet
2. Extrai: model = Expense, app_label = 'expenses'
3. Mapeia: method 'POST' -> action 'add'
4. Constrói: 'expenses.add_expense'
5. Verifica: request.user.has_perm('expenses.add_expense')

# Resultado
✅ Se tem permissão -> Cria despesa -> 201 Created
❌ Se não tem permissão -> 403 Forbidden
```

### Configuração em ViewSets

```python
# accounts/views.py
from rest_framework import viewsets
from app.permissions import GlobalDefaultPermission
from .models import Account
from .serializers import AccountSerializer


class AccountViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar contas bancárias.
    Permissões verificadas automaticamente por GlobalDefaultPermission.
    """
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [GlobalDefaultPermission]  # Aplica verificação

    # Métodos disponíveis:
    # - list() -> GET /accounts/ -> requer accounts.view_account
    # - retrieve() -> GET /accounts/{id}/ -> requer accounts.view_account
    # - create() -> POST /accounts/ -> requer accounts.add_account
    # - update() -> PUT /accounts/{id}/ -> requer accounts.change_account
    # - partial_update() -> PATCH /accounts/{id}/ -> requer accounts.change_account
    # - destroy() -> DELETE /accounts/{id}/ -> requer accounts.delete_account
```

### Configuração Global (settings.py)

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',  # Requer autenticação
        # GlobalDefaultPermission aplicada por ViewSet
    ),
}
```

## Grupos e Permissões

### Grupo: admins

**Descrição**: Administradores com acesso total ao sistema

**Permissões**: Todas as permissões de todos os módulos

**Módulos**:
- `accounts` (Contas bancárias)
- `credit_cards` (Cartões de crédito)
- `expenses` (Despesas)
- `revenues` (Receitas)
- `loans` (Empréstimos)
- `transfers` (Transferências)
- `members` (Membros)
- `security` (Senhas armazenadas)
- `library` (Biblioteca de livros)
- `agents` (Assistente de IA)
- `personal_planning` (Planejamento pessoal)

**Criação de Usuário Admin**:
```python
from django.contrib.auth.models import User, Group

# Criar usuário
user = User.objects.create_user(
    username='admin',
    email='admin@example.com',
    password='senha_segura',
    is_staff=True  # Acesso ao Django Admin
)

# Adicionar ao grupo admins
admins_group = Group.objects.get(name='admins')
user.groups.add(admins_group)
```

### Grupo: members

**Descrição**: Membros regulares com permissões limitadas

**Permissões**:
- **accounts**: view, add, change (sem delete)
- **credit_cards**: view, add, change (sem delete)
- **expenses**: view, add, change, delete
- **revenues**: view, add, change, delete
- **loans**: view apenas (sem modificação)
- **transfers**: view apenas
- **security**: view, add, change, delete (suas próprias senhas)
- **library**: view, add, change, delete (seus próprios livros)
- **personal_planning**: view, add, change, delete

**Criação de Usuário Member**:
```python
from django.contrib.auth.models import User, Group

# Criar usuário
user = User.objects.create_user(
    username='member',
    email='member@example.com',
    password='senha_segura',
    is_staff=False  # SEM acesso ao Django Admin
)

# Adicionar ao grupo members
members_group = Group.objects.get(name='members')
user.groups.add(members_group)
```

### Superusuários

**Descrição**: Usuários com `is_superuser=True` têm TODAS as permissões por padrão

**Bloqueios Especiais**:
```python
# authentication/views.py
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_permissions(request):
    user = request.user

    # Bloqueia superusuários de usar interface Streamlit
    if user.is_superuser:
        return Response(
            {'error': 'Administradores não podem acessar esta interface'},
            status=status.HTTP_403_FORBIDDEN
        )

    perms = user.get_all_permissions()
    return Response({
        "username": user.username,
        "permissions": list(perms),
    })
```

## Setup de Permissões

### Management Command (Implementado)

`app/management/commands/setup_permissions.py` cria (ou reutiliza) o grupo `members` e concede CRUD completo (`view`/`add`/`change`/`delete`) nos modelos de praticamente todas as apps de domínio — `accounts`, `credit_cards`, `transfers`, `loans`, `payables`, `receivables`, `members`, `library`, `security`, `personal_planning` (hábitos, treino, nutrição), `vaults`, `notifications`, `budgets`, `monthly_planning`, `webhooks`. Permissões/ContentTypes ausentes geram apenas um aviso no console (`self.style.WARNING`/`ERROR`), sem interromper o comando. Idempotente: só adiciona a permissão se ainda não estiver no grupo.

```python
# app/management/commands/setup_permissions.py (resumo)
class Command(BaseCommand):
    def handle(self, *args, **options):
        members_group, created = Group.objects.get_or_create(name="members")

        app_models = {
            "accounts": ["account"],
            "expenses": ["expense", "fixedexpense", "fixedexpensegenerationlog"],
            "revenues": ["revenue"],
            "credit_cards": [...],
            "transfers": ["transfer"],
            "loans": ["loan"],
            "payables": ["payable"],
            "receivables": ["receivable", "receivableinstallment"],
            # ... library, security, personal_planning, vaults,
            # notifications, budgets, monthly_planning, webhooks
        }

        for app_label, models in app_models.items():
            for model_name in models:
                for perm_type in ["view", "add", "change", "delete"]:
                    # busca o Permission por content_type + codename
                    # e adiciona ao grupo "members" se ainda não tiver
                    ...
```

**Uso**: `$DC exec api python manage.py setup_permissions` (ver [`documentation/backend/management_commands.md`](../backend/management_commands.md)).

### Acesso por Tela — camada adicional (`admin_panel`)

Além das permissões Django por modelo acima, o Axiom tem uma **segunda camada** de controle de acesso, orientada a telas do frontend: o `ScreenAccessMiddleware` (`admin_panel/middleware.py`). Veja [`documentation/backend/middleware_signals.md`](../backend/middleware_signals.md) para o middleware e [`documentation/admin-panel/README.md`](../admin-panel/README.md) para o painel.

- **`admin_panel/screens.py`**: registro único das rotas da API agrupadas por tela/módulo (`planning`, `finance`, `security`, `intellect`) e por tipo de ação (`"crud"` deriva a ação do método HTTP; `"read"` só permite GET; um nome de ação explícito exige essa ação específica).
- **`UserScreenAccess`**: acesso concedido/negado por usuário, tela e ação.
- **`ScreenDefault`**: template de acesso aplicado automaticamente a usuários novos.
- Usuários `staff`/`superuser` sempre passam direto — a camada só se aplica a usuários comuns.
- Toda rota nova sob os prefixos `finance`/`planning`/`security`/`library` **precisa** ser registrada em `screens.py`, senão `tests/test_screen_access.py` falha.

### Uso do Comando

```bash
# Executar setup de permissões
python manage.py setup_permissions

# Saída esperada:
# Configurando grupos e permissões...
# Grupos configurados com sucesso!
```

### Verificação de Permissões

```bash
# Shell Django
python manage.py shell

# Verificar grupos
from django.contrib.auth.models import Group
Group.objects.all()  # <QuerySet [<Group: admins>, <Group: members>]>

# Verificar permissões de um grupo
admins = Group.objects.get(name='admins')
admins.permissions.count()  # Número de permissões

members = Group.objects.get(name='members')
list(members.permissions.values_list('codename', flat=True))
# ['view_account', 'add_account', 'change_account', ...]

# Verificar permissões de um usuário
from django.contrib.auth.models import User
user = User.objects.get(username='member')
user.get_all_permissions()
# {'accounts.view_account', 'accounts.add_account', ...}

user.has_perm('accounts.view_account')  # True
user.has_perm('accounts.delete_account')  # False (members não podem deletar)
```

## Permissões Customizadas

### Permissões por Objeto

Para permissões mais granulares (ex: usuário só pode editar seus próprios registros):

```python
# accounts/permissions.py
from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permissão customizada: apenas o dono do objeto ou admins podem acessar
    """

    def has_object_permission(self, request, view, obj):
        # Admins têm acesso total
        if request.user.is_staff or request.user.groups.filter(name='admins').exists():
            return True

        # Apenas GET/HEAD/OPTIONS permitido para todos autenticados
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions apenas para o dono
        return obj.owner == request.user


# Uso em ViewSet
class PasswordViewSet(viewsets.ModelViewSet):
    queryset = Password.objects.all()
    serializer_class = PasswordSerializer
    permission_classes = [GlobalDefaultPermission, IsOwnerOrAdmin]

    def get_queryset(self):
        """Filtra registros do usuário atual (exceto admins)"""
        user = self.request.user
        if user.is_staff or user.groups.filter(name='admins').exists():
            return Password.objects.all()
        return Password.objects.filter(owner=user)
```

### Permissões por Ação

```python
from rest_framework.decorators import action


class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [GlobalDefaultPermission]

    @action(detail=True, methods=['post'],
            permission_classes=[IsAuthenticated])  # Permissão customizada para esta ação
    def activate(self, request, pk=None):
        """Ativa uma conta - qualquer usuário autenticado pode fazer"""
        account = self.get_object()
        account.active = True
        account.save()
        return Response({'status': 'Conta ativada'})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Resumo de contas - usa GlobalDefaultPermission (view_account)"""
        accounts = self.get_queryset()
        total_balance = sum(acc.balance for acc in accounts)
        return Response({
            'total_accounts': accounts.count(),
            'total_balance': total_balance
        })
```

## Integração com Frontend

### Obtendo Permissões do Usuário

```typescript
// services/auth-service.ts
import { apiClient } from './api-client';

export interface UserPermissions {
  username: string;
  permissions: string[];
  is_staff: boolean;
  is_superuser: boolean;
}

export const authService = {
  getCurrentUser: async () => {
    return await apiClient.get<UserPermissions>('/api/v1/me/');
  },
};
```

### Verificação de Permissões no Frontend

```typescript
// hooks/usePermissions.ts
import { useAuthStore } from '@/stores/auth-store';

export const usePermissions = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return user.permissions.includes(permission);
  };

  const canView = (module: string): boolean => {
    return hasPermission(`${module}.view_${module.slice(0, -1)}`);
  };

  const canAdd = (module: string): boolean => {
    return hasPermission(`${module}.add_${module.slice(0, -1)}`);
  };

  const canChange = (module: string): boolean => {
    return hasPermission(`${module}.change_${module.slice(0, -1)}`);
  };

  const canDelete = (module: string): boolean => {
    return hasPermission(`${module}.delete_${module.slice(0, -1)}`);
  };

  return {
    hasPermission,
    canView,
    canAdd,
    canChange,
    canDelete,
  };
};
```

### Componente Protegido por Permissão

```typescript
// components/PermissionGuard.tsx
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Uso
<PermissionGuard permission="accounts.add_account">
  <Button onClick={handleCreate}>Criar Conta</Button>
</PermissionGuard>

<PermissionGuard
  permission="accounts.delete_account"
  fallback={<span>Sem permissão para deletar</span>}
>
  <Button onClick={handleDelete} variant="destructive">
    Deletar
  </Button>
</PermissionGuard>
```

### Exibição Condicional de Botões

```typescript
// pages/AccountsPage.tsx
import { usePermissions } from '@/hooks/usePermissions';

export const AccountsPage = () => {
  const { canAdd, canChange, canDelete } = usePermissions();

  return (
    <div>
      <h1>Contas Bancárias</h1>

      {canAdd('accounts') && (
        <Button onClick={handleCreate}>
          Nova Conta
        </Button>
      )}

      <Table data={accounts}>
        <Column field="name" />
        <Column field="balance" />
        <Column
          field="actions"
          render={(account) => (
            <>
              {canChange('accounts') && (
                <Button onClick={() => handleEdit(account)}>
                  Editar
                </Button>
              )}
              {canDelete('accounts') && (
                <Button onClick={() => handleDelete(account)} variant="destructive">
                  Deletar
                </Button>
              )}
            </>
          )}
        />
      </Table>
    </div>
  );
};
```

## Casos de Uso

### Caso 1: Novo Usuário Membro

```python
# 1. Criar usuário
user = User.objects.create_user(
    username='joao.silva',
    email='joao@example.com',
    password='senha123',
    is_staff=False
)

# 2. Adicionar ao grupo members
members_group = Group.objects.get(name='members')
user.groups.add(members_group)

# 3. Verificar permissões
user.has_perm('accounts.view_account')    # True
user.has_perm('accounts.add_account')     # True
user.has_perm('accounts.delete_account')  # False
user.has_perm('loans.change_loan')        # False (members só podem ver)
```

### Caso 2: Promover Usuário a Admin

```python
# 1. Buscar usuário
user = User.objects.get(username='joao.silva')

# 2. Remover do grupo members
members_group = Group.objects.get(name='members')
user.groups.remove(members_group)

# 3. Adicionar ao grupo admins
admins_group = Group.objects.get(name='admins')
user.groups.add(admins_group)

# 4. Conceder acesso ao Django Admin
user.is_staff = True
user.save()

# Agora tem todas as permissões
user.has_perm('accounts.delete_account')  # True
user.has_perm('loans.change_loan')        # True
```

### Caso 3: Permissões Customizadas

```python
# Conceder permissão específica fora dos grupos
from django.contrib.auth.models import Permission

user = User.objects.get(username='joao.silva')

# Buscar permissão
permission = Permission.objects.get(codename='delete_account')

# Adicionar permissão ao usuário
user.user_permissions.add(permission)

# Verificar
user.has_perm('accounts.delete_account')  # True
```

## Troubleshooting

### Problema: Usuário não tem permissão mesmo estando no grupo correto

**Causa**: Permissões em cache

**Solução**:
```python
# Forçar reload de permissões
from django.contrib.auth.models import User
user = User.objects.get(username='joao.silva')
user = User.objects.get(pk=user.pk)  # Reload from DB

# Ou limpar cache
from django.core.cache import cache
cache.clear()
```

### Problema: 403 Forbidden em todos os endpoints

**Causa**: GlobalDefaultPermission não configurada

**Solução**:
```python
# Verificar ViewSet
class AccountViewSet(viewsets.ModelViewSet):
    permission_classes = [GlobalDefaultPermission]  # Adicione esta linha
```

### Problema: Superusuário não consegue acessar

**Causa**: Bloqueio intencional em endpoint específico

**Solução**:
```python
# Verificar bloqueios no código
if user.is_superuser:
    # Remover ou ajustar lógica de bloqueio
    pass
```

### Problema: Frontend mostra botão mas API retorna 403

**Causa**: Dessincronia entre permissões no frontend e backend

**Solução**:
```typescript
// Forçar reload de permissões
const userData = await authService.getCurrentUser();
authStore.setUser(userData);
```

### Verificação de Permissões (Debug)

```python
# Shell Django
from django.contrib.auth.models import User

user = User.objects.get(username='joao.silva')

# Listar todos os grupos
print(user.groups.all())

# Listar todas as permissões (grupos + individuais)
print(user.get_all_permissions())

# Verificar permissão específica
print(user.has_perm('accounts.view_account'))

# Verificar se é admin
print(user.is_staff)
print(user.is_superuser)
print(user.groups.filter(name='admins').exists())
```

---

**Última atualização**: 2026-01-12
**Versão**: 1.0
