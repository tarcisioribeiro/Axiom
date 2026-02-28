# ViewSets e Views Django REST Framework

## Visão Geral

As views do Django REST Framework são responsáveis por:
- Processar requisições HTTP
- Aplicar permissões e autenticação
- Executar lógica de negócio
- Retornar respostas formatadas em JSON
- Gerenciar transações e validações

## Tipos de Views

### 1. Generic Views

Views prontas do DRF para operações CRUD simples.

#### ListCreateAPIView

Para listar (GET) e criar (POST) recursos:

```python
# accounts/views.py
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from app.permissions import GlobalDefaultPermission

class AccountCreateListView(generics.ListCreateAPIView):
    """
    GET /api/v1/accounts/ - Lista todas as contas
    POST /api/v1/accounts/ - Cria uma nova conta
    """
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Account.objects.filter(is_deleted=False)
    serializer_class = AccountSerializer
    ordering = ['account_name']  # Ordenação consistente

    def get_queryset(self):
        """Filtra por usuário autenticado."""
        return Account.objects.filter(
            owner__user=self.request.user,
            is_deleted=False
        ).select_related('owner')

    def perform_create(self, serializer):
        """Adiciona usuário de criação e atualização."""
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )
```

**Métodos importantes**:
- `get_queryset()`: Filtra queryset base (ex: por usuário)
- `get_serializer_class()`: Retorna serializer dinamicamente
- `perform_create(serializer)`: Hook antes de salvar (adiciona campos extras)

#### RetrieveUpdateDestroyAPIView

Para operações em um único recurso (GET, PUT, PATCH, DELETE):

```python
class AccountRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/accounts/{id}/ - Recupera uma conta
    PUT /api/v1/accounts/{id}/ - Atualiza completamente
    PATCH /api/v1/accounts/{id}/ - Atualiza parcialmente
    DELETE /api/v1/accounts/{id}/ - Remove (soft delete)
    """
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Account.objects.filter(is_deleted=False)
    serializer_class = AccountSerializer

    def get_queryset(self):
        return Account.objects.filter(
            owner__user=self.request.user,
            is_deleted=False
        ).select_related('owner')

    def perform_update(self, serializer):
        """Hook antes de atualizar."""
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        """Soft delete: marca como deletado."""
        from django.utils import timezone
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()
```

**Métodos importantes**:
- `get_object()`: Recupera instância (já inclui 404 automático)
- `perform_update(serializer)`: Hook antes de atualizar
- `perform_destroy(instance)`: Hook para customizar deleção

### 2. APIView

View customizada com controle total sobre requisição/resposta.

#### Exemplo Simples

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """POST /api/v1/logout/ - Faz logout do usuário."""
        request.user.auth_token.delete()
        return Response(
            {'detail': 'Logout efetuado com sucesso.'},
            status=status.HTTP_200_OK
        )
```

#### Exemplo com Aggregations

```python
# dashboard/views.py
from django.db.models import Sum, Count
from decimal import Decimal

class DashboardStatsView(APIView):
    """
    GET /api/v1/dashboard/stats/

    Retorna estatísticas agregadas do dashboard em uma única requisição.
    Usa aggregations do Django ORM (executadas no banco) para performance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Filtrar registros não deletados
        accounts_qs = Account.objects.filter(is_deleted=False)
        expenses_qs = Expense.objects.filter(
            is_deleted=False,
            related_transfer__isnull=True,  # Exclui transferências internas
            payed=True
        )
        revenues_qs = Revenue.objects.filter(
            is_deleted=False,
            related_transfer__isnull=True,
            received=True
        )
        credit_cards_qs = CreditCard.objects.filter(is_deleted=False)

        # Aggregations no banco (otimizado)
        accounts_agg = accounts_qs.aggregate(
            total_balance=Sum('current_balance'),
            count=Count('id')
        )
        expenses_agg = expenses_qs.aggregate(total=Sum('value'))
        revenues_agg = revenues_qs.aggregate(total=Sum('value'))
        credit_cards_agg = credit_cards_qs.aggregate(
            total_limit=Sum('credit_limit'),
            count=Count('id')
        )

        # Construir response com valores padrão
        stats = {
            'total_balance': float(accounts_agg['total_balance'] or Decimal('0.00')),
            'total_expenses': float(expenses_agg['total'] or Decimal('0.00')),
            'total_revenues': float(revenues_agg['total'] or Decimal('0.00')),
            'total_credit_limit': float(credit_cards_agg['total_limit'] or Decimal('0.00')),
            'accounts_count': accounts_agg['count'] or 0,
            'credit_cards_count': credit_cards_agg['count'] or 0,
        }

        return Response(stats)
```

**Por que usar aggregations?**:
- Performance: Cálculos executados no banco de dados
- Reduz tráfego de rede (não busca todos os registros)
- Escalável para grandes volumes de dados

### 3. ViewSets

ViewSets combinam múltiplas views relacionadas em uma classe. Ideal para APIs RESTful completas.

#### ModelViewSet

ViewSet completo com todas as operações CRUD:

```python
from rest_framework import viewsets

class BookViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para livros:
    - GET /api/v1/books/ - Lista todos
    - POST /api/v1/books/ - Cria novo
    - GET /api/v1/books/{id}/ - Detalhes
    - PUT /api/v1/books/{id}/ - Atualiza completo
    - PATCH /api/v1/books/{id}/ - Atualiza parcial
    - DELETE /api/v1/books/{id}/ - Remove
    """
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = Book.objects.filter(deleted_at__isnull=True)

    def get_queryset(self):
        return Book.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner', 'publisher').prefetch_related('authors')

    def get_serializer_class(self):
        """Serializer dinâmico baseado na ação."""
        if self.action in ['create', 'update', 'partial_update']:
            return BookCreateUpdateSerializer
        return BookSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        """Soft delete."""
        from django.utils import timezone
        instance.deleted_at = timezone.now()
        instance.save()
```

**Registro no urls.py**:
```python
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'books', BookViewSet, basename='book')

urlpatterns = [
    path('api/v1/', include(router.urls)),
]
```

#### ReadOnlyModelViewSet

Para recursos somente leitura:

```python
class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet somente leitura para logs de atividade:
    - GET /api/v1/activity-logs/ - Lista todos
    - GET /api/v1/activity-logs/{id}/ - Detalhes
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        return ActivityLog.objects.filter(
            user=self.request.user
        ).order_by('-created_at')
```

### 4. Custom Actions

Adicionar endpoints customizados a ViewSets:

```python
from rest_framework.decorators import action

class PasswordViewSet(viewsets.ModelViewSet):
    # ... configuração padrão

    @action(detail=True, methods=['post'])
    def reveal(self, request, pk=None):
        """
        POST /api/v1/passwords/{id}/reveal/

        Revela senha descriptografada (com log de auditoria).
        """
        password_obj = self.get_object()

        # Log da revelação
        ActivityLog.log_action(
            user=request.user,
            action='reveal',
            model_name='Password',
            object_id=password_obj.id,
            description=f'Revelou senha: {password_obj.title}',
            ip_address=get_client_ip(request)
        )

        # Retorna senha descriptografada
        return Response({
            'id': password_obj.id,
            'title': password_obj.title,
            'username': password_obj.username,
            'password': password_obj.password  # Property descriptografa
        })

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """
        GET /api/v1/passwords/by_category/?category=social

        Lista senhas filtradas por categoria.
        """
        category = request.query_params.get('category')
        if not category:
            return Response(
                {'error': 'Parâmetro "category" é obrigatório'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(category=category)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def generate_password(self, request):
        """
        POST /api/v1/passwords/generate_password/
        Body: { "length": 16, "include_symbols": true }

        Gera senha aleatória segura.
        """
        import secrets
        import string

        length = request.data.get('length', 16)
        include_symbols = request.data.get('include_symbols', True)

        chars = string.ascii_letters + string.digits
        if include_symbols:
            chars += string.punctuation

        password = ''.join(secrets.choice(chars) for _ in range(length))

        return Response({'password': password})
```

**Tipos de action**:
- `detail=True`: Requer ID (`/api/v1/resource/{id}/action/`)
- `detail=False`: Não requer ID (`/api/v1/resource/action/`)
- `methods`: Lista de métodos HTTP aceitos

### 5. Function-Based Views

Para casos onde view simples é suficiente:

```python
from rest_framework.decorators import api_view, permission_classes

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    GET /api/v1/me/

    Retorna dados do usuário autenticado.
    """
    from members.models import Member

    user = request.user

    # Buscar membro vinculado
    try:
        member = Member.objects.get(user=user, is_deleted=False)
        member_data = {
            'id': member.id,
            'name': member.name,
            'document': member.document,
            'phone': member.phone,
            'email': member.email,
            'sex': member.sex,
        }
    except Member.DoesNotExist:
        member_data = None

    # Permissões do usuário
    perms = user.get_all_permissions()

    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'permissions': list(perms),
        'member': member_data,
    })
```

## Permissões

### Permissões Globais

```python
from rest_framework.permissions import IsAuthenticated
from app.permissions import GlobalDefaultPermission

class MyView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    # ...
```

**Permissões disponíveis**:
- `IsAuthenticated`: Requer usuário autenticado
- `IsAdminUser`: Requer usuário admin
- `AllowAny`: Qualquer um (endpoints públicos)
- `GlobalDefaultPermission`: Verifica permissão Django baseada no modelo

### GlobalDefaultPermission

Verifica automaticamente permissões Django baseadas no modelo e método HTTP:

```python
# app/permissions.py
class GlobalDefaultPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        model_permission_codename = self._get_model_permission_codename(
            method=request.method,
            view=view,
        )
        if not model_permission_codename:
            return False
        return request.user.has_perm(model_permission_codename)

    def _get_model_permission_codename(self, method, view):
        try:
            model_name = view.queryset.model._meta.model_name
            app_label = view.queryset.model._meta.app_label
            action = self._get_action_sufix(method)
            return f'{app_label}.{action}_{model_name}'
        except AttributeError:
            return None

    def _get_action_sufix(self, method):
        method_actions = {
            'GET': 'view',
            'POST': 'add',
            'PUT': 'change',
            'PATCH': 'change',
            'DELETE': 'delete',
        }
        return method_actions.get(method, '')
```

**Exemplo de permissão gerada**:
- `GET /api/v1/accounts/` → Verifica `accounts.view_account`
- `POST /api/v1/accounts/` → Verifica `accounts.add_account`
- `PUT /api/v1/accounts/1/` → Verifica `accounts.change_account`
- `DELETE /api/v1/accounts/1/` → Verifica `accounts.delete_account`

### Permissões Customizadas

```python
from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permissão customizada: somente dono pode editar.
    """
    def has_object_permission(self, request, view, obj):
        # Leitura permitida para qualquer um
        if request.method in permissions.SAFE_METHODS:
            return True

        # Escrita apenas para o dono
        return obj.owner.user == request.user
```

## Filtragem e Ordenação

### Query Parameters

```python
from django_filters import rest_framework as filters

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.filter(is_deleted=False)
    serializer_class = ExpenseSerializer
    filter_backends = [filters.DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['category', 'payed', 'account']
    ordering_fields = ['date', 'value', 'created_at']
    search_fields = ['description', 'merchant']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filtro customizado por data
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset
```

**Exemplos de uso**:
```bash
# Filtro por categoria
GET /api/v1/expenses/?category=food

# Filtro por múltiplos campos
GET /api/v1/expenses/?category=food&payed=true

# Ordenação
GET /api/v1/expenses/?ordering=-date

# Busca
GET /api/v1/expenses/?search=mercado

# Filtro por data
GET /api/v1/expenses/?date_from=2024-01-01&date_to=2024-01-31

# Combinação
GET /api/v1/expenses/?category=food&ordering=-value&search=pizza
```

## Paginação

### Paginação Padrão

Configurada globalmente em `settings.py`:

```python
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}
```

**Uso**:
```bash
GET /api/v1/expenses/?page=1
GET /api/v1/expenses/?page=2
```

**Response**:
```json
{
  "count": 150,
  "next": "http://localhost:8002/api/v1/expenses/?page=2",
  "previous": null,
  "results": [...]
}
```

### Paginação Customizada

```python
from rest_framework.pagination import PageNumberPagination

class LargeResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000

class ExpenseViewSet(viewsets.ModelViewSet):
    pagination_class = LargeResultsSetPagination
    # ...
```

**Uso**:
```bash
GET /api/v1/expenses/?page=1&page_size=20
```

## Otimizações de Performance

### Select Related e Prefetch Related

```python
class ExpenseViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # select_related para ForeignKeys (JOINs)
        # prefetch_related para ManyToManyFields e reverse ForeignKeys
        return Expense.objects.filter(
            is_deleted=False
        ).select_related(
            'account',
            'account__owner',
            'member'
        ).prefetch_related(
            'related_transfer'
        )
```

**select_related**: Usa JOINs SQL, carrega tudo em uma query.
**prefetch_related**: Usa queries separadas, une no Python.

### Aggregations no Banco

```python
from django.db.models import Sum, Avg, Count, Max, Min

class ExpenseSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Aggregations executadas no banco
        summary = Expense.objects.filter(
            member__user=request.user,
            is_deleted=False,
            payed=True
        ).aggregate(
            total=Sum('value'),
            average=Avg('value'),
            count=Count('id'),
            max_value=Max('value'),
            min_value=Min('value')
        )

        return Response(summary)
```

### Annotate para Campos Calculados

```python
from django.db.models import Count, Sum

class AccountViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Account.objects.filter(
            is_deleted=False
        ).annotate(
            expenses_count=Count('expense'),
            revenues_count=Count('revenue'),
            total_expenses=Sum('expense__value')
        )
```

## Tratamento de Erros

### Erros Automáticos do DRF

DRF trata automaticamente:
- **400 Bad Request**: Validação falhou
- **401 Unauthorized**: Token inválido/ausente
- **403 Forbidden**: Sem permissão
- **404 Not Found**: Objeto não existe
- **405 Method Not Allowed**: Método HTTP não permitido

### Erros Customizados

```python
from rest_framework.exceptions import ValidationError, NotFound

class TransferViewSet(viewsets.ModelViewSet):
    def perform_create(self, serializer):
        origin = serializer.validated_data['origin_account']
        value = serializer.validated_data['value']
        fee = serializer.validated_data.get('fee', 0)

        if origin.current_balance < (value + fee):
            raise ValidationError({
                'value': f'Saldo insuficiente. Disponível: R$ {origin.current_balance}'
            })

        serializer.save()

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        transfer = self.get_object()

        if not transfer.transfered:
            raise ValidationError('Transferência não foi efetivada')

        # Lógica de cancelamento
        # ...

        return Response({'status': 'cancelled'})
```

### Exception Handler Global

```python
# app/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    # Chama handler padrão do DRF
    response = exception_handler(exc, context)

    if response is not None:
        # Customiza formato de erro
        response.data = {
            'error': True,
            'message': str(exc),
            'details': response.data
        }

    return response
```

**Registrar em settings.py**:
```python
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'app.exceptions.custom_exception_handler'
}
```

## Transações

### Atomic Transactions

```python
from django.db import transaction

class TransferViewSet(viewsets.ModelViewSet):
    @transaction.atomic
    def perform_create(self, serializer):
        """
        Cria transferência e despesa/receita relacionadas.
        Se qualquer operação falhar, todas são revertidas.
        """
        transfer = serializer.save()

        # Cria despesa na origem
        Expense.objects.create(
            description=f"Transferência: {transfer.description}",
            value=transfer.value + transfer.fee,
            account=transfer.origin_account,
            date=transfer.date,
            horary=transfer.horary,
            payed=transfer.transfered,
            related_transfer=transfer
        )

        # Cria receita no destino
        Revenue.objects.create(
            description=f"Transferência: {transfer.description}",
            value=transfer.value,
            account=transfer.destiny_account,
            date=transfer.date,
            horary=transfer.horary,
            received=transfer.transfered,
            related_transfer=transfer
        )
```

## Logging e Auditoria

### Log de Atividades

```python
def log_activity(request, action, model_name, object_id, description):
    """Helper para registrar atividades."""
    ActivityLog.log_action(
        user=request.user,
        action=action,
        description=description,
        model_name=model_name,
        object_id=object_id,
        ip_address=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')
    )

class PasswordDetailView(generics.RetrieveUpdateDestroyAPIView):
    def perform_update(self, serializer):
        password = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            'update',
            'Password',
            password.id,
            f'Atualizou senha: {password.title}'
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()
        log_activity(
            self.request,
            'delete',
            'Password',
            instance.id,
            f'Deletou senha: {instance.title}'
        )
```

### Extração de IP

```python
def get_client_ip(request):
    """Extrai IP do cliente, considerando proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '')
    return ip
```

## Streaming de Respostas (SSE)

Para streaming de respostas em tempo real (AI Assistant):

```python
from django.http import StreamingHttpResponse
import json
import time

class AIStreamingQueryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = request.data.get('question')

        response = StreamingHttpResponse(
            self._stream_response(question, request.user),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'

        return response

    def _stream_response(self, question, user):
        """Generator que emite eventos SSE."""
        # Evento: início
        yield self._format_sse('message_start', {})

        # Simula streaming de resposta
        answer = "Resposta da IA..."
        words = answer.split()

        for i in range(0, len(words), 5):
            chunk = ' '.join(words[i:i+5])
            yield self._format_sse('content_chunk', {'text': chunk})
            time.sleep(0.05)

        # Evento: fim
        yield self._format_sse('message_end', {'session_id': 'abc123'})

    def _format_sse(self, event_type, data):
        """Formata dados como Server-Sent Event."""
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
```

## Boas Práticas

### 1. Use Generic Views Quando Possível

Evite reescrever lógica que já existe nas generic views.

### 2. Sempre Filtre por is_deleted

```python
queryset = Model.objects.filter(is_deleted=False)
```

### 3. Filtre por Usuário

```python
def get_queryset(self):
    return Model.objects.filter(
        owner__user=self.request.user,
        is_deleted=False
    )
```

### 4. Use select_related e prefetch_related

Evite N+1 queries.

### 5. Adicione Usuários de Auditoria

```python
def perform_create(self, serializer):
    serializer.save(
        created_by=self.request.user,
        updated_by=self.request.user
    )

def perform_update(self, serializer):
    serializer.save(updated_by=self.request.user)
```

### 6. Soft Delete

Nunca delete fisicamente, apenas marque como deletado.

### 7. Use Transactions para Operações Múltiplas

```python
@transaction.atomic
def perform_create(self, serializer):
    # múltiplas operações
```

### 8. Documente Custom Actions

```python
@action(detail=True, methods=['post'])
def custom_action(self, request, pk=None):
    """
    POST /api/v1/resource/{id}/custom_action/

    Descrição detalhada do que faz.
    """
```

### 9. Valide Permissões em Actions

```python
@action(detail=True, methods=['post'])
def reveal(self, request, pk=None):
    obj = self.get_object()  # Já valida permissão
    # ...
```

### 10. Retorne Status Codes Apropriados

```python
return Response(data, status=status.HTTP_201_CREATED)
return Response(error, status=status.HTTP_400_BAD_REQUEST)
return Response(error, status=status.HTTP_404_NOT_FOUND)
```

## Próximos Passos

- [Middleware e Signals](./middleware-signals.md) - Interceptadores e eventos
- [Criptografia](./criptografia.md) - Sistema de criptografia Fernet
- [Comandos Management](./comandos-management.md) - Comandos customizados
