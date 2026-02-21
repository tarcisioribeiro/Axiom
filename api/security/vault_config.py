"""
Vault Config — gerenciamento da senha mestre e ciclo de vida do cofre.

Endpoints:
  GET  /api/v1/security/vault/status/                → VaultStatusView
  POST /api/v1/security/vault/setup/                 → VaultSetupView
  POST /api/v1/security/vault/unlock/                → VaultUnlockView
  POST /api/v1/security/vault/lock/                  → VaultLockView
  POST /api/v1/security/vault/change-master-password/→ VaultChangePasswordView
  POST /api/v1/security/vault/migrate-from-backup/   → VaultMigrateFromBackupView

Mixins:
  VaultLockedMixin    — requer cofre desbloqueado (423 se bloqueado)
  VaultOptionalMixin  — injeta vault_key se disponível, continua com app key
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

from app.encryption import (
    DecryptionError,
    FieldEncryption,
    clear_vault_key,
    set_vault_key,
)
from security.models import (
    Archive,
    Password,
    StoredBankAccount,
    StoredCreditCard,
    VaultConfig,
)
from security.vault_crypto import VaultEncryption, VaultLockedException

# Importações tardias (lazy) para evitar dependências circulares:
# accounts e credit_cards são importados dentro das funções que os usam.

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


def _re_encrypt_all_items(member, vault_key: bytes) -> int:
    """
    Re-criptografa todos os itens sensíveis do membro.

    Inclui itens do cofre de segurança E campos criptografados dos módulos
    financeiros (contas bancárias e cartões de crédito).

    Decifra com a app key atual e re-cifra com a vault_key fornecida.
    Deve ser chamado dentro de um transaction.atomic().

    Itens que não podem ser descriptografados (chave incompatível ou dados
    corrompidos) são ignorados com um aviso de log — o setup não é abortado.

    Retorna o número de itens pulados por falha de descriptografia.
    """
    from accounts.models import Account
    from credit_cards.models import CreditCard

    skipped = 0

    # Passwords
    for pw in Password.objects.filter(owner=member, deleted_at__isnull=True):
        if pw._password:
            try:
                plaintext = FieldEncryption.decrypt_data(pw._password)
                pw._password = FieldEncryption.encrypt_with_key(plaintext, vault_key)
                pw.save(update_fields=["_password"])
            except Exception as e:
                logger.warning(
                    f"Pulando senha {pw.id} — não foi possível descriptografar: {e}"
                )
                skipped += 1

    # Stored Credit Cards (cofre de segurança)
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
            logger.warning(
                f"""Pulando cartão (cofre) {
                    card.id
                } — não foi possível descriptografar: {e}"""
            )
            skipped += 1

    # Stored Bank Accounts (cofre de segurança)
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
            logger.warning(
                f"""Pulando conta bancária (cofre) {
                    acc.id
                } — não foi possível descriptografar: {e}"""
            )
            skipped += 1

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
                logger.warning(
                    f"""Pulando arquivo {
                        archive.id
                    } — não foi possível descriptografar: {e}"""
                )
                skipped += 1

    # Finance: Contas bancárias (módulo financeiro)
    for finance_acc in Account.objects.filter(owner=member, is_deleted=False):
        if finance_acc._account_number:
            try:
                plaintext = FieldEncryption.decrypt_data(finance_acc._account_number)
                finance_acc._account_number = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
                finance_acc.save(update_fields=["_account_number"])
            except Exception as e:
                logger.warning(
                    f"""Pulando conta financeira {
                        finance_acc.id
                    } — não foi possível descriptografar: {e}"""
                )
                skipped += 1

    # Finance: Cartões de crédito (módulo financeiro)
    for cc in CreditCard.objects.filter(owner=member, is_deleted=False):
        update_kwargs = {}
        try:
            if cc._card_number:
                plaintext = FieldEncryption.decrypt_data(cc._card_number)
                update_kwargs["_card_number"] = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
            if cc._security_code:
                plaintext = FieldEncryption.decrypt_data(cc._security_code)
                update_kwargs["_security_code"] = FieldEncryption.encrypt_with_key(
                    plaintext, vault_key
                )
            if update_kwargs:
                # Usa update() para evitar full_clean() que valida validation_date
                CreditCard.objects.filter(pk=cc.pk).update(**update_kwargs)
        except Exception as e:
            logger.warning(
                f"""Pulando cartão de crédito {
                    cc.id
                } — não foi possível descriptografar: {e}"""
            )
            skipped += 1

    return skipped


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


class VaultOptionalMixin:
    """
    Mixin para views que utilizam campos criptografados mas NÃO exigem cofre.

    Comportamento:
    - Se cofre está desbloqueado: injeta vault_key no contexto da thread.
    - Se cofre está bloqueado ou não configurado: prossegue com a app key.

    Usado nas views de contas e cartões de crédito para garantir que os campos
    criptografados usem vault_key após a configuração do cofre, sem bloquear
    o acesso de usuários que ainda não configuraram o cofre.
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)  # type: ignore[misc]
        vault_key = _get_vault_key_from_cache(request.user.id)
        if vault_key:
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
                skipped = _re_encrypt_all_items(member, vault_key)
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

        message = (
            "Cofre configurado com sucesso. "
            "Todos os seus dados foram re-criptografados com a nova senha mestre."
        )
        if skipped:
            logger.warning(
                f"Setup do cofre (usuário {request.user.id}): "
                f"{skipped} item(s) não puderam ser migrados (chave incompatível)."
            )
            message = (
                "Cofre configurado com sucesso. "
                f"{skipped} item(s) com dados ilegíveis foram ignorados "
                "(chave de criptografia incompatível). "
                "Use 'Migrar do Backup' para recuperá-los se possuir a chave original."
            )

        return Response({"message": message}, status=status.HTTP_201_CREATED)


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


# ============================================================================
# MIGRATION — restauração de backup com ENCRYPTION_KEY diferente
# ============================================================================


def _migrate_from_old_key(member, old_key: bytes, vault_key: bytes) -> tuple[int, int]:
    """
    Tenta re-criptografar itens que estão cifrados com old_key para vault_key.

    Itera sobre todos os campos criptografados do membro. Para cada campo:
    - Se conseguir decifrar com old_key → re-cifra com vault_key.
    - Se falhar (já está em vault_key ou em outra chave) → ignora (skip).

    Retorna (migrated_count, skipped_count).
    """
    from accounts.models import Account
    from credit_cards.models import CreditCard

    migrated = 0
    skipped = 0

    def _try_migrate(obj, field_name: str, save_fn) -> None:
        nonlocal migrated, skipped
        raw = getattr(obj, field_name)
        if not raw:
            return
        try:
            plaintext = FieldEncryption.decrypt_with_key(raw, old_key)
            setattr(
                obj, field_name, FieldEncryption.encrypt_with_key(plaintext, vault_key)
            )
            save_fn(obj, field_name)
            migrated += 1
        except (DecryptionError, Exception):
            skipped += 1

    with transaction.atomic():
        # Passwords
        for pw in Password.objects.filter(owner=member, deleted_at__isnull=True):
            _try_migrate(pw, "_password", lambda o, f: o.save(update_fields=[f]))

        # Stored Credit Cards (cofre)
        for card in StoredCreditCard.objects.filter(
            owner=member, deleted_at__isnull=True
        ):
            _try_migrate(card, "_card_number", lambda o, f: o.save(update_fields=[f]))
            _try_migrate(card, "_security_code", lambda o, f: o.save(update_fields=[f]))

        # Stored Bank Accounts (cofre)
        for acc in StoredBankAccount.objects.filter(
            owner=member, deleted_at__isnull=True
        ):
            for field in ("_account_number", "_password", "_digital_password"):
                _try_migrate(acc, field, lambda o, f: o.save(update_fields=[f]))

        # Archives (cofre)
        for archive in Archive.objects.filter(owner=member, deleted_at__isnull=True):
            _try_migrate(
                archive,
                "_encrypted_text",
                lambda o, f: o.save(update_fields=[f]),
            )

        # Finance: Contas bancárias
        for finance_acc in Account.objects.filter(owner=member, is_deleted=False):
            _try_migrate(
                finance_acc,
                "_account_number",
                lambda o, f: o.save(update_fields=[f]),
            )

        # Finance: Cartões de crédito (usa update() para evitar full_clean)
        for cc in CreditCard.objects.filter(owner=member, is_deleted=False):
            for field in ("_card_number", "_security_code"):
                raw = getattr(cc, field)
                if not raw:
                    continue
                try:
                    plaintext = FieldEncryption.decrypt_with_key(raw, old_key)
                    new_encrypted = FieldEncryption.encrypt_with_key(
                        plaintext, vault_key
                    )
                    CreditCard.objects.filter(pk=cc.pk).update(**{field: new_encrypted})
                    migrated += 1
                except (DecryptionError, Exception):
                    skipped += 1

    return migrated, skipped


class VaultMigrateSerializer(serializers.Serializer):
    old_encryption_key = serializers.CharField(
        min_length=44,
        max_length=44,
        write_only=True,
        help_text="Chave Fernet base64 de 44 caracteres do ambiente anterior.",
    )


class VaultMigrateFromBackupView(APIView):
    """
    POST /api/v1/security/vault/migrate-from-backup/

    Migra dados criptografados com uma ENCRYPTION_KEY antiga para a vault_key atual.

    Caso de uso: ao restaurar um backup de banco de dados para um novo ambiente
    onde a ENCRYPTION_KEY é diferente, forneça a chave original para que o sistema
    possa re-criptografar todos os dados para a vault_key atual.

    Requer que o cofre esteja configurado e desbloqueado.

    Body: { "old_encryption_key": str }
    Response: { "message": str, "migrated": int, "skipped": int }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        member = _get_member(request.user)
        if member is None:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        vault_key = _get_vault_key_from_cache(request.user.id)
        if vault_key is None:
            return Response(
                {"error": "O cofre deve estar desbloqueado para migrar dados."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = VaultMigrateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old_encryption_key = serializer.validated_data["old_encryption_key"]

        # Valida se é uma chave Fernet válida
        try:
            from cryptography.fernet import Fernet as _Fernet

            old_key_bytes = old_encryption_key.encode()
            _Fernet(old_key_bytes)
        except Exception:
            return Response(
                {
                    "error": (
                        "Chave de criptografia inválida. "
                        "Deve ser uma chave Fernet base64url de 44 caracteres."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            migrated, skipped = _migrate_from_old_key(member, old_key_bytes, vault_key)
        except Exception as e:
            logger.error(
                f"Erro na migração de backup para usuário {request.user.id}: {e}"
            )
            return Response(
                {"error": "Erro durante a migração. Nenhum dado foi alterado."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": (
                    f"Migração concluída. {migrated} campos re-criptografados, "
                    f"{skipped} já estavam na chave atual."
                ),
                "migrated": migrated,
                "skipped": skipped,
            }
        )
