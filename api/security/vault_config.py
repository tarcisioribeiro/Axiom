"""
Vault Config — gerenciamento da senha mestre e ciclo de vida do cofre.

Endpoints:
  GET  /api/v1/security/vault/status/              → VaultStatusView
  POST /api/v1/security/vault/setup/               → VaultSetupView
  POST /api/v1/security/vault/unlock/              → VaultUnlockView
  POST /api/v1/security/vault/lock/                → VaultLockView
  POST /api/v1/security/vault/change-master-password/ → VaultChangePasswordView
"""

import base64
import logging
from typing import Optional

from django.core.cache import cache
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.encryption import DecryptionError, FieldEncryption
from security.models import (
    Archive,
    Password,
    StoredBankAccount,
    StoredCreditCard,
    VaultConfig,
)
from security.vault_crypto import (
    VaultEncryption,
    VaultLockedException,
    clear_vault_key,
    set_vault_key,
)

logger = logging.getLogger(__name__)

# Tempo de sessão do cofre desbloqueado (em segundos)
VAULT_UNLOCK_TTL = 3600  # 1 hora

VAULT_CACHE_KEY = "vault_key:{user_id}"


def _cache_key(user_id: int) -> str:
    return VAULT_CACHE_KEY.format(user_id=user_id)


def _store_vault_key_in_cache(user_id: int, vault_key: bytes) -> None:
    """Armazena a vault_key no Redis com TTL."""
    cache.set(
        _cache_key(user_id),
        base64.b64encode(vault_key).decode(),
        timeout=VAULT_UNLOCK_TTL,
    )


def _get_vault_key_from_cache(user_id: int) -> Optional[bytes]:
    """Recupera a vault_key do Redis. Retorna None se não encontrada."""
    encoded = cache.get(_cache_key(user_id))
    if encoded:
        return base64.b64decode(encoded.encode())
    return None


def _delete_vault_key_from_cache(user_id: int) -> None:
    """Remove a vault_key do Redis (lock do cofre)."""
    cache.delete(_cache_key(user_id))


def _get_member(user):
    """Retorna o Member associado ao usuário ou None."""
    from members.models import Member

    try:
        return Member.objects.get(user=user, is_deleted=False)
    except Member.DoesNotExist:
        return None


def _re_encrypt_all_items(member, vault_key: bytes) -> None:
    """
    Re-criptografa todos os itens do cofre de segurança do membro.

    Decifra com a app key atual e re-cifra com a vault_key fornecida.
    Deve ser chamado dentro de um transaction.atomic().
    """
    # Passwords
    for pw in Password.objects.filter(owner=member, deleted_at__isnull=True):
        if pw._password:
            try:
                plaintext = FieldEncryption.decrypt_data(pw._password)
                pw._password = FieldEncryption.encrypt_with_key(plaintext, vault_key)
                pw.save(update_fields=["_password"])
            except Exception as e:
                logger.error(f"Erro ao re-criptografar senha {pw.id}: {e}")
                raise

    # Stored Credit Cards
    for card in StoredCreditCard.objects.filter(owner=member, deleted_at__isnull=True):
        update_fields = []
        try:
            if card._card_number:
                plaintext = FieldEncryption.decrypt_data(card._card_number)
                card._card_number = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
                update_fields.append("_card_number")
            if card._security_code:
                plaintext = FieldEncryption.decrypt_data(card._security_code)
                card._security_code = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
                update_fields.append("_security_code")
            if update_fields:
                card.save(update_fields=update_fields)
        except Exception as e:
            logger.error(f"Erro ao re-criptografar cartão {card.id}: {e}")
            raise

    # Stored Bank Accounts
    for acc in StoredBankAccount.objects.filter(owner=member, deleted_at__isnull=True):
        update_fields = []
        try:
            if acc._account_number:
                plaintext = FieldEncryption.decrypt_data(acc._account_number)
                acc._account_number = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
                update_fields.append("_account_number")
            if acc._password:
                plaintext = FieldEncryption.decrypt_data(acc._password)
                acc._password = FieldEncryption.encrypt_with_key(plaintext, vault_key)
                update_fields.append("_password")
            if acc._digital_password:
                plaintext = FieldEncryption.decrypt_data(acc._digital_password)
                acc._digital_password = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
                update_fields.append("_digital_password")
            if update_fields:
                acc.save(update_fields=update_fields)
        except Exception as e:
            logger.error(f"Erro ao re-criptografar conta bancária {acc.id}: {e}")
            raise

    # Archives (text content only — files are not re-encrypted)
    for archive in Archive.objects.filter(owner=member, deleted_at__isnull=True):
        if archive._encrypted_text:
            try:
                plaintext = FieldEncryption.decrypt_data(archive._encrypted_text)
                archive._encrypted_text = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
                archive.save(update_fields=["_encrypted_text"])
            except Exception as e:
                logger.error(
                    f"Erro ao re-criptografar arquivo de texto {archive.id}: {e}"
                )
                raise


# ============================================================================
# MIXIN
# ============================================================================


class VaultLockedMixin:
    """
    Mixin para views do cofre de segurança.

    Comportamento:
    - Se usuário não tem VaultConfig: usa a app key (retrocompatibilidade).
    - Se tem VaultConfig e cofre está desbloqueado: set_vault_key() e processa.
    - Se tem VaultConfig e cofre está bloqueado: levanta VaultLockedException (423).

    A vault_key é limpa do thread-local ao final de cada request (finalize_response).
    """

    def _get_vault_config(self, request):
        member = _get_member(request.user)
        if member is None:
            return None
        try:
            return VaultConfig.objects.get(owner=member)
        except VaultConfig.DoesNotExist:
            return None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)  # type: ignore[misc]
        vault_config = self._get_vault_config(request)
        if vault_config is None:
            # Cofre não configurado → continua com app key (sem vault_key no context)
            return

        vault_key = _get_vault_key_from_cache(request.user.id)
        if vault_key is None:
            raise VaultLockedException()

        set_vault_key(vault_key)

    def finalize_response(self, request, response, *args, **kwargs):
        clear_vault_key()
        return super().finalize_response(
            request, response, *args, **kwargs
        )  # type: ignore[misc]


# ============================================================================
# SERIALIZERS
# ============================================================================


class VaultSetupSerializer(serializers.Serializer):
    master_password = serializers.CharField(
        min_length=8,
        max_length=128,
        write_only=True,
    )
    confirm_master_password = serializers.CharField(
        min_length=8,
        max_length=128,
        write_only=True,
    )

    def validate(self, data):
        if data["master_password"] != data["confirm_master_password"]:
            raise serializers.ValidationError(
                {"confirm_master_password": "As senhas mestres não coincidem."}
            )
        return data


class VaultUnlockSerializer(serializers.Serializer):
    master_password = serializers.CharField(
        min_length=1,
        max_length=128,
        write_only=True,
    )


class VaultChangePasswordSerializer(serializers.Serializer):
    current_master_password = serializers.CharField(
        min_length=1,
        max_length=128,
        write_only=True,
    )
    new_master_password = serializers.CharField(
        min_length=8,
        max_length=128,
        write_only=True,
    )
    confirm_new_master_password = serializers.CharField(
        min_length=8,
        max_length=128,
        write_only=True,
    )

    def validate(self, data):
        if data["new_master_password"] != data["confirm_new_master_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_new_master_password": (
                        "As novas senhas mestres não coincidem."
                    )
                }
            )
        return data


# ============================================================================
# VIEWS
# ============================================================================


class VaultStatusView(APIView):
    """
    GET /api/v1/security/vault/status/

    Retorna o status atual do cofre.
    Não requer cofre desbloqueado.

    Response: { "is_configured": bool, "is_unlocked": bool }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        member = _get_member(request.user)
        if member is None:
            return Response({"is_configured": False, "is_unlocked": False})

        try:
            VaultConfig.objects.get(owner=member)
            is_configured = True
        except VaultConfig.DoesNotExist:
            is_configured = False

        is_unlocked = _get_vault_key_from_cache(request.user.id) is not None

        return Response(
            {
                "is_configured": is_configured,
                "is_unlocked": is_unlocked,
            }
        )


class VaultSetupView(APIView):
    """
    POST /api/v1/security/vault/setup/

    Configura a senha mestre pela primeira vez.
    Re-criptografa todos os itens existentes com a nova vault_key.
    Ao finalizar, o cofre fica automaticamente desbloqueado.

    Body: { "master_password": str, "confirm_master_password": str }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        member = _get_member(request.user)
        if member is None:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verifica se já tem cofre configurado
        if VaultConfig.objects.filter(owner=member).exists():
            return Response(
                {
                    "error": (
                        "O cofre já está configurado. "
                        "Use 'change-master-password' para alterar a senha mestre."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VaultSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        master_password = serializer.validated_data["master_password"]

        # Gera salt e deriva a chave
        salt = VaultEncryption.generate_salt()
        derived_key = VaultEncryption.derive_key(master_password, salt)

        # Gera a vault_key aleatória
        vault_key = VaultEncryption.generate_vault_key()

        # Cifra a vault_key com a derived_key (envelope encryption)
        encrypted_vault_key = VaultEncryption.encrypt_vault_key(vault_key, derived_key)

        try:
            with transaction.atomic():
                # Cria o VaultConfig
                VaultConfig.objects.create(
                    owner=member,
                    salt=base64.b64encode(salt).decode(),
                    encrypted_vault_key=encrypted_vault_key,
                )

                # Re-criptografa todos os itens existentes com a vault_key
                _re_encrypt_all_items(member, vault_key)
        except Exception as e:
            logger.error(
                f"Erro ao configurar cofre para usuário {request.user.id}: {e}"
            )
            return Response(
                {
                    "error": (
                        "Erro ao configurar o cofre. "
                        "Nenhum dado foi alterado. Tente novamente."
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Desbloqueia automaticamente após configuração
        _store_vault_key_in_cache(request.user.id, vault_key)

        return Response(
            {
                "message": (
                    "Cofre configurado com sucesso. "
                    "Todos os seus dados foram re-criptografados"
                    " com a nova senha mestre."
                )
            },
            status=status.HTTP_201_CREATED,
        )


class VaultUnlockView(APIView):
    """
    POST /api/v1/security/vault/unlock/

    Desbloqueia o cofre com a senha mestre.
    A vault_key é armazenada no Redis por 1 hora.

    Body: { "master_password": str }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        member = _get_member(request.user)
        if member is None:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            vault_config = VaultConfig.objects.get(owner=member)
        except VaultConfig.DoesNotExist:
            return Response(
                {
                    "error": (
                        "O cofre não está configurado. "
                        "Configure uma senha mestre primeiro."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VaultUnlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        master_password = serializer.validated_data["master_password"]

        # Deriva a chave e tenta decifrar a vault_key
        try:
            salt = base64.b64decode(vault_config.salt.encode())
            derived_key = VaultEncryption.derive_key(master_password, salt)
            vault_key = VaultEncryption.decrypt_vault_key(
                vault_config.encrypted_vault_key, derived_key
            )
        except DecryptionError:
            return Response(
                {"error": "Senha mestre incorreta."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Erro ao desbloquear cofre do usuário {request.user.id}: {e}")
            return Response(
                {"error": "Erro ao desbloquear o cofre. Tente novamente."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        _store_vault_key_in_cache(request.user.id, vault_key)

        return Response(
            {
                "message": "Cofre desbloqueado com sucesso.",
                "expires_in": VAULT_UNLOCK_TTL,
            }
        )


class VaultLockView(APIView):
    """
    POST /api/v1/security/vault/lock/

    Bloqueia o cofre imediatamente (remove vault_key do Redis).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        _delete_vault_key_from_cache(request.user.id)
        return Response({"message": "Cofre bloqueado com sucesso."})


class VaultChangePasswordView(APIView):
    """
    POST /api/v1/security/vault/change-master-password/

    Altera a senha mestre do cofre.
    Deriva nova chave e re-cifra a vault_key (NÃO re-criptografa os dados).
    Ao finalizar, o cofre fica desbloqueado com a nova senha.

    Body: { "current_master_password": str, "new_master_password": str,
            "confirm_new_master_password": str }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        member = _get_member(request.user)
        if member is None:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            vault_config = VaultConfig.objects.get(owner=member)
        except VaultConfig.DoesNotExist:
            return Response(
                {"error": "O cofre não está configurado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VaultChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        current_password = serializer.validated_data["current_master_password"]
        new_password = serializer.validated_data["new_master_password"]

        # Verifica a senha atual e recupera a vault_key
        try:
            salt = base64.b64decode(vault_config.salt.encode())
            derived_key = VaultEncryption.derive_key(current_password, salt)
            vault_key = VaultEncryption.decrypt_vault_key(
                vault_config.encrypted_vault_key, derived_key
            )
        except DecryptionError:
            return Response(
                {"error": "Senha mestre atual incorreta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Gera novo salt e deriva nova chave
        new_salt = VaultEncryption.generate_salt()
        new_derived_key = VaultEncryption.derive_key(new_password, new_salt)

        # Re-cifra a vault_key com a nova derived_key
        new_encrypted_vault_key = VaultEncryption.encrypt_vault_key(
            vault_key, new_derived_key
        )

        vault_config.salt = base64.b64encode(new_salt).decode()
        vault_config.encrypted_vault_key = new_encrypted_vault_key
        vault_config.save(update_fields=["salt", "encrypted_vault_key", "updated_at"])

        # Mantém o cofre desbloqueado com a vault_key original
        _store_vault_key_in_cache(request.user.id, vault_key)

        return Response({"message": "Senha mestre alterada com sucesso."})
