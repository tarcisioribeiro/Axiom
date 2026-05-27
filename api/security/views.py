import hashlib
import logging
import re
import secrets
import string
from datetime import date, timedelta

from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.encryption import DecryptionError, FieldEncryption
from app.permissions import GlobalDefaultPermission
from authentication.throttles import ShareTokenRateThrottle
from security.importers import (
    SUPPORTED_FORMATS,
    ImportParseError,
    parse_bitwarden_json,
    parse_dashlane_csv,
    parse_keepass_xml,
    parse_lastpass_csv,
    parse_onepassword_csv,
)
from security.models import (
    ACTION_TYPES,
    PASSWORD_CATEGORIES,
    ActivityLog,
    Archive,
    CredentialShareToken,
    Password,
    StoredBankAccount,
    StoredCreditCard,
)
from security.serializers import (
    ActivityLogSerializer,
    ArchiveCreateUpdateSerializer,
    ArchiveRevealSerializer,
    ArchiveSerializer,
    CreateShareTokenSerializer,
    CredentialShareTokenCreateResponseSerializer,
    CredentialShareTokenSerializer,
    PasswordCreateUpdateSerializer,
    PasswordRevealSerializer,
    PasswordSerializer,
    StoredBankAccountCreateUpdateSerializer,
    StoredBankAccountRevealSerializer,
    StoredBankAccountSerializer,
    StoredCreditCardCreateUpdateSerializer,
    StoredCreditCardRevealSerializer,
    StoredCreditCardSerializer,
)
from security.vault_config import VaultLockedMixin

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Extrai o IP do cliente da requisição, respeitando NUM_PROXIES."""
    from app.ip_utils import get_client_ip as _get_trusted_client_ip

    return _get_trusted_client_ip(request)


def log_activity(
    request,
    action,
    model_name,
    object_id,
    description,
    object_uuid=None,
    description_key=None,
    description_params=None,
):
    """Helper para registrar atividades."""
    ActivityLog.log_action(
        user=request.user,
        action=action,
        description=description,
        description_key=description_key,
        description_params=description_params,
        model_name=model_name,
        object_id=object_id,
        object_uuid=object_uuid,
        ip_address=get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )


# ============================================================================
# PASSWORD VIEWS
# ============================================================================


class PasswordListCreateView(VaultLockedMixin, BaseListCreateView):
    """Lista todas as senhas ou cria uma nova."""

    queryset = Password.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campo criptografado na listagem
        # (performance)
        return (
            Password.objects.filter(owner__user=self.request.user)
            .select_related("owner")
            .defer("_password")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PasswordCreateUpdateSerializer
        return PasswordSerializer

    def perform_create(self, serializer):
        password = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "Password",
            password.id,
            f"Criou senha: {password.title}",
            object_uuid=password.uuid,
            description_key="password.create",
            description_params={"name": password.title},
        )


class PasswordDetailView(VaultLockedMixin, BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma senha."""

    queryset = Password.objects.all()

    def get_queryset(self):
        return Password.objects.filter(
            owner__user=self.request.user
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return PasswordCreateUpdateSerializer
        return PasswordSerializer

    def perform_update(self, serializer):
        password = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "Password",
            password.id,
            f"Atualizou senha: {password.title}",
            object_uuid=password.uuid,
            description_key="password.update",
            description_params={"name": password.title},
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Password",
            instance.id,
            f"Deletou senha: {instance.title}",
            object_uuid=instance.uuid,
            description_key="password.delete",
            description_params={"name": instance.title},
        )


class PasswordRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela a senha descriptografada (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = PasswordRevealSerializer
    queryset = Password.objects.all()

    def get_queryset(self):
        return Password.objects.filter(owner__user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "Password",
            instance.id,
            f"Revelou senha: {instance.title}",
            object_uuid=instance.uuid,
            description_key="password.reveal",
            description_params={"name": instance.title},
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ============================================================================
# STORED CREDIT CARD VIEWS
# ============================================================================


class StoredCreditCardListCreateView(VaultLockedMixin, BaseListCreateView):
    """Lista todos os cartões ou cria um novo."""

    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campos criptografados na listagem
        # (performance)
        return (
            StoredCreditCard.objects.filter(owner__user=self.request.user)
            .select_related("owner", "finance_card")
            .defer("_card_number", "_security_code")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StoredCreditCardCreateUpdateSerializer
        return StoredCreditCardSerializer

    def perform_create(self, serializer):
        card = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "StoredCreditCard",
            card.id,
            f"Criou cartão: {card.name}",
            description_key="card.create",
            description_params={"name": card.name},
        )


class StoredCreditCardDetailView(
    VaultLockedMixin, BaseRetrieveUpdateDestroyView
):
    """Recupera, atualiza ou deleta um cartão."""

    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        return StoredCreditCard.objects.filter(
            owner__user=self.request.user
        ).select_related("owner", "finance_card")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return StoredCreditCardCreateUpdateSerializer
        return StoredCreditCardSerializer

    def perform_update(self, serializer):
        card = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "StoredCreditCard",
            card.id,
            f"Atualizou cartão: {card.name}",
            description_key="card.update",
            description_params={"name": card.name},
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "StoredCreditCard",
            instance.id,
            f"Deletou cartão: {instance.name}",
            description_key="card.delete",
            description_params={"name": instance.name},
        )


class StoredCreditCardRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela dados completos do cartão (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = StoredCreditCardRevealSerializer
    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        return StoredCreditCard.objects.filter(owner__user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "StoredCreditCard",
            instance.id,
            f"Revelou dados do cartão: {instance.name}",
            description_key="card.reveal",
            description_params={"name": instance.name},
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ============================================================================
# STORED BANK ACCOUNT VIEWS
# ============================================================================


class StoredBankAccountListCreateView(VaultLockedMixin, BaseListCreateView):
    """Lista todas as contas bancárias ou cria uma nova."""

    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campos criptografados na listagem
        # (performance)
        return (
            StoredBankAccount.objects.filter(owner__user=self.request.user)
            .select_related("owner", "finance_account")
            .defer("_account_number", "_password", "_digital_password")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StoredBankAccountCreateUpdateSerializer
        return StoredBankAccountSerializer

    def perform_create(self, serializer):
        account = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "StoredBankAccount",
            account.id,
            f"Criou conta bancária: {account.name}",
            description_key="bank_account.create",
            description_params={"name": account.name},
        )


class StoredBankAccountDetailView(
    VaultLockedMixin, BaseRetrieveUpdateDestroyView
):
    """Recupera, atualiza ou deleta uma conta bancária."""

    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        return StoredBankAccount.objects.filter(
            owner__user=self.request.user
        ).select_related("owner", "finance_account")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return StoredBankAccountCreateUpdateSerializer
        return StoredBankAccountSerializer

    def perform_update(self, serializer):
        account = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "StoredBankAccount",
            account.id,
            f"Atualizou conta bancária: {account.name}",
            description_key="bank_account.update",
            description_params={"name": account.name},
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "StoredBankAccount",
            instance.id,
            f"Deletou conta bancária: {instance.name}",
            description_key="bank_account.delete",
            description_params={"name": instance.name},
        )


class StoredBankAccountRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela dados completos da conta bancária (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = StoredBankAccountRevealSerializer
    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        return StoredBankAccount.objects.filter(owner__user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "StoredBankAccount",
            instance.id,
            f"Revelou dados da conta: {instance.name}",
            description_key="bank_account.reveal",
            description_params={"name": instance.name},
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ============================================================================
# ARCHIVE VIEWS
# ============================================================================


class ArchiveListCreateView(VaultLockedMixin, BaseListCreateView):
    """Lista todos os arquivos ou cria um novo."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Archive.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campo criptografado na listagem
        # (performance)
        return (
            Archive.objects.filter(
                owner__user=self.request.user, is_deleted=False
            )
            .select_related("owner")
            .defer("_encrypted_text")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ArchiveCreateUpdateSerializer
        return ArchiveSerializer

    def perform_create(self, serializer):
        try:
            archive = serializer.save(
                created_by=self.request.user, updated_by=self.request.user
            )
        except PermissionError:
            logger.error(
                "Permissão negada ao salvar arquivo em /app/media/security/"
            )
            raise serializers.ValidationError(
                {
                    "encrypted_file": (
                        "Erro de permissão ao salvar o arquivo"
                        " no servidor. "
                        "O diretório de armazenamento não"
                        " possui permissão de escrita. "
                        "Contate o administrador do sistema."
                    )
                }
            )
        except OSError as e:
            logger.error(f"Erro de I/O ao salvar arquivo: {e}")
            raise serializers.ValidationError(
                {
                    "encrypted_file": (
                        f"Erro ao salvar o arquivo no servidor: {e.strerror}. "
                        "Contate o administrador do sistema."
                    )
                }
            )
        log_activity(
            self.request,
            "create",
            "Archive",
            archive.id,
            f"Criou arquivo: {archive.title}",
            description_key="archive.create",
            description_params={"name": archive.title},
        )


class ArchiveDetailView(VaultLockedMixin, BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um arquivo."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Archive.objects.all()

    def get_queryset(self):
        return Archive.objects.filter(
            owner__user=self.request.user, is_deleted=False
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ArchiveCreateUpdateSerializer
        return ArchiveSerializer

    def perform_update(self, serializer):
        try:
            archive = serializer.save(updated_by=self.request.user)
        except PermissionError:
            logger.error(
                "Permissão negada ao atualizar arquivo em /app/media/security/"
            )
            raise serializers.ValidationError(
                {
                    "encrypted_file": (
                        "Erro de permissão ao salvar o arquivo"
                        " no servidor. "
                        "O diretório de armazenamento não"
                        " possui permissão de escrita. "
                        "Contate o administrador do sistema."
                    )
                }
            )
        except OSError as e:
            logger.error(f"Erro de I/O ao atualizar arquivo: {e}")
            raise serializers.ValidationError(
                {
                    "encrypted_file": (
                        f"Erro ao salvar o arquivo no servidor: {e.strerror}. "
                        "Contate o administrador do sistema."
                    )
                }
            )
        log_activity(
            self.request,
            "update",
            "Archive",
            archive.id,
            f"Atualizou arquivo: {archive.title}",
            description_key="archive.update",
            description_params={"name": archive.title},
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Archive",
            instance.id,
            f"Deletou arquivo: {instance.title}",
            description_key="archive.delete",
            description_params={"name": instance.title},
        )


class ArchiveRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela conteúdo de texto do arquivo (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = ArchiveRevealSerializer
    queryset = Archive.objects.all()

    def get_queryset(self):
        return Archive.objects.filter(
            owner__user=self.request.user, is_deleted=False
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "Archive",
            instance.id,
            f"Revelou conteúdo do arquivo: {instance.title}",
            description_key="archive.reveal",
            description_params={"name": instance.title},
        )

        response_data = {
            "id": instance.id,
            "title": instance.title,
            "text_content": None,
            "error": None,
            "error_type": None,
        }

        if not instance._encrypted_text:
            response_data["error"] = (
                "Este arquivo não possui conteúdo de texto armazenado."
            )
            response_data["error_type"] = "no_content"
            return Response(response_data)

        try:
            # Usa VaultEncryptedField via propriedade text_content, que já
            # aplica
            # a vault_key do contexto de thread (set por VaultLockedMixin).
            decrypted = instance.text_content
            if decrypted is None:
                response_data["error"] = (
                    "Não foi possível descriptografar o conteúdo. "
                    "A chave de criptografia pode ter sido alterada."
                )
                response_data["error_type"] = "decryption_failed"
            else:
                response_data["text_content"] = decrypted
        except Exception as e:
            logger.error(
                f"Erro ao descriptografar arquivo {instance.id}: {str(e)}"
            )
            response_data["error"] = (
                "Não foi possível descriptografar o conteúdo. "
                "Verifique se a chave de criptografia está correta."
            )
            response_data["error_type"] = "decryption_failed"

        return Response(response_data)


class ArchiveDownloadView(APIView):
    """Faz download do arquivo criptografado."""

    permission_classes = [IsAuthenticated]
    # Note: GlobalDefaultPermission removed because APIView doesn't have
    # queryset
    # Security is handled by filtering on owner__user in the query below

    def get(self, request, pk):
        """Download do arquivo criptografado."""
        try:
            archive = Archive.objects.get(
                pk=pk, owner__user=request.user, is_deleted=False
            )
        except Archive.DoesNotExist:
            return Response(
                {"detail": "Arquivo não encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not archive.encrypted_file:
            return Response(
                {"detail": "Este arquivo não possui um arquivo anexado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import os

        filename = (
            archive.file_name or archive.encrypted_file.name.split("/")[-1]
        )

        from django.http import FileResponse

        from security.serializers import ALLOWED_UPLOAD_TYPES

        if request.query_params.get("stream"):
            # Proxy stream — browser navigated directly to this URL.
            log_activity(
                request,
                "download",
                "Archive",
                archive.id,
                f"Fez download do arquivo: {archive.title}",
                description_key="archive.download",
                description_params={"name": archive.title},
            )
            try:
                file = archive.encrypted_file.open("rb")
            except Exception:
                return Response(
                    {"detail": "Arquivo não encontrado."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            _, ext = os.path.splitext(filename.lower())
            content_type = ALLOWED_UPLOAD_TYPES.get(
                ext, "application/octet-stream"
            )
            return FileResponse(
                file,
                as_attachment=True,
                filename=filename,
                content_type=content_type,
            )

        # Return the stream URL so the frontend can trigger a browser download
        # without depending on MinIO being publicly accessible.
        stream_url = f"/api/v1/security/archives/{pk}/download/?stream=1"
        return Response({"url": stream_url, "filename": filename})


# ============================================================================
# ACTIVITY LOG VIEWS
# ============================================================================


class ActivityLogListView(generics.ListAPIView):
    """Lista logs de atividades (somente leitura)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = ActivityLogSerializer
    queryset = ActivityLog.objects.all()  # type: ignore[attr-defined]

    def get_queryset(self):
        return ActivityLog.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )


# ============================================================================
# SECURITY DASHBOARD VIEWS
# ============================================================================


class SecurityDashboardStatsView(VaultLockedMixin, APIView):
    """
    GET /api/v1/security/dashboard/stats/

    Retorna estatísticas agregadas do módulo de Segurança.

    Response:
    {
        "total_passwords": 15,
        "total_stored_cards": 3,
        "total_stored_accounts": 2,
        "total_archives": 5,
        "passwords_by_category": [
            {
                "category": "social",
                "category_display": "Redes Sociais",
                "count": 5,
            },
            {"category": "email", "category_display": "E-mail", "count": 3}
        ],
        "recent_activity": [
            {
                "action": "create",
                "action_display": "Criação",
                "model_name": "Password",
                "description": "Criou senha: Gmail",
                "created_at": "2025-03-15T10:30:00Z"
            }
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Calcula estatísticas do módulo de segurança."""
        user = request.user

        # Verificar se o usuário tem um member associado
        from members.models import Member

        try:
            member = Member.objects.get(user=user)
        except Member.DoesNotExist:
            # Se não houver member, retornar estatísticas vazias
            return Response(
                {
                    "total_passwords": 0,
                    "total_stored_cards": 0,
                    "total_stored_accounts": 0,
                    "total_archives": 0,
                    "passwords_by_category": [],
                    "recent_activity": [],
                    "items_distribution": [],
                    "password_strength_distribution": [],
                    "activities_by_action": [],
                    "activities_timeline": [],
                }
            )

        # Querysets filtrados por owner e não deletados
        passwords_qs = Password.objects.filter(owner=member)
        stored_cards_qs = StoredCreditCard.objects.filter(owner=member)
        stored_accounts_qs = StoredBankAccount.objects.filter(owner=member)
        archives_qs = Archive.objects.filter(owner=member)

        # Contadores
        total_passwords = passwords_qs.count()
        total_stored_cards = stored_cards_qs.count()
        total_stored_accounts = stored_accounts_qs.count()
        total_archives = archives_qs.count()

        # Senhas por categoria (Top 5)
        passwords_by_category = list(
            passwords_qs.values("category")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # Adicionar display name das categorias
        category_dict = dict(PASSWORD_CATEGORIES)
        for item in passwords_by_category:
            item["category_display"] = category_dict.get(
                item["category"], item["category"]
            )

        # Distribuição de tipos de itens (para gráfico de pizza)
        items_distribution = []
        if total_passwords > 0:
            items_distribution.append(
                {
                    "type": "passwords",
                    "type_display": "Senhas",
                    "count": total_passwords,
                }
            )
        if total_stored_cards > 0:
            items_distribution.append(
                {
                    "type": "cards",
                    "type_display": "Cartões",
                    "count": total_stored_cards,
                }
            )
        if total_stored_accounts > 0:
            items_distribution.append(
                {
                    "type": "accounts",
                    "type_display": "Contas",
                    "count": total_stored_accounts,
                }
            )
        if total_archives > 0:
            items_distribution.append(
                {
                    "type": "archives",
                    "type_display": "Arquivos",
                    "count": total_archives,
                }
            )

        # Análise de força de senhas
        password_strength_distribution = self._calculate_password_strength(
            passwords_qs
        )

        # Atividades por tipo de ação
        security_models = [
            "Password",
            "StoredCreditCard",
            "StoredBankAccount",
            "Archive",
        ]
        activities_by_action = list(
            ActivityLog.objects.filter(
                user=user, model_name__in=security_models
            )
            .values("action")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        action_dict = dict(ACTION_TYPES)
        for item in activities_by_action:
            item["action_display"] = action_dict.get(
                item["action"], item["action"]
            )

        # Timeline de atividades (últimos 6 meses)
        six_months_ago = timezone.now() - timedelta(days=180)
        activities_timeline = list(
            ActivityLog.objects.filter(
                user=user,
                model_name__in=security_models,
                created_at__gte=six_months_ago,
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        for item in activities_timeline:
            item["month"] = item["month"].strftime("%Y-%m")

        # Atividades recentes (últimas 10)
        recent_activity = ActivityLog.objects.filter(
            user=user, model_name__in=security_models
        ).order_by("-created_at")[:10]

        recent_activity_data = []
        for log in recent_activity:
            recent_activity_data.append(
                {
                    "action": log.action,
                    "action_display": action_dict.get(log.action, log.action),
                    "model_name": log.model_name,
                    "description": log.description,
                    "created_at": log.created_at.isoformat(),
                }
            )

        stats = {
            "total_passwords": total_passwords,
            "total_stored_cards": total_stored_cards,
            "total_stored_accounts": total_stored_accounts,
            "total_archives": total_archives,
            "passwords_by_category": passwords_by_category,
            "recent_activity": recent_activity_data,
            "items_distribution": items_distribution,
            "password_strength_distribution": password_strength_distribution,
            "activities_by_action": activities_by_action,
            "activities_timeline": activities_timeline,
        }

        return Response(stats)

    def _calculate_password_strength(self, passwords_qs):
        """Calcula a distribuição de força das senhas."""
        strength_counts = {"weak": 0, "medium": 0, "strong": 0}

        for password in passwords_qs:
            decrypted_password = password.password
            if not decrypted_password:
                continue

            strength = self._get_password_strength(decrypted_password)
            strength_counts[strength] += 1

        distribution = []
        if strength_counts["weak"] > 0:
            distribution.append(
                {
                    "strength": "weak",
                    "strength_display": "Fraca",
                    "count": strength_counts["weak"],
                }
            )
        if strength_counts["medium"] > 0:
            distribution.append(
                {
                    "strength": "medium",
                    "strength_display": "Média",
                    "count": strength_counts["medium"],
                }
            )
        if strength_counts["strong"] > 0:
            distribution.append(
                {
                    "strength": "strong",
                    "strength_display": "Forte",
                    "count": strength_counts["strong"],
                }
            )

        return distribution

    def _get_password_strength(self, password):
        """Determina a força de uma senha."""
        if len(password) < 8:
            return "weak"

        has_upper = bool(re.search(r"[A-Z]", password))
        has_lower = bool(re.search(r"[a-z]", password))
        has_digit = bool(re.search(r"\d", password))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))

        criteria_met = sum([has_upper, has_lower, has_digit, has_special])

        if len(password) >= 12 and criteria_met >= 3:
            return "strong"
        elif len(password) >= 8 and criteria_met >= 2:
            return "medium"
        else:
            return "weak"


# ============================================================================
# VAULT HEALTH REPORT VIEW
# ============================================================================

OUTDATED_DAYS_THRESHOLD = 90


class VaultHealthReportView(VaultLockedMixin, APIView):
    """
    GET /api/v1/security/passwords/health/

    Analisa as senhas do cofre e retorna um relatório de saúde com:
    - Pontuação geral (0–100)
    - Senhas fracas
    - Senhas duplicadas (por hash SHA-256, sem expor o valor)
    - Senhas desatualizadas (> 90 dias sem troca)
    - Lista de senhas problemáticas

    Requer cofre desbloqueado (VaultLockedMixin).
    Valores descriptografados NUNCA são registrados em log.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        from members.models import Member

        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(self._empty_report())

        passwords_qs = Password.objects.filter(owner=member).only(
            "id",
            "title",
            "username",
            "category",
            "last_password_change",
            "_password",
        )

        passwords = list(passwords_qs)
        total = len(passwords)

        cutoff = timezone.now() - timedelta(days=OUTDATED_DAYS_THRESHOLD)
        category_dict = dict(PASSWORD_CATEGORIES)

        # Analyse each password — decrypted value used only in memory, never
        # logged.
        hash_to_ids: dict[str, list[int]] = {}
        per_password: list[dict] = []

        for pw in passwords:
            decrypted = pw.password  # VaultEncryptedField property
            strength = (
                get_password_strength(decrypted) if decrypted else "weak"
            )
            is_outdated = pw.last_password_change < cutoff

            if decrypted:
                pw_hash = hashlib.sha256(decrypted.encode()).hexdigest()
            else:
                # Treat missing/empty passwords as unique weak entries
                pw_hash = f"empty:{pw.id}"

            hash_to_ids.setdefault(pw_hash, []).append(pw.id)

            per_password.append(
                {
                    "id": pw.id,
                    "title": pw.title,
                    "username": pw.username,
                    "category": pw.category,
                    "category_display": category_dict.get(
                        pw.category, pw.category
                    ),
                    "last_password_change": (
                        pw.last_password_change.isoformat()
                    ),
                    "strength": strength,
                    "is_outdated": is_outdated,
                    "_hash": pw_hash,
                }
            )

        # Determine duplicate groups (only hashes shared by ≥2 passwords)
        duplicate_hashes = {
            h for h, ids in hash_to_ids.items() if len(ids) > 1
        }
        # Assign stable group numbers for the response
        dup_group_map: dict[str, int] = {
            h: i + 1 for i, h in enumerate(sorted(duplicate_hashes))
        }

        # Build problematic list and count issues
        weak_count = 0
        medium_count = 0
        duplicate_count = 0
        outdated_count = 0
        problematic: list[dict] = []

        for entry in per_password:
            issues: list[str] = []
            strength = entry["strength"]

            if strength == "weak":
                weak_count += 1
                issues.append("weak")
            elif strength == "medium":
                medium_count += 1
                issues.append("medium")

            pw_hash = entry["_hash"]
            dup_group = dup_group_map.get(pw_hash)
            if dup_group is not None:
                duplicate_count += 1
                issues.append("duplicate")

            if entry["is_outdated"]:
                outdated_count += 1
                issues.append("outdated")

            if issues:
                problematic.append(
                    {
                        "id": entry["id"],
                        "title": entry["title"],
                        "username": entry["username"],
                        "category": entry["category"],
                        "category_display": entry["category_display"],
                        "last_password_change": entry["last_password_change"],
                        "issues": issues,
                        "duplicate_group": dup_group,
                    }
                )

        score = self._calculate_score(
            total, weak_count, medium_count, duplicate_count, outdated_count
        )

        log_activity(
            request,
            "view",
            "Password",
            None,
            "Consultou relatório de saúde do cofre",
            description_key="vault.health_check",
            description_params={},
        )

        # Analyse stored credit cards
        card_issues: list[dict] = []
        today = timezone.now().date()
        cards_qs = StoredCreditCard.objects.filter(
            owner=member, is_deleted=False
        ).only(
            "id", "uuid", "name", "expiration_month", "expiration_year", "flag"
        )
        for card in cards_qs:
            card_issue_list: list[str] = []
            expiry = date(card.expiration_year, card.expiration_month, 1)
            if expiry < today.replace(day=1):
                card_issue_list.append("expired")
            if card_issue_list:
                card_issues.append(
                    {
                        "id": card.id,
                        "uuid": str(card.uuid),
                        "name": card.name,
                        "flag": card.flag,
                        "expiration_month": card.expiration_month,
                        "expiration_year": card.expiration_year,
                        "issues": card_issue_list,
                    }
                )

        # Analyse stored bank accounts
        account_issues: list[dict] = []
        accounts_qs = StoredBankAccount.objects.filter(
            owner=member, is_deleted=False
        ).only(
            "id",
            "uuid",
            "name",
            "institution_name",
            "_password",
            "_digital_password",
        )
        for acc in accounts_qs:
            acc_issue_list: list[str] = []
            if not acc._password and not acc._digital_password:
                acc_issue_list.append("no_password")
            if acc_issue_list:
                account_issues.append(
                    {
                        "id": acc.id,
                        "uuid": str(acc.uuid),
                        "name": acc.name,
                        "institution_name": acc.institution_name,
                        "issues": acc_issue_list,
                    }
                )

        score = self._calculate_score(
            total,
            weak_count,
            medium_count,
            duplicate_count,
            outdated_count,
            expired_cards=len(card_issues),
        )

        log_activity(
            request,
            "view",
            "Password",
            None,
            "Consultou relatório de saúde do cofre",
            description_key="vault.health_check",
            description_params={},
        )

        return Response(
            {
                "score": score,
                "total_passwords": total,
                "issues_summary": {
                    "weak": weak_count,
                    "medium": medium_count,
                    "duplicate": duplicate_count,
                    "outdated": outdated_count,
                    "expired_cards": len(card_issues),
                    "accounts_without_password": len(account_issues),
                },
                "problematic_passwords": problematic,
                "problematic_cards": card_issues,
                "problematic_accounts": account_issues,
            }
        )

    def _calculate_score(
        self, total, weak, medium, duplicates, outdated, expired_cards=0
    ):
        """
        Calcula pontuação de saúde (0–100).

        Cada senha contribui com pontos base:
          strong = 100  medium = 60  weak = 20

        Penalidades adicionais (acumulativas):
          duplicada  → -20 pts
          desatualizada → -10 pts
          cartão vencido → -15 pts (penalidade fixa por cartão)
        """
        if total == 0 and expired_cards == 0:
            return 100

        if total > 0:
            strong = total - weak - medium
            base_points = strong * 100 + medium * 60 + weak * 20
            penalty = duplicates * 20 + outdated * 10
            total_points = max(0, base_points - penalty)
            max_points = total * 100
            password_score = round(total_points * 100 / max_points)
        else:
            password_score = 100

        card_penalty = min(expired_cards * 15, 30)
        return max(0, password_score - card_penalty)

    def _empty_report(self):
        return {
            "score": 100,
            "total_passwords": 0,
            "issues_summary": {
                "weak": 0,
                "medium": 0,
                "duplicate": 0,
                "outdated": 0,
                "expired_cards": 0,
                "accounts_without_password": 0,
            },
            "problematic_passwords": [],
            "problematic_cards": [],
            "problematic_accounts": [],
        }


def get_password_strength(password):
    """Determina a força de uma senha (standalone function)."""
    if len(password) < 8:
        return "weak"

    has_upper = bool(re.search(r"[A-Z]", password))
    has_lower = bool(re.search(r"[a-z]", password))
    has_digit = bool(re.search(r"\d", password))
    has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))

    criteria_met = sum([has_upper, has_lower, has_digit, has_special])

    if len(password) >= 12 and criteria_met >= 3:
        return "strong"
    elif len(password) >= 8 and criteria_met >= 2:
        return "medium"
    else:
        return "weak"


# ============================================================================
# PASSWORD IMPORT VIEWS
# ============================================================================


class PasswordImportPreviewView(VaultLockedMixin, APIView):
    """
    POST /api/v1/security/passwords/import/preview/

    Parses an export file in-memory and returns a list of entries for the
    user to review before importing. The file is NEVER persisted to disk.

    Request (multipart/form-data):
      file   — the export file
      format — "bitwarden_json" | "lastpass_csv" | "onepassword_csv" |
               "dashlane_csv" | "keepass_xml"

    Response:
    {
        "format": "bitwarden_json",
        "total": 50,
        "duplicates_count": 3,
        "entries": [
            {
                "index": 0,
                "title": "Gmail",
                "username": "user@gmail.com",
                "password": "secret",
                "site": "https://gmail.com",
                "category": "other",
                "notes": "",
                "is_duplicate": false
            }
        ]
    }
    """

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    parser_classes = [MultiPartParser, FormParser]
    queryset = Password.objects.all()  # required by GlobalDefaultPermission

    def post(self, request):
        file = request.FILES.get("file")
        format_name = request.data.get("format", "").strip()

        if not file:
            return Response(
                {"error": "Nenhum arquivo enviado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if format_name not in SUPPORTED_FORMATS:
            return Response(
                {
                    "error": (
                        f"Formato '{format_name}' não suportado. "
                        f"Formatos aceitos: {', '.join(SUPPORTED_FORMATS)}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = file.read()

        try:
            parser_map = {
                "bitwarden_json": parse_bitwarden_json,
                "lastpass_csv": parse_lastpass_csv,
                "onepassword_csv": parse_onepassword_csv,
                "dashlane_csv": parse_dashlane_csv,
                "keepass_xml": parse_keepass_xml,
            }
            entries = parser_map[format_name](content)
        except ImportParseError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        # Duplicate detection against existing passwords for this user
        from members.models import Member

        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = set(
            Password.objects.filter(owner=member).values_list(
                "title", "username"
            )
        )

        tagged_entries = []
        for i, entry in enumerate(entries):
            key = (entry["title"], entry["username"])
            tagged_entries.append(
                {
                    "index": i,
                    "title": entry["title"],
                    "username": entry["username"],
                    "password": entry["password"],
                    "site": entry["site"],
                    "category": entry["category"],
                    "notes": entry["notes"],
                    "is_duplicate": key in existing,
                }
            )

        duplicates_count = sum(1 for e in tagged_entries if e["is_duplicate"])

        return Response(
            {
                "format": format_name,
                "total": len(tagged_entries),
                "duplicates_count": duplicates_count,
                "entries": tagged_entries,
            }
        )


class PasswordImportConfirmView(VaultLockedMixin, APIView):
    """
    POST /api/v1/security/passwords/import/confirm/

    Persists the selected entries, encrypting each password with the
    vault key. Duplicate entries (same title + username) are skipped
    automatically.

    Request (JSON):
    {
        "entries": [
            {
                "title": "Gmail",
                "username": "user@gmail.com",
                "password": "secret",
                "site": "https://gmail.com",
                "category": "other",
                "notes": ""
            }
        ]
    }

    Response:
    { "imported": 47, "duplicates_skipped": 3, "errors": 0 }
    """

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = Password.objects.all()  # required by GlobalDefaultPermission

    def post(self, request):
        entries = request.data.get("entries", [])

        if not isinstance(entries, list) or not entries:
            return Response(
                {"error": "Nenhuma entrada selecionada para importar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from members.models import Member

        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = set(
            Password.objects.filter(owner=member).values_list(
                "title", "username"
            )
        )

        imported = 0
        duplicates_skipped = 0
        errors = 0

        for entry in entries:
            title = str(entry.get("title", "")).strip()
            username = str(entry.get("username", "")).strip()
            password_text = str(entry.get("password", ""))

            if not title or not password_text:
                errors += 1
                continue

            if (title, username) in existing:
                duplicates_skipped += 1
                continue

            try:
                pw = Password(
                    title=title,
                    username=username,
                    site=entry.get("site", "").strip() or None,
                    category=entry.get("category", "other"),
                    notes=entry.get("notes", "").strip() or None,
                    owner=member,
                    created_by=request.user,
                    updated_by=request.user,
                )
                pw.password = (
                    password_text  # VaultEncryptedField setter encrypts
                )
                pw.save()

                # Track within-batch duplicates
                existing.add((title, username))
                imported += 1

                log_activity(
                    request,
                    "create",
                    "Password",
                    pw.id,
                    f"Importou senha: {title}",
                    description_key="password.import",
                    description_params={"name": title},
                )
            except Exception as e:
                logger.error(f"Erro ao importar senha '{title}': {e}")
                errors += 1

        log_activity(
            request,
            "create",
            "Password",
            None,
            (
                f"Importação concluída: {imported} importadas, "
                f"{duplicates_skipped} duplicatas ignoradas, {errors} erros."
            ),
            description_key="password.import_complete",
            description_params={
                "imported": imported,
                "duplicates": duplicates_skipped,
                "errors": errors,
            },
        )

        return Response(
            {
                "imported": imported,
                "duplicates_skipped": duplicates_skipped,
                "errors": errors,
            }
        )


class PasswordGenerateSerializer(serializers.Serializer):
    length = serializers.IntegerField(default=16, min_value=8, max_value=128)
    uppercase = serializers.BooleanField(default=True)
    lowercase = serializers.BooleanField(default=True)
    numbers = serializers.BooleanField(default=True)
    special_characters = serializers.BooleanField(default=True)
    exclude_ambiguous = serializers.BooleanField(default=False)


class PasswordGenerateView(APIView):
    """
    POST /api/v1/security/passwords/generate/

    Gera uma senha criptograficamente segura com opcoes configuraveis.

    Request body:
    {
        "length": 16,           // 8-128, default 16
        "uppercase": true,      // Incluir A-Z
        "lowercase": true,      // Incluir a-z
        "numbers": true,        // Incluir 0-9
        "special_characters": true,  // Incluir !@#$%^&*...
        "exclude_ambiguous": false   // Excluir 0OIl1|
    }

    Response:
    {
        "password": "aB3$xY9!kL2@mN5&",
        "length": 16,
        "strength": "strong"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        length = data["length"]
        use_upper = data["uppercase"]
        use_lower = data["lowercase"]
        use_numbers = data["numbers"]
        use_special = data["special_characters"]
        exclude_ambiguous = data["exclude_ambiguous"]

        # Build character pools
        ambiguous_chars = set("0OIl1|")
        charset = ""
        required_chars = []

        if use_upper:
            pool = string.ascii_uppercase
            if exclude_ambiguous:
                pool = "".join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if use_lower:
            pool = string.ascii_lowercase
            if exclude_ambiguous:
                pool = "".join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if use_numbers:
            pool = string.digits
            if exclude_ambiguous:
                pool = "".join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if use_special:
            pool = "!@#$%^&*()_+-=[]{}|;:,.<>?"
            if exclude_ambiguous:
                pool = "".join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if not charset:
            return Response(
                {"error": "Selecione pelo menos um tipo de caractere."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate remaining characters
        remaining_length = length - len(required_chars)
        if remaining_length < 0:
            remaining_length = 0

        password_chars = required_chars + [
            secrets.choice(charset) for _ in range(remaining_length)
        ]

        # Shuffle to avoid predictable positions of required chars
        password_list = list(password_chars)
        # Fisher-Yates shuffle using secrets
        for i in range(len(password_list) - 1, 0, -1):
            j = secrets.randbelow(i + 1)
            password_list[i], password_list[j] = (
                password_list[j],
                password_list[i],
            )

        generated_password = "".join(password_list)
        strength = get_password_strength(generated_password)

        return Response(
            {
                "password": generated_password,
                "length": len(generated_password),
                "strength": strength,
            }
        )


# ============================================================================
# CREDENTIAL SHARE TOKEN VIEWS
# ============================================================================


class ShareTokenListCreateView(VaultLockedMixin, APIView):
    """
    GET  /api/v1/security/passwords/<pk>/share-tokens/  — lista tokens da senha
    POST /api/v1/security/passwords/<pk>/share-tokens/  — cria novo token

    Requer cofre desbloqueado (VaultLockedMixin) para descriptografar a senha
    e re-criptografá-la com a app key no snapshot do token.
    """

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = Password.objects.all()

    def get(self, request, pk):
        password_obj = get_object_or_404(
            Password, pk=pk, owner__user=request.user
        )
        tokens = CredentialShareToken.objects.filter(password=password_obj)
        serializer = CredentialShareTokenSerializer(tokens, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        password_obj = get_object_or_404(
            Password, pk=pk, owner__user=request.user
        )

        # Decrypt with vault key (already set by VaultLockedMixin)
        plaintext = password_obj.password
        if plaintext is None:
            return Response(
                {"error": "Não foi possível descriptografar a senha."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreateShareTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ttl_hours = serializer.validated_data["ttl_hours"]
        max_uses = serializer.validated_data["max_uses"]
        allowed_ips = serializer.validated_data.get("allowed_ips", [])

        # Generate a random per-token Fernet key.
        # This key is NEVER stored server-side — it is returned to the caller
        # once and must be embedded in the share URL fragment (#key=...) so
        # that only someone who has the full URL can decrypt the snapshot.
        token_key = (
            FieldEncryption.generate_key()
        )  # base64-encoded 32-byte key
        token_key_bytes = token_key.encode()
        encrypted_snapshot = FieldEncryption.encrypt_with_key(
            plaintext, token_key_bytes
        )

        token_obj = CredentialShareToken.objects.create(
            password=password_obj,
            _encrypted_password=encrypted_snapshot,
            expires_at=timezone.now() + timedelta(hours=ttl_hours),
            max_uses=max_uses,
            allowed_ips=allowed_ips,
            created_by=request.user,
        )

        log_activity(
            request,
            "create",
            "CredentialShareToken",
            token_obj.id,
            f"Criou link de compartilhamento para senha: {password_obj.title}",
            description_key="credential_share.create",
            description_params={"name": password_obj.title},
        )

        return Response(
            CredentialShareTokenCreateResponseSerializer(
                token_obj, token_key=token_key
            ).data,
            status=status.HTTP_201_CREATED,
        )


class RevokeShareTokenView(APIView):
    """
    DELETE /api/v1/security/share-tokens/<token_id>/revoke/

    Revoga um token de compartilhamento antes de expirar.
    Apenas o criador do token pode revogá-lo.
    """

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = Password.objects.all()

    def delete(self, request, token_id):
        token_obj = get_object_or_404(
            CredentialShareToken, id=token_id, created_by=request.user
        )
        token_obj.is_revoked = True
        token_obj.save(update_fields=["is_revoked"])

        log_activity(
            request,
            "other",
            "CredentialShareToken",
            token_obj.id,
            f"Revogou link de compartilhamento: {token_obj.password.title}",
            description_key="credential_share.revoke",
            description_params={"name": token_obj.password.title},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class RedeemShareTokenView(APIView):
    """
    POST /api/v1/security/share/<token>/

    Endpoint público (sem autenticação). Recebe a chave de decriptação
    no corpo da requisição (campo ``key``), descriptografa o snapshot e
    retorna a credencial se o token for válido.

    O campo ``key`` é a chave Fernet base64 que foi retornada na criação
    do token e embutida no fragment (#key=...) do link compartilhado.
    O servidor nunca armazena essa chave — sem ela o snapshot é ilegível,
    mesmo com acesso direto ao banco de dados.

    Retorna 410 Gone se o token estiver expirado, revogado ou esgotado.
    Retorna 400 se a chave estiver ausente ou incorreta.
    """

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ShareTokenRateThrottle]

    def post(self, request, token):
        token_key = request.data.get("key", "")
        if not token_key:
            return Response(
                {"error": "Chave de decriptação ausente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token_obj = CredentialShareToken.objects.select_related(
                "password"
            ).get(token=token)
        except CredentialShareToken.DoesNotExist:
            return Response(
                {"error": "Token inválido."}, status=status.HTTP_404_NOT_FOUND
            )

        if not token_obj.is_valid:
            if token_obj.is_revoked:
                reason = "revogado pelo criador"
            elif token_obj.is_expired:
                reason = "expirado"
            else:
                reason = "limite de usos atingido"
            return Response(
                {"error": f"Este link de compartilhamento foi {reason}."},
                status=status.HTTP_410_GONE,
            )

        # IP restriction: if allowed_ips is set, reject any IP not in the list.
        if token_obj.allowed_ips:
            client_ip = get_client_ip(request)
            if client_ip not in token_obj.allowed_ips:
                logger.warning(
                    "Share token IP denied (token_id=%s, ip=%s)",
                    token_obj.id,
                    client_ip,
                )
                return Response(
                    {"error": "Acesso negado a partir deste endereço IP."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Decrypt snapshot using the caller-supplied per-token key.
        # The key is never stored server-side; an incorrect key (or a token
        # created before this security fix) will raise DecryptionError.
        try:
            plaintext = FieldEncryption.decrypt_with_key(
                token_obj._encrypted_password, token_key.encode()
            )
        except DecryptionError:
            logger.warning(
                "Share token decryption failed — wrong key or legacy token "
                "(token_id=%s)",
                token_obj.id,
            )
            return Response(
                {"error": "Chave incorreta ou link inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.error(
                "Unexpected error decrypting share token"
                " snapshot (token_id=%s)",
                token_obj.id,
            )
            return Response(
                {"error": "Erro ao descriptografar a senha."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Update usage tracking before returning (prevents race condition
        # double-use)
        token_obj.use_count += 1
        token_obj.used_at = timezone.now()
        token_obj.save(update_fields=["use_count", "used_at"])

        ActivityLog.log_action(
            user=None,
            action="shared_reveal",
            description=(
                f"Acesso via link compartilhado:"
                f" {token_obj.password.title}"
            ),
            description_key="credential_share.access",
            description_params={"name": token_obj.password.title},
            model_name="CredentialShareToken",
            object_id=token_obj.id,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )

        pw = token_obj.password
        return Response(
            {
                "title": pw.title,
                "username": pw.username,
                "password": plaintext,
                "site": pw.site,
                "category": pw.category,
                "expires_at": token_obj.expires_at,
                "uses_remaining": token_obj.max_uses - token_obj.use_count,
            }
        )


# ============================================================================
# VAULT EXPORT VIEW
# ============================================================================


class VaultExportZipView(VaultLockedMixin, APIView):
    """
    GET /api/v1/security/vault/export/

    Exporta todos os dados do cofre como ZIP:
    - passwords.csv
    - stored_cards.csv
    - stored_accounts.csv
    - archives/<id>_<filename>
      — arquivos reais lidos do storage (MinIO ou local)
    - archives/<id>_<title>.txt
      — conteúdo de texto descriptografado (quando aplicável)

    Requer cofre desbloqueado (VaultLockedMixin).
    Funciona tanto com MinIO (Docker/K8s) quanto com filesystem local (testes).
    """

    # GlobalDefaultPermission is omitted — it requires a queryset/model to
    # derive
    # Django model permissions, but this view aggregates several models and
    # scopes
    # results to request.user. IsAuthenticated + VaultLockedMixin are
    # sufficient.
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _safe_name(value: str) -> str:
        """Remove characters unsafe for ZIP entry names."""
        import re

        return re.sub(r'[\\/*?:"<>|]', "_", value).strip()

    def get(self, request):
        import csv
        import io
        import zipfile

        from django.http import HttpResponse

        from members.models import Member

        try:
            member = Member.objects.get(user=request.user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(
                {"detail": "Perfil de membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        buffer = io.BytesIO()

        with zipfile.ZipFile(
            buffer, mode="w", compression=zipfile.ZIP_DEFLATED
        ) as zf:
            # ------------------------------------------------------------------
            # passwords.csv
            # ------------------------------------------------------------------
            passwords = Password.objects.filter(
                owner=member, is_deleted=False
            ).only(
                "id",
                "title",
                "username",
                "site",
                "category",
                "notes",
                "last_password_change",
                "_password",
            )
            pw_buf = io.StringIO()
            pw_writer = csv.writer(pw_buf)
            pw_writer.writerow(
                [
                    "Título",
                    "Usuário",
                    "Senha",
                    "Site",
                    "Categoria",
                    "Observações",
                    "Última Alteração",
                ]
            )
            for pw in passwords:
                try:
                    decrypted = pw.password or ""
                except Exception:
                    decrypted = "[erro ao descriptografar]"
                pw_writer.writerow(
                    [
                        pw.title,
                        pw.username,
                        decrypted,
                        pw.site or "",
                        pw.category,
                        pw.notes or "",
                        (
                            pw.last_password_change.strftime("%Y-%m-%d")
                            if pw.last_password_change
                            else ""
                        ),
                    ]
                )
            zf.writestr("passwords.csv", pw_buf.getvalue())

            # ------------------------------------------------------------------
            # stored_cards.csv
            # ------------------------------------------------------------------
            cards = StoredCreditCard.objects.filter(
                owner=member, is_deleted=False
            )
            cards_buf = io.StringIO()
            cards_writer = csv.writer(cards_buf)
            cards_writer.writerow(
                [
                    "Nome",
                    "Titular",
                    "Bandeira",
                    "Número do Cartão",
                    "CVV",
                    "Validade",
                    "Observações",
                ]
            )
            for card in cards:
                try:
                    card_number = card.card_number or ""
                except Exception:
                    card_number = "[erro]"
                try:
                    cvv = card.security_code or ""
                except Exception:
                    cvv = "[erro]"
                cards_writer.writerow(
                    [
                        card.name,
                        card.cardholder_name,
                        (
                            card.get_flag_display()
                            if hasattr(card, "get_flag_display")
                            else card.flag
                        ),
                        card_number,
                        cvv,
                        f"{card.expiration_month:02d}/{card.expiration_year}",
                        card.notes or "",
                    ]
                )
            zf.writestr("stored_cards.csv", cards_buf.getvalue())

            # ------------------------------------------------------------------
            # stored_accounts.csv
            # ------------------------------------------------------------------
            accounts = StoredBankAccount.objects.filter(
                owner=member, is_deleted=False
            )
            acc_buf = io.StringIO()
            acc_writer = csv.writer(acc_buf)
            acc_writer.writerow(
                [
                    "Nome",
                    "Instituição",
                    "Tipo",
                    "Agência",
                    "Número da Conta",
                    "Senha",
                    "Senha Digital",
                    "Observações",
                ]
            )
            for acc in accounts:
                try:
                    acc_number = acc.account_number or ""
                except Exception:
                    acc_number = "[erro]"
                try:
                    acc_password = acc.password or ""
                except Exception:
                    acc_password = ""
                try:
                    acc_digital = acc.digital_password or ""
                except Exception:
                    acc_digital = ""
                acc_writer.writerow(
                    [
                        acc.name,
                        acc.institution_name,
                        (
                            acc.get_account_type_display()
                            if hasattr(acc, "get_account_type_display")
                            else acc.account_type
                        ),
                        acc.agency or "",
                        acc_number,
                        acc_password,
                        acc_digital,
                        acc.notes or "",
                    ]
                )
            zf.writestr("stored_accounts.csv", acc_buf.getvalue())

            # ------------------------------------------------------------------
            # archives/ — arquivos reais e conteúdo de texto descriptografado
            # Usa archive.encrypted_file.open("rb") — a abstração de storage do
            # Django funciona tanto com MinIO (Docker/K8s) quanto com
            # filesystem
            # local (testes), sem nenhuma diferença no código.
            # ------------------------------------------------------------------
            archives = Archive.objects.filter(owner=member, is_deleted=False)
            for arch in archives:
                safe_title = self._safe_name(arch.title)
                prefix = f"archives/{arch.id}_{safe_title}"

                if arch.has_file_content():
                    # Arquivo armazenado no storage (MinIO ou local)
                    original_name = (
                        arch.file_name
                        or arch.encrypted_file.name.split("/")[-1]
                    )
                    safe_filename = self._safe_name(original_name)
                    zip_path = f"{prefix}/{safe_filename}"
                    try:
                        with arch.encrypted_file.open("rb") as f:
                            zf.writestr(zip_path, f.read())
                    except Exception:
                        # Arquivo inacessível — registrar placeholder em vez de
                        # abortar o export inteiro
                        zf.writestr(
                            f"{prefix}/ERRO_{safe_filename}.txt",
                            f"Não foi possível recuperar"
                            f" o arquivo: {original_name}\n",
                        )

                if arch.has_text_content():
                    # Conteúdo de texto descriptografado pelo
                    # VaultEncryptedField
                    zip_path = f"{prefix}/{safe_title}.txt"
                    try:
                        text = arch.text_content or ""
                        zf.writestr(zip_path, text.encode("utf-8"))
                    except Exception:
                        zf.writestr(
                            f"{prefix}/ERRO_{safe_title}.txt",
                            "Não foi possível descriptografar"
                            " o conteúdo de texto.\n",
                        )

        buffer.seek(0)
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        filename = f"axiom_vault_{timestamp}.zip"

        response = HttpResponse(buffer.read(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
