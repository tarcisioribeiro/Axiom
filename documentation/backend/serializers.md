# Serializers Django REST Framework

## Visão Geral

Os serializers do Django REST Framework (DRF) são responsáveis por:
- Validar dados de entrada (deserialização)
- Transformar modelos em JSON (serialização)
- Mascarar campos sensíveis
- Adicionar campos calculados
- Implementar lógica de negócio na validação

## Padrões de Serialização

### Serializer Básico

Exemplo de um serializer simples que expõe todos os campos do modelo:

```python
# accounts/serializers.py
from rest_framework import serializers
from accounts.models import Account

class AccountSerializer(serializers.ModelSerializer):
    # Campos calculados (read-only)
    account_number_masked = serializers.ReadOnlyField()

    # Aliases de campos
    balance = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        source='current_balance',
        required=False
    )
    institution = serializers.CharField(
        source='institution_name',
        required=True
    )

    # Campo sensível (write-only)
    account_number = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True
    )

    class Meta:
        model = Account
        fields = [
            'id',
            'uuid',
            'account_name',
            'account_type',
            'institution',
            'account_number',  # write_only
            'account_number_masked',  # read_only
            'balance',
            'minimum_balance',
            'opening_date',
            'description',
            'owner',
            'is_active',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by'
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def create(self, validated_data):
        """Cria conta e criptografa número."""
        account_number = validated_data.pop('account_number', None)
        instance = super().create(validated_data)
        if account_number:
            instance.account_number = account_number  # Setter criptografa
            instance.save()
        return instance

    def update(self, instance, validated_data):
        """Atualiza conta e re-criptografa número se fornecido."""
        account_number = validated_data.pop('account_number', None)
        instance = super().update(instance, validated_data)
        if account_number:
            instance.account_number = account_number
            instance.save()
        return instance
```

### Padrões de Nomenclatura

**Campos de Leitura (Read-Only)**:
- Sufixo `_display` para choices: `nationality_display`
- Sufixo `_masked` para campos mascarados: `card_number_masked`
- Sufixo `_name` para ForeignKeys: `owner_name`
- Sufixo `_count` para contagens: `books_count`

**Campos de Escrita (Write-Only)**:
- Campos sensíveis: `password`, `security_code`, `account_number`
- Nunca retornar em GET

## Serializers com Campos Relacionados

### SerializerMethodField

Usado para campos calculados complexos:

```python
# library/serializers.py
class BookSerializer(serializers.ModelSerializer):
    # Campos relacionados
    authors_names = serializers.SerializerMethodField()
    publisher_name = serializers.CharField(source='publisher.name', read_only=True)

    # Campos calculados
    has_summary = serializers.SerializerMethodField()
    total_pages_read = serializers.SerializerMethodField()
    reading_progress = serializers.SerializerMethodField()

    # Displays de choices
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    read_status_display = serializers.CharField(source='get_read_status_display', read_only=True)

    class Meta:
        model = Book
        fields = [
            'id', 'uuid', 'title', 'authors_names', 'pages',
            'publisher', 'publisher_name', 'language', 'language_display',
            'genre', 'genre_display', 'literarytype',
            'publish_date', 'synopsis', 'edition', 'rating',
            'read_status', 'read_status_display',
            'has_summary', 'total_pages_read', 'reading_progress',
            'owner', 'created_at', 'updated_at'
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at']

    def get_authors_names(self, obj):
        """Retorna lista de nomes de autores."""
        return [author.name for author in obj.authors.all()]

    def get_has_summary(self, obj):
        """Verifica se livro tem resumo."""
        return hasattr(obj, 'summary')

    def get_total_pages_read(self, obj):
        """Soma total de páginas lidas."""
        total = sum(r.pages_read for r in obj.readings.filter(deleted_at__isnull=True))
        return total

    def get_reading_progress(self, obj):
        """Calcula progresso de leitura em porcentagem."""
        if obj.pages > 0:
            total_read = self.get_total_pages_read(obj)
            return round((total_read / obj.pages) * 100, 1)
        return 0.0
```

**Nota de Performance**: `SerializerMethodField` executa uma query por objeto. Use `prefetch_related` na view para otimizar.

### Nested Serializers

Para representações aninhadas de relacionamentos:

```python
# Serializer simples para nested
class AuthorSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name', 'nationality']

# Serializer com nested
class BookDetailSerializer(serializers.ModelSerializer):
    authors = AuthorSimpleSerializer(many=True, read_only=True)
    publisher = PublisherSimpleSerializer(read_only=True)

    class Meta:
        model = Book
        fields = ['id', 'title', 'authors', 'publisher', 'pages', 'synopsis']
```

**Cuidado**: Nested serializers podem causar N+1 queries. Use `select_related` e `prefetch_related`.

## Separação de Serializers: Leitura vs Escrita

Para casos onde a representação de leitura difere da escrita:

```python
# library/serializers.py

# Serializer para visualização (GET)
class BookSerializer(serializers.ModelSerializer):
    authors_names = serializers.SerializerMethodField()
    publisher_name = serializers.CharField(source='publisher.name', read_only=True)
    # ... campos calculados

    class Meta:
        model = Book
        fields = [...]

    def get_authors_names(self, obj):
        return [author.name for author in obj.authors.all()]


# Serializer para criação/atualização (POST/PUT/PATCH)
class BookCreateUpdateSerializer(serializers.ModelSerializer):
    authors = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Author.objects.filter(deleted_at__isnull=True)
    )

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'authors', 'pages', 'publisher',
            'language', 'genre', 'literarytype', 'publish_date',
            'synopsis', 'edition', 'rating', 'read_status', 'owner'
        ]
```

**Uso na View**:
```python
class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.filter(is_deleted=False)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BookCreateUpdateSerializer
        return BookSerializer
```

## Validação Customizada

### Validação a Nível de Campo

```python
class PasswordSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        max_length=128,
        style={'input_type': 'password'}
    )

    def validate_password(self, value):
        """
        Valida que a senha tem pelo menos:
        - 1 letra maiúscula
        - 1 letra minúscula
        - 1 número
        """
        if not any(c.isupper() for c in value):
            raise serializers.ValidationError(
                "Senha deve conter pelo menos uma letra maiúscula"
            )
        if not any(c.islower() for c in value):
            raise serializers.ValidationError(
                "Senha deve conter pelo menos uma letra minúscula"
            )
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError(
                "Senha deve conter pelo menos um número"
            )
        return value

    class Meta:
        model = Password
        fields = ['id', 'title', 'site', 'username', 'password', 'category', 'notes']
```

### Validação a Nível de Objeto

```python
class ReadingCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reading
        fields = ['id', 'book', 'reading_date', 'reading_time', 'pages_read', 'notes', 'owner']

    def validate(self, data):
        """Validação que envolve múltiplos campos."""
        instance = self.instance
        if instance:
            temp_instance = Reading(**data)
            temp_instance.pk = instance.pk
        else:
            temp_instance = Reading(**data)

        # Chama método clean() do modelo
        temp_instance.clean()
        return data
```

### Validação com Contexto

```python
class TransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transfer
        fields = ['id', 'description', 'value', 'fee', 'date', 'horary',
                  'origin_account', 'destiny_account', 'transfered', 'category']

    def validate(self, data):
        """Valida que origem e destino são diferentes."""
        origin = data.get('origin_account')
        destiny = data.get('destiny_account')

        if origin == destiny:
            raise serializers.ValidationError(
                "Conta de origem e destino não podem ser iguais"
            )

        # Valida que origem tem saldo suficiente
        if origin and data.get('value'):
            total = data['value'] + data.get('fee', 0)
            if origin.current_balance < total:
                raise serializers.ValidationError(
                    f"Saldo insuficiente. Disponível: R$ {origin.current_balance}"
                )

        return data
```

## Mascaramento de Dados Sensíveis

### Padrão de Campo Mascarado

```python
class CreditCardSerializer(serializers.ModelSerializer):
    # Campo mascarado (somente leitura)
    card_number_masked = serializers.ReadOnlyField()
    security_code_masked = serializers.SerializerMethodField()

    # Campo completo (somente escrita)
    card_number = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True
    )
    security_code = serializers.CharField(
        write_only=True,
        min_length=3,
        max_length=4
    )

    class Meta:
        model = CreditCard
        fields = [
            'id', 'name', 'flag', 'validation_date',
            'card_number', 'card_number_masked',  # Ambos
            'security_code', 'security_code_masked',  # Ambos
            'credit_limit', 'max_limit', 'is_active'
        ]

    def get_security_code_masked(self, obj):
        """Retorna CVV mascarado (***) ou None."""
        if obj.security_code:
            return '***'
        return None

    def create(self, validated_data):
        card_number = validated_data.pop('card_number', None)
        security_code = validated_data.pop('security_code', None)

        instance = super().create(validated_data)

        if card_number:
            instance.card_number = card_number  # Property criptografa
        if security_code:
            instance.security_code = security_code  # Property criptografa

        instance.save()
        return instance

    def update(self, instance, validated_data):
        card_number = validated_data.pop('card_number', None)
        security_code = validated_data.pop('security_code', None)

        instance = super().update(instance, validated_data)

        if card_number:
            instance.card_number = card_number
        if security_code:
            instance.security_code = security_code

        instance.save()
        return instance
```

### Níveis de Mascaramento

1. **Completo**: `***` (CVV, senhas)
2. **Parcial**: `****1234` (cartões, contas)
3. **Ocultado**: Removido da resposta (não incluído em `fields`)

## Campos de Auditoria

Todos os serializers devem incluir campos de auditoria como read-only:

```python
class Meta:
    model = MyModel
    fields = [
        # ... campos do modelo
        'created_at',
        'updated_at',
        'created_by',
        'updated_by',
        'uuid'
    ]
    read_only_fields = ['uuid', 'created_at', 'updated_at', 'created_by', 'updated_by']
```

**Nunca** permitir edição de:
- `created_at`, `updated_at` (auto-gerenciados)
- `created_by`, `updated_by` (setados na view)
- `uuid` (gerado automaticamente)

## Serializers para Módulo de Segurança

### Password Serializer

```python
# security/serializers.py
class PasswordSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    # Senha mascarada
    password_masked = serializers.SerializerMethodField()

    # Senha completa (write-only)
    password = serializers.CharField(
        write_only=True,
        min_length=1,
        style={'input_type': 'password'}
    )

    class Meta:
        model = Password
        fields = [
            'id', 'uuid', 'title', 'site', 'username',
            'password', 'password_masked',  # Ambos
            'category', 'category_display', 'notes',
            'last_password_change', 'owner', 'owner_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['uuid', 'last_password_change', 'created_at', 'updated_at']

    def get_password_masked(self, obj):
        """Retorna senha mascarada."""
        if obj.password:
            return '********'
        return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        instance = super().create(validated_data)
        if password:
            instance.password = password  # Property criptografa
            instance.save()
        return instance

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password:
            instance.password = password
            instance.last_password_change = timezone.now()
            instance.save()
        return instance
```

### Endpoint para Revelar Senha

Para casos onde o frontend precisa mostrar a senha real (com confirmação de segurança):

```python
# security/views.py
from rest_framework.decorators import action

class PasswordViewSet(viewsets.ModelViewSet):
    # ... configuração padrão

    @action(detail=True, methods=['post'])
    def reveal(self, request, pk=None):
        """
        Revela a senha real. Requer confirmação adicional.
        POST /api/v1/passwords/{id}/reveal/
        """
        password_obj = self.get_object()

        # Aqui você pode adicionar verificações de segurança extras
        # Por exemplo: verificar se passou X minutos desde último acesso,
        # pedir senha mestre, etc.

        return Response({
            'id': password_obj.id,
            'title': password_obj.title,
            'username': password_obj.username,
            'password': password_obj.password  # Retorna descriptografado
        })
```

## Serializers para IA Assistant

### Query Serializer

```python
# ai_assistant/serializers.py
class QuerySerializer(serializers.Serializer):
    """Serializer para consulta ao AI Assistant."""
    question = serializers.CharField(
        min_length=3,
        max_length=1000,
        help_text="Pergunta em linguagem natural"
    )
    top_k = serializers.IntegerField(
        default=10,
        min_value=1,
        max_value=50,
        required=False,
        help_text="Número de resultados relevantes"
    )
    session_id = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="ID da sessão para manter contexto"
    )

    def validate_question(self, value):
        """Valida que a pergunta não está vazia."""
        if not value.strip():
            raise serializers.ValidationError("Pergunta não pode estar vazia")
        return value.strip()


class QueryResponseSerializer(serializers.Serializer):
    """Serializer para resposta do AI Assistant."""
    answer = serializers.CharField(help_text="Resposta gerada pela IA")
    routing_decision = serializers.CharField(
        help_text="Decisão de roteamento (local/cloud)"
    )
    provider = serializers.CharField(help_text="Provedor usado (Groq)")
    cached = serializers.BooleanField(
        default=False,
        help_text="Se a resposta veio do cache"
    )
```

## Serializers Dinâmicos

### Serializer com Campos Dinâmicos

```python
class DynamicFieldsModelSerializer(serializers.ModelSerializer):
    """
    Serializer que permite especificar campos via query params.

    Uso:
    GET /api/v1/accounts/?fields=id,account_name,balance
    """
    def __init__(self, *args, **kwargs):
        # Captura fields do contexto
        fields = kwargs.pop('fields', None)

        super().__init__(*args, **kwargs)

        if fields is not None:
            # Remove campos não solicitados
            allowed = set(fields)
            existing = set(self.fields)
            for field_name in existing - allowed:
                self.fields.pop(field_name)


class AccountSerializer(DynamicFieldsModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'
```

**Uso na View**:
```python
class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.filter(is_deleted=False)
    serializer_class = AccountSerializer

    def get_serializer(self, *args, **kwargs):
        # Passa fields do query param para serializer
        fields = self.request.query_params.get('fields')
        if fields:
            kwargs['fields'] = fields.split(',')
        return super().get_serializer(*args, **kwargs)
```

## HyperlinkedModelSerializer

Para APIs RESTful com HATEOAS:

```python
class BookHyperlinkedSerializer(serializers.HyperlinkedModelSerializer):
    authors = serializers.HyperlinkedRelatedField(
        many=True,
        read_only=True,
        view_name='author-detail'
    )
    publisher = serializers.HyperlinkedRelatedField(
        read_only=True,
        view_name='publisher-detail'
    )

    class Meta:
        model = Book
        fields = ['url', 'id', 'title', 'authors', 'publisher', 'pages']
        extra_kwargs = {
            'url': {'view_name': 'book-detail', 'lookup_field': 'pk'}
        }
```

**Resposta**:
```json
{
  "url": "http://localhost:8002/api/v1/books/1/",
  "id": 1,
  "title": "Clean Code",
  "authors": [
    "http://localhost:8002/api/v1/authors/1/"
  ],
  "publisher": "http://localhost:8002/api/v1/publishers/1/",
  "pages": 464
}
```

## Boas Práticas

### 1. Sempre Use ModelSerializer

Evite `Serializer` puro quando possível. `ModelSerializer` reduz código e garante consistência.

### 2. Separe Leitura de Escrita

Se GET e POST/PUT têm estruturas muito diferentes, use serializers separados.

### 3. Use write_only para Campos Sensíveis

```python
password = serializers.CharField(write_only=True)
```

### 4. Use read_only para Campos Calculados

```python
total_amount = serializers.DecimalField(read_only=True)
```

### 5. Valide no Serializer, não na View

Mantenha lógica de validação no serializer, não na view.

### 6. Use source para Renomear Campos

```python
balance = serializers.DecimalField(source='current_balance')
```

### 7. Documente com help_text

```python
question = serializers.CharField(
    help_text="Pergunta em linguagem natural"
)
```

### 8. Prefira PrimaryKeyRelatedField para Escrita

```python
authors = serializers.PrimaryKeyRelatedField(
    many=True,
    queryset=Author.objects.filter(deleted_at__isnull=True)
)
```

### 9. Use SerializerMethodField com Cuidado

Pode causar N+1 queries. Sempre use `prefetch_related` na view.

### 10. Teste Validações

```python
# tests.py
def test_account_serializer_validation():
    data = {'account_name': 'Test', 'account_type': 'CC'}
    serializer = AccountSerializer(data=data)
    assert not serializer.is_valid()
    assert 'institution_name' in serializer.errors
```

## Tratamento de Erros de Validação

### Estrutura de Resposta de Erro

```json
{
  "field_name": [
    "Mensagem de erro 1",
    "Mensagem de erro 2"
  ],
  "non_field_errors": [
    "Erro geral não relacionado a um campo específico"
  ]
}
```

### Customizar Mensagens de Erro

```python
class AccountSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(
        max_length=200,
        error_messages={
            'required': 'Nome da conta é obrigatório',
            'max_length': 'Nome não pode exceder 200 caracteres'
        }
    )

    class Meta:
        model = Account
        fields = ['id', 'account_name', 'account_type']

    def validate_account_type(self, value):
        if value not in ['CC', 'CS', 'FG', 'VA']:
            raise serializers.ValidationError(
                "Tipo de conta inválido. Opções: CC, CS, FG, VA"
            )
        return value
```

## Próximos Passos

- [ViewSets e Views](./viewsets-views.md) - Lógica de API e endpoints
- [Middleware e Signals](./middleware-signals.md) - Interceptadores e eventos
- [Criptografia](./criptografia.md) - Sistema de criptografia Fernet
