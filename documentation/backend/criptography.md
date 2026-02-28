# Sistema de Criptografia

## Visão Geral

O MindLedger utiliza criptografia simétrica **Fernet** (baseada em AES-128) para proteger dados sensíveis em repouso no banco de dados. Este documento explica como o sistema funciona, como usar e quais precauções tomar.

## Fernet: O Que É?

**Fernet** é um esquema de criptografia simétrica autenticada fornecido pela biblioteca `cryptography` do Python.

**Características**:
- **Simétrico**: Mesma chave para criptografar e descriptografar
- **Autenticado**: Garante que dados não foram alterados (HMAC)
- **Baseado em AES**: Usa AES-128-CBC + HMAC-SHA256
- **Timestamps**: Inclui timestamp para expiração opcional
- **Seguro**: Implementação auditada e amplamente usada

**Formato da chave**: 44 caracteres base64 (256 bits)

```python
# Exemplo de chave Fernet
"xN8fK9pL2mQ4rT6wY8zA1bC3dE5fG7hJ9kM0nP2qR4s="
```

## Implementação no MindLedger

### Módulo de Criptografia

**Arquivo**: `/home/tarcisio/Development/MindLedger/api/app/encryption.py`

```python
import os
from cryptography.fernet import Fernet
from django.core.exceptions import ValidationError


class FieldEncryption:
    """
    Classe para criptografar/descriptografar campos sensíveis do banco.
    """

    @staticmethod
    def get_encryption_key():
        """
        Obtém a chave de criptografia das variáveis de ambiente.
        """
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            raise ValidationError(
                "ENCRYPTION_KEY não encontrada nas variáveis de ambiente"
            )
        return encryption_key.encode()

    @staticmethod
    def encrypt_data(data):
        """
        Criptografa dados sensíveis.

        Parameters
        ----------
        data : str
            Dados a serem criptografados

        Returns
        -------
        str
            Dados criptografados em string base64
        """
        if not data:
            return data

        try:
            key = FieldEncryption.get_encryption_key()
            fernet = Fernet(key)
            encrypted_data = fernet.encrypt(str(data).encode())
            return encrypted_data.decode()
        except Exception as e:
            raise ValidationError(f"Erro ao criptografar dados: {str(e)}")

    @staticmethod
    def decrypt_data(encrypted_data):
        """
        Descriptografa dados sensíveis.

        Parameters
        ----------
        encrypted_data : str
            Dados criptografados em string base64

        Returns
        -------
        str
            Dados descriptografados
        """
        if not encrypted_data:
            return encrypted_data

        try:
            key = FieldEncryption.get_encryption_key()
            fernet = Fernet(key)
            decrypted_data = fernet.decrypt(encrypted_data.encode())
            return decrypted_data.decode()
        except Exception as e:
            raise ValidationError(f"Erro ao descriptografar dados: {str(e)}")

    @staticmethod
    def generate_key():
        """
        Gera uma nova chave de criptografia.
        Use esta função apenas para gerar a chave inicial.

        Returns
        -------
        str
            Chave de criptografia em base64
        """
        return Fernet.generate_key().decode()
```

### Geração de Chave

**Para gerar uma nova chave**:

```bash
# Via Python
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Ou via Django shell
python manage.py shell
>>> from app.encryption import FieldEncryption
>>> FieldEncryption.generate_key()
'xN8fK9pL2mQ4rT6wY8zA1bC3dE5fG7hJ9kM0nP2qR4s='
```

**Adicionar ao .env**:
```bash
ENCRYPTION_KEY=xN8fK9pL2mQ4rT6wY8zA1bC3dE5fG7hJ9kM0nP2qR4s=
```

## Uso em Modelos

### Padrão de Campo Criptografado

Campos criptografados seguem um padrão consistente:

1. **Campo privado** com prefixo `_`: armazena dado criptografado
2. **Property getter**: descriptografa ao acessar
3. **Property setter**: criptografa ao atribuir

### Exemplo: CreditCard

```python
from django.db import models
from app.encryption import FieldEncryption

class CreditCard(BaseModel):
    name = models.CharField(max_length=200)

    # Campo criptografado para CVV
    _security_code = models.TextField(
        verbose_name="Código de Segurança (Criptografado)",
        help_text="Campo criptografado para armazenar o CVV"
    )

    # Campo criptografado para número do cartão
    _card_number = models.TextField(
        verbose_name="Número do Cartão (Criptografado)",
        null=True,
        blank=True,
        help_text="Campo criptografado"
    )

    # Property para CVV
    @property
    def security_code(self):
        """
        Descriptografa o CVV ao acessá-lo.
        """
        try:
            return FieldEncryption.decrypt_data(self._security_code)
        except ValidationError:
            return None

    @security_code.setter
    def security_code(self, value):
        """
        Criptografa o CVV antes de salvá-lo.

        Validação: 3 ou 4 dígitos numéricos.
        """
        if value is not None:
            # Validação
            if not str(value).isdigit() or len(str(value)) not in [3, 4]:
                raise ValidationError(
                    "CVV deve conter 3 ou 4 dígitos numéricos"
                )
            self._security_code = FieldEncryption.encrypt_data(str(value))
        else:
            self._security_code = None

    # Property para número do cartão
    @property
    def card_number(self):
        """Descriptografa o número do cartão."""
        if self._card_number:
            try:
                return FieldEncryption.decrypt_data(self._card_number)
            except Exception:
                return None
        return None

    @property
    def card_number_masked(self):
        """Retorna número mascarado (****1234)."""
        if self._card_number:
            try:
                full_number = FieldEncryption.decrypt_data(self._card_number)
                if full_number and len(full_number) >= 4:
                    return '*' * (len(full_number) - 4) + full_number[-4:]
                return full_number if full_number else "****"
            except Exception:
                return "****"
        return "****"

    @card_number.setter
    def card_number(self, value):
        """Criptografa o número do cartão."""
        if value:
            self._card_number = FieldEncryption.encrypt_data(str(value))
        else:
            self._card_number = None
```

### Exemplo: Password (Módulo Security)

```python
class Password(BaseModel):
    """Armazenamento seguro de senhas."""

    title = models.CharField(max_length=200)
    site = models.URLField(max_length=500, blank=True, null=True)
    username = models.CharField(max_length=200)

    # Senha criptografada
    _password = models.TextField(verbose_name="Senha (Criptografada)")

    category = models.CharField(max_length=100, choices=PASSWORD_CATEGORIES)
    notes = models.TextField(blank=True, null=True)
    owner = models.ForeignKey('members.Member', on_delete=models.PROTECT)

    @property
    def password(self):
        """Descriptografa a senha."""
        if self._password:
            try:
                return FieldEncryption.decrypt_data(self._password)
            except Exception:
                return None
        return None

    @password.setter
    def password(self, value):
        """Criptografa a senha."""
        if value:
            self._password = FieldEncryption.encrypt_data(str(value))
        else:
            self._password = None
```

### Exemplo: Account

```python
class Account(BaseModel):
    """Conta bancária com número criptografado."""

    account_name = models.CharField(max_length=200)

    # Número da conta criptografado
    _account_number = models.TextField(null=True, blank=True)

    @property
    def account_number(self):
        """Descriptografa o número da conta."""
        if self._account_number:
            try:
                return FieldEncryption.decrypt_data(self._account_number)
            except Exception:
                return None
        return None

    @property
    def account_number_masked(self):
        """Retorna número mascarado (****1234)."""
        if self._account_number:
            try:
                full_number = FieldEncryption.decrypt_data(self._account_number)
                if full_number and len(full_number) >= 4:
                    return '*' * (len(full_number) - 4) + full_number[-4:]
                return full_number
            except Exception:
                return None
        return None

    @account_number.setter
    def account_number(self, value):
        """Criptografa o número da conta."""
        if value:
            self._account_number = FieldEncryption.encrypt_data(str(value))
        else:
            self._account_number = None
```

## Uso em Serializers

Serializers devem expor apenas a versão mascarada para leitura e aceitar o valor completo apenas para escrita.

```python
class CreditCardSerializer(serializers.ModelSerializer):
    # Campo mascarado (read-only)
    card_number_masked = serializers.ReadOnlyField()
    security_code_masked = serializers.SerializerMethodField()

    # Campo completo (write-only)
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
            'id', 'name', 'flag',
            'card_number', 'card_number_masked',  # Ambos
            'security_code', 'security_code_masked',  # Ambos
            'credit_limit', 'is_active'
        ]

    def get_security_code_masked(self, obj):
        """Retorna CVV mascarado (***) ou None."""
        if obj.security_code:
            return '***'
        return None

    def create(self, validated_data):
        """Cria cartão e criptografa campos sensíveis."""
        card_number = validated_data.pop('card_number', None)
        security_code = validated_data.pop('security_code', None)

        instance = super().create(validated_data)

        # Properties criptografam automaticamente
        if card_number:
            instance.card_number = card_number
        if security_code:
            instance.security_code = security_code

        instance.save()
        return instance

    def update(self, instance, validated_data):
        """Atualiza cartão e re-criptografa se necessário."""
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

## Campos Criptografados no MindLedger

### Módulo Financeiro

**Account**:
- `_account_number`: Número da conta

**CreditCard**:
- `_card_number`: Número do cartão
- `_security_code`: CVV

### Módulo Security

**Password**:
- `_password`: Senha armazenada

**StoredCreditCard**:
- `_card_number`: Número do cartão
- `_security_code`: CVV

**StoredBankAccount**:
- `_account_number`: Número da conta
- `_password`: Senha bancária
- `_digital_password`: Senha digital/token

**Archive**:
- `_encrypted_text`: Conteúdo de texto confidencial

## Formato dos Dados Criptografados

**Dado original**:
```
"1234567890123456"
```

**Dado criptografado (Fernet)**:
```
"gAAAAABjkX9Z2..."
```

**Características**:
- Prefixo `gAAAAA` indica versão Fernet
- Tamanho variável (depende do tamanho do dado original)
- Base64 encoded
- Inclui timestamp e HMAC

## Segurança

### Gerenciamento de Chaves

**CRÍTICO**: A chave de criptografia é o ponto mais sensível do sistema.

**Boas práticas**:
1. **Nunca comite a chave no Git**
2. **Use variáveis de ambiente** (`.env` com `.gitignore`)
3. **Backup seguro**: Armazene backup da chave em local seguro (gerenciador de senhas, cofre)
4. **Rotação**: Se precisar trocar a chave, todos os dados devem ser re-criptografados
5. **Produção**: Use serviços de gerenciamento de secrets (AWS Secrets Manager, Azure Key Vault, etc.)

### Proteções Implementadas

1. **Criptografia em repouso**: Dados sensíveis criptografados no banco
2. **HTTPS obrigatório**: Dados em trânsito também protegidos
3. **HttpOnly cookies**: Tokens JWT não acessíveis via JavaScript
4. **Mascaramento**: APIs nunca retornam dados sensíveis completos (apenas mascarados)
5. **Auditoria**: Logs de quem acessa dados sensíveis

### Limitações

**O que Fernet protege**:
- ✅ Dados em repouso (banco de dados)
- ✅ Backups de banco de dados
- ✅ Acesso direto ao banco (sem chave, dados ilegíveis)

**O que Fernet NÃO protege**:
- ❌ Dados em memória da aplicação
- ❌ Dados em logs (se logados descriptografados)
- ❌ Acesso via API autenticada (usuário autenticado vê dados descriptografados)
- ❌ SQL injection (atacante pode roubar dados criptografados, mas não descriptografar sem chave)

## Rotação de Chave

**Cenário**: Necessidade de trocar a ENCRYPTION_KEY (chave comprometida, política de segurança, etc.)

**Processo**:

1. **Gerar nova chave**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

2. **Script de re-criptografia**:
```python
# scripts/rotate_encryption_key.py
import os
from cryptography.fernet import Fernet
from app.encryption import FieldEncryption

OLD_KEY = os.getenv('OLD_ENCRYPTION_KEY').encode()
NEW_KEY = os.getenv('NEW_ENCRYPTION_KEY').encode()

old_fernet = Fernet(OLD_KEY)
new_fernet = Fernet(NEW_KEY)

def rotate_model_field(model, field_name):
    """Re-criptografa um campo de todos os registros."""
    for obj in model.objects.all():
        encrypted_value = getattr(obj, field_name)
        if encrypted_value:
            # Descriptografar com chave antiga
            decrypted = old_fernet.decrypt(encrypted_value.encode()).decode()
            # Re-criptografar com chave nova
            new_encrypted = new_fernet.encrypt(decrypted.encode()).decode()
            # Salvar
            setattr(obj, field_name, new_encrypted)
            obj.save(update_fields=[field_name])

# Rotacionar todos os campos criptografados
from accounts.models import Account
from credit_cards.models import CreditCard
from security.models import Password, StoredCreditCard, StoredBankAccount

rotate_model_field(Account, '_account_number')
rotate_model_field(CreditCard, '_card_number')
rotate_model_field(CreditCard, '_security_code')
rotate_model_field(Password, '_password')
# ... etc
```

3. **Executar rotação**:
```bash
export OLD_ENCRYPTION_KEY="chave_antiga"
export NEW_ENCRYPTION_KEY="chave_nova"
python scripts/rotate_encryption_key.py
```

4. **Atualizar .env**:
```bash
ENCRYPTION_KEY=chave_nova
```

5. **Reiniciar aplicação**

**IMPORTANTE**: Faça backup completo do banco de dados antes de rotacionar chaves!

## Testes

### Teste de Criptografia/Descriptografia

```python
# tests/test_encryption.py
from django.test import TestCase
from app.encryption import FieldEncryption

class FieldEncryptionTestCase(TestCase):
    def test_encrypt_decrypt(self):
        """Testa criptografia e descriptografia."""
        original = "teste123"
        encrypted = FieldEncryption.encrypt_data(original)
        decrypted = FieldEncryption.decrypt_data(encrypted)

        self.assertNotEqual(original, encrypted)
        self.assertEqual(original, decrypted)

    def test_empty_data(self):
        """Testa que dados vazios não são criptografados."""
        self.assertIsNone(FieldEncryption.encrypt_data(None))
        self.assertEqual("", FieldEncryption.encrypt_data(""))

    def test_different_encryptions(self):
        """Testa que mesmos dados geram criptografias diferentes."""
        data = "teste123"
        encrypted1 = FieldEncryption.encrypt_data(data)
        encrypted2 = FieldEncryption.encrypt_data(data)

        # Fernet inclui timestamp, então criptografias são diferentes
        self.assertNotEqual(encrypted1, encrypted2)

        # Mas ambos descriptografam para o mesmo valor
        self.assertEqual(
            FieldEncryption.decrypt_data(encrypted1),
            FieldEncryption.decrypt_data(encrypted2)
        )
```

### Teste de Modelo com Campo Criptografado

```python
from django.test import TestCase
from credit_cards.models import CreditCard

class CreditCardEncryptionTestCase(TestCase):
    def test_cvv_encryption(self):
        """Testa criptografia de CVV."""
        card = CreditCard.objects.create(
            name="Teste",
            flag="VSA",
            # ... outros campos
        )

        # Atribuir CVV (criptografa automaticamente)
        card.security_code = "123"
        card.save()

        # Valor armazenado é criptografado
        self.assertNotEqual(card._security_code, "123")
        self.assertTrue(card._security_code.startswith("gAAAAA"))

        # Property descriptografa
        self.assertEqual(card.security_code, "123")

    def test_card_number_masking(self):
        """Testa mascaramento de número do cartão."""
        card = CreditCard.objects.create(name="Teste", flag="VSA")
        card.card_number = "1234567890123456"
        card.save()

        # Número mascarado
        self.assertEqual(card.card_number_masked, "************3456")

        # Número completo (descriptografado)
        self.assertEqual(card.card_number, "1234567890123456")
```

## Performance

### Impacto da Criptografia

**Operações**:
- **Criptografar**: ~0.001s por campo
- **Descriptografar**: ~0.001s por campo
- **Negligível** para operações individuais
- **Pode acumular** em queries que retornam muitos registros

### Otimizações

1. **Não descriptografar se não precisa**:
```python
# ❌ RUIM: Descriptografa mesmo que não use
all_passwords = Password.objects.all()
for pwd in all_passwords:
    print(pwd.title)  # Não precisa de password descriptografada

# ✅ BOM: Não acessa campo criptografado
all_passwords = Password.objects.all().values('id', 'title', 'username')
```

2. **Cache em memória** (se apropriado):
```python
class CreditCard(BaseModel):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cached_security_code = None

    @property
    def security_code(self):
        if self._cached_security_code is None:
            self._cached_security_code = FieldEncryption.decrypt_data(
                self._security_code
            )
        return self._cached_security_code
```

3. **Bulk operations**: Descriptografar em lote quando possível

## Troubleshooting

### Erro: ENCRYPTION_KEY não encontrada

```python
ValidationError: ENCRYPTION_KEY não encontrada nas variáveis de ambiente
```

**Solução**:
1. Verificar se `.env` existe
2. Verificar se `ENCRYPTION_KEY` está definida
3. Verificar se aplicação está carregando `.env` (`load_dotenv()`)

### Erro ao descriptografar

```python
ValidationError: Erro ao descriptografar dados: ...
```

**Causas possíveis**:
1. **Chave errada**: ENCRYPTION_KEY foi trocada depois de criptografar dados
2. **Dados corrompidos**: Campo foi editado manualmente no banco
3. **Formato inválido**: Dados não são Fernet válido

**Solução**:
1. Verificar se ENCRYPTION_KEY é a mesma usada para criptografar
2. Restaurar backup se dados corrompidos
3. Re-criptografar dados se chave foi trocada

### Dados legíveis no banco

**Problema**: Ao consultar diretamente o banco, dados sensíveis estão legíveis.

**Causa**: Campo não está sendo criptografado.

**Verificar**:
1. Campo usa prefixo `_` (ex: `_password`, não `password`)
2. Property setter está chamando `FieldEncryption.encrypt_data()`
3. Serializer está usando property, não campo direto

## Checklist de Implementação

Ao adicionar novo campo criptografado:

- [ ] Campo no modelo usa prefixo `_` (ex: `_password`)
- [ ] Campo é `TextField` ou `CharField` com tamanho adequado
- [ ] Property getter descriptografa o valor
- [ ] Property setter criptografa o valor
- [ ] Property mascarado para exibição (ex: `password_masked`)
- [ ] Serializer expõe campo mascarado (read-only)
- [ ] Serializer aceita campo completo (write-only)
- [ ] Documentação atualizada com novo campo
- [ ] Testes cobrem criptografia/descriptografia
- [ ] Migration criada e aplicada

## Próximos Passos

- [Comandos Management](./comandos-management.md) - Comandos customizados de gerenciamento
