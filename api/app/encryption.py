import os
import logging
import threading
from typing import Any, Callable, Optional, overload
from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ValidationError

logger = logging.getLogger('expenselit')

# Thread-local storage para cache de decriptacao
_decryption_cache = threading.local()


class EncryptionError(Exception):
    """Erro base para operacoes de criptografia."""
    pass


class DecryptionError(EncryptionError):
    """Erro ao descriptografar dados."""
    pass


def get_decryption_cache() -> dict:
    """Retorna o cache de decriptacao para a thread atual."""
    if not hasattr(_decryption_cache, 'cache'):
        _decryption_cache.cache = {}
    return _decryption_cache.cache


def clear_decryption_cache() -> None:
    """Limpa o cache de decriptacao da thread atual."""
    if hasattr(_decryption_cache, 'cache'):
        _decryption_cache.cache.clear()


class FieldEncryption:
    """
    Classe para criptografar/descriptografar campos sensiveis do banco.
    Usa Fernet (AES 128-bit CBC com HMAC).

    Inclui cache de decriptacao por request para evitar multiplas
    decriptacoes do mesmo valor durante um unico request.
    """
    @staticmethod
    def get_encryption_key():
        """
        Obtem a chave de criptografia das variaveis de ambiente.

        Returns:
            bytes: Chave de criptografia codificada

        Raises:
            ValidationError: Se ENCRYPTION_KEY nao estiver configurada
        """
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            raise ValidationError(
                "ENCRYPTION_KEY nao encontrada nas variaveis de ambiente"
            )
        return encryption_key.encode()

    @staticmethod
    def encrypt_data(data):
        """
        Criptografa dados sensiveis.

        Args:
            data (str): Dados a serem criptografados

        Returns:
            str: Dados criptografados em string base64

        Raises:
            ValidationError: Se ENCRYPTION_KEY nao estiver configurada
            EncryptionError: Se houver erro na criptografia
        """
        if not data:
            return data
        try:
            key = FieldEncryption.get_encryption_key()
            fernet = Fernet(key)
            encrypted_data = fernet.encrypt(str(data).encode())
            return encrypted_data.decode()
        except ValidationError:
            raise
        except ValueError as e:
            logger.error(f"Chave de criptografia invalida: {e}")
            raise EncryptionError("Chave de criptografia invalida")
        except TypeError as e:
            logger.error(f"Tipo de dado invalido para criptografia: {e}")
            raise EncryptionError("Tipo de dado invalido para criptografia")

    @staticmethod
    def decrypt_data(encrypted_data, use_cache=True):
        """
        Descriptografa dados sensiveis.

        Args:
            encrypted_data (str): Dados criptografados em string base64
            use_cache (bool): Se True, usa cache para evitar multiplas decriptacoes

        Returns:
            str: Dados descriptografados

        Raises:
            ValidationError: Se ENCRYPTION_KEY nao estiver configurada
            DecryptionError: Se houver erro na descriptografia
        """
        if not encrypted_data:
            return encrypted_data

        # Verificar cache primeiro
        if use_cache:
            cache = get_decryption_cache()
            if encrypted_data in cache:
                return cache[encrypted_data]

        try:
            key = FieldEncryption.get_encryption_key()
            fernet = Fernet(key)
            decrypted_data = fernet.decrypt(encrypted_data.encode())
            result = decrypted_data.decode()

            # Armazenar no cache
            if use_cache:
                cache[encrypted_data] = result

            return result
        except ValidationError:
            raise
        except InvalidToken:
            logger.warning("Token invalido ao descriptografar - dados corrompidos ou chave errada")
            raise DecryptionError("Dados criptografados invalidos ou chave incorreta")
        except ValueError as e:
            logger.error(f"Chave de criptografia invalida: {e}")
            raise DecryptionError("Chave de criptografia invalida")
        except TypeError as e:
            logger.error(f"Tipo de dado invalido para descriptografia: {e}")
            raise DecryptionError("Tipo de dado invalido para descriptografia")

    @staticmethod
    def generate_key():
        """
        Gera uma nova chave de criptografia.
        Use esta função apenas para gerar a chave inicial.
            Returns:
            str: Chave de criptografia em base64
        """
        return Fernet.generate_key().decode()



class EncryptedField:
    """
    Descriptor para campos criptografados seguindo a convenção de prefixo _.

    Substitui o padrão getter/setter @property repetido em múltiplos modelos.
    O campo de armazenamento Django (TextField com prefixo _) deve ser declarado
    separadamente no modelo.

    Parâmetros
    ----------
    storage_attr : str
        Nome do campo Django que armazena o valor criptografado (ex: '_password').
    validator : callable, opcional
        Função que recebe o valor (pós-preprocessamento) e levanta ValidationError
        se inválido.
    preprocessor : callable, opcional
        Função que transforma o valor antes de validar e criptografar
        (ex: normalização de número de cartão).

    Exemplo de uso::

        class MyModel(models.Model):
            _secret = models.TextField(null=True, blank=True)
            secret = EncryptedField('_secret')
    """

    def __init__(
        self,
        storage_attr: str,
        validator: Optional[Callable[[str], None]] = None,
        preprocessor: Optional[Callable[[Any], str]] = None,
    ) -> None:
        self.storage_attr = storage_attr
        self.validator = validator
        self.preprocessor = preprocessor
        self.public_name = ""

    def __set_name__(self, owner: type, name: str) -> None:
        self.public_name = name

    @overload
    def __get__(self, obj: None, objtype: Any) -> "EncryptedField": ...

    @overload
    def __get__(self, obj: Any, objtype: Any) -> Optional[str]: ...

    def __get__(self, obj: Any, objtype: Any = None) -> "EncryptedField | Optional[str]":
        if obj is None:
            return self
        raw: Optional[str] = getattr(obj, self.storage_attr)
        if raw:
            try:
                return FieldEncryption.decrypt_data(raw)
            except (DecryptionError, ValidationError):
                return None
        return None

    def __set__(self, obj: Any, value: Any) -> None:
        if value:
            v: str = self.preprocessor(value) if self.preprocessor else str(value)
            if self.validator is not None:
                self.validator(v)
            setattr(obj, self.storage_attr, FieldEncryption.encrypt_data(v))
        else:
            setattr(obj, self.storage_attr, None)


class MaskedEncryptedField:
    """
    Descriptor somente-leitura que retorna versão mascarada (****1234) de um
    campo criptografado.

    Parâmetros
    ----------
    storage_attr : str
        Nome do campo Django que armazena o valor criptografado.
    fallback : str, opcional
        Valor retornado quando o campo está vazio ou há erro de decriptação.
        Padrão: None. Use '****' para campos de cartão que nunca devem expor None.

    Exemplo de uso::

        class MyModel(models.Model):
            _card_number = models.TextField(null=True)
            card_number = EncryptedField('_card_number')
            card_number_masked = MaskedEncryptedField('_card_number', fallback='****')
    """

    def __init__(self, storage_attr: str, fallback: Optional[str] = None) -> None:
        self.storage_attr = storage_attr
        self.fallback = fallback
        self.public_name = ""

    def __set_name__(self, owner: type, name: str) -> None:
        self.public_name = name

    @overload
    def __get__(self, obj: None, objtype: Any) -> "MaskedEncryptedField": ...

    @overload
    def __get__(self, obj: Any, objtype: Any) -> Optional[str]: ...

    def __get__(self, obj: Any, objtype: Any = None) -> "MaskedEncryptedField | Optional[str]":
        if obj is None:
            return self
        raw: Optional[str] = getattr(obj, self.storage_attr)
        if raw:
            try:
                full = FieldEncryption.decrypt_data(raw)
                if full and len(full) >= 4:
                    return "*" * (len(full) - 4) + full[-4:]
                return full
            except (DecryptionError, ValidationError):
                return self.fallback
        return self.fallback

    def __set__(self, obj: Any, value: Any) -> None:
        raise AttributeError(
            f"'{type(obj).__name__}.{self.public_name}' is a read-only masked field"
        )

