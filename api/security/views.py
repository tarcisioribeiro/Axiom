import hashlib
import logging
import re
import secrets
import string
from datetime import timedelta

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
from app.encryption import FieldEncryption
from app.permissions import GlobalDefaultPermission
from authentication.throttles import ShareTokenRateThrottle
from security.activity_logs.models import ACTION_TYPES, ActivityLog
from security.models import (
    PASSWORD_CATEGORIES,
    Archive,
    CredentialShareToken,
    Password,
    StoredBankAccount,
    StoredCreditCard,
)
from security.passwords.importers import (
    SUPPORTED_FORMATS,
    ImportParseError,
    parse_bitwarden_json,
    parse_lastpass_csv,
)
from security.serializers import (
    ActivityLogSerializer,
    ArchiveCreateUpdateSerializer,
    ArchiveRevealSerializer,
    ArchiveSerializer,
    CreateShareTokenSerializer,
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
    """Extrai o IP do cliente da requisição."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip


def log_activity(request, action, model_name, object_id, description):
    """Helper para registrar atividades."""
    ActivityLog.log_action(
        user=request.user,
        action=action,
        description=description,
        model_name=model_name,
        object_id=object_id,
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
        # Usa defer() para excluir campo criptografado na listagem (performance)
        return (
            Password.objects.filter(owner__user=self.request.user, is_deleted=False)
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
        )


class PasswordDetailView(VaultLockedMixin, BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma senha."""

    queryset = Password.objects.all()

    def get_queryset(self):
        return Password.objects.filter(
            owner__user=self.request.user, is_deleted=False
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
        )


class PasswordRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela a senha descriptografada (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = PasswordRevealSerializer
    queryset = Password.objects.all()

    def get_queryset(self):
        return Password.objects.filter(owner__user=self.request.user, is_deleted=False)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        # Log da revelação
        log_activity(
            request,
            "reveal",
            "Password",
            instance.id,
            f"Revelou senha: {instance.title}",
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
        # Usa defer() para excluir campos criptografados na listagem (performance)
        return (
            StoredCreditCard.objects.filter(
                owner__user=self.request.user, is_deleted=False
            )
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
        )


class StoredCreditCardDetailView(VaultLockedMixin, BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um cartão."""

    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        return StoredCreditCard.objects.filter(
            owner__user=self.request.user, is_deleted=False
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
        )


class StoredCreditCardRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela dados completos do cartão (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = StoredCreditCardRevealSerializer
    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        return StoredCreditCard.objects.filter(
            owner__user=self.request.user, is_deleted=False
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "StoredCreditCard",
            instance.id,
            f"Revelou dados do cartão: {instance.name}",
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
        # Usa defer() para excluir campos criptografados na listagem (performance)
        return (
            StoredBankAccount.objects.filter(
                owner__user=self.request.user, is_deleted=False
            )
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
        )


class StoredBankAccountDetailView(VaultLockedMixin, BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma conta bancária."""

    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        return StoredBankAccount.objects.filter(
            owner__user=self.request.user, is_deleted=False
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
        )


class StoredBankAccountRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela dados completos da conta bancária (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = StoredBankAccountRevealSerializer
    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        return StoredBankAccount.objects.filter(
            owner__user=self.request.user, is_deleted=False
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "StoredBankAccount",
            instance.id,
            f"Revelou dados da conta: {instance.name}",
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
        # Usa defer() para excluir campo criptografado na listagem (performance)
        return (
            Archive.objects.filter(owner__user=self.request.user, is_deleted=False)
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
            logger.error("Permissão negada ao salvar arquivo em /app/media/security/")
            raise serializers.ValidationError(
                {
                    "encrypted_file": (
                        "Erro de permissão ao salvar o arquivo no servidor. "
                        "O diretório de armazenamento não possui permissão de escrita. "
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
                        "Erro de permissão ao salvar o arquivo no servidor. "
                        "O diretório de armazenamento não possui permissão de escrita. "
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
        )


class ArchiveRevealView(VaultLockedMixin, generics.RetrieveAPIView):
    """Revela conteúdo de texto do arquivo (com log de auditoria)."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = ArchiveRevealSerializer
    queryset = Archive.objects.all()

    def get_queryset(self):
        return Archive.objects.filter(owner__user=self.request.user, is_deleted=False)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            "reveal",
            "Archive",
            instance.id,
            f"Revelou conteúdo do arquivo: {instance.title}",
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
            # Usa VaultEncryptedField via propriedade text_content, que já aplica
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
            logger.error(f"Erro ao descriptografar arquivo {instance.id}: {str(e)}")
            response_data["error"] = (
                "Não foi possível descriptografar o conteúdo. "
                "Verifique se a chave de criptografia está correta."
            )
            response_data["error_type"] = "decryption_failed"

        return Response(response_data)


class ArchiveDownloadView(APIView):
    """Faz download do arquivo criptografado."""

    permission_classes = [IsAuthenticated]
    # Note: GlobalDefaultPermission removed because APIView doesn't have queryset
    # Security is handled by filtering on owner__user in the query below

    def get(self, request, pk):
        """Download do arquivo criptografado."""
        try:
            archive = Archive.objects.get(
                pk=pk, owner__user=request.user, is_deleted=False
            )
        except Archive.DoesNotExist:
            return Response(
                {"error": "Arquivo não encontrado"}, status=status.HTTP_404_NOT_FOUND
            )

        if not archive.encrypted_file:
            return Response(
                {"error": "Este arquivo não possui um arquivo anexado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Log da atividade
        log_activity(
            request,
            "download",
            "Archive",
            archive.id,
            f"Fez download do arquivo: {archive.title}",
        )

        # Retornar o arquivo via streaming (proxy through Django to avoid CORS)
        import mimetypes

        from django.http import FileResponse

        try:
            file = archive.encrypted_file.open("rb")
        except Exception:
            return Response(
                {"error": "Arquivo não encontrado no sistema de arquivos"},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = archive.file_name or archive.encrypted_file.name.split("/")[-1]
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            content_type = "application/octet-stream"

        response = FileResponse(
            file,
            as_attachment=True,
            filename=filename,
            content_type=content_type,
        )
        return response


# ============================================================================
# ACTIVITY LOG VIEWS
# ============================================================================


class ActivityLogListView(VaultLockedMixin, generics.ListAPIView):
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
            {"category": "social", "category_display": "Redes Sociais", "count": 5},
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
            member = Member.objects.get(user=user, is_deleted=False)
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
        passwords_qs = Password.objects.filter(owner=member, is_deleted=False)
        stored_cards_qs = StoredCreditCard.objects.filter(
            owner=member, is_deleted=False
        )
        stored_accounts_qs = StoredBankAccount.objects.filter(
            owner=member, is_deleted=False
        )
        archives_qs = Archive.objects.filter(owner=member, is_deleted=False)

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
        password_strength_distribution = self._calculate_password_strength(passwords_qs)

        # Atividades por tipo de ação
        security_models = [
            "Password",
            "StoredCreditCard",
            "StoredBankAccount",
            "Archive",
        ]
        activities_by_action = list(
            ActivityLog.objects.filter(user=user, model_name__in=security_models)
            .values("action")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        action_dict = dict(ACTION_TYPES)
        for item in activities_by_action:
            item["action_display"] = action_dict.get(item["action"], item["action"])

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
            member = Member.objects.get(user=request.user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(self._empty_report())

        passwords_qs = Password.objects.filter(owner=member, is_deleted=False).only(
            "id",
            "title",
            "username",
            "category",
            "last_password_change",
            "_password",
        )

        passwords = list(passwords_qs)
        total = len(passwords)

        if total == 0:
            return Response(self._empty_report())

        cutoff = timezone.now() - timedelta(days=OUTDATED_DAYS_THRESHOLD)
        category_dict = dict(PASSWORD_CATEGORIES)

        # Analyse each password — decrypted value used only in memory, never logged.
        hash_to_ids: dict[str, list[int]] = {}
        per_password: list[dict] = []

        for pw in passwords:
            decrypted = pw.password  # VaultEncryptedField property
            strength = get_password_strength(decrypted) if decrypted else "weak"
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
                    "category_display": category_dict.get(pw.category, pw.category),
                    "last_password_change": pw.last_password_change.isoformat(),
                    "strength": strength,
                    "is_outdated": is_outdated,
                    "_hash": pw_hash,
                }
            )

        # Determine duplicate groups (only hashes shared by ≥2 passwords)
        duplicate_hashes = {h for h, ids in hash_to_ids.items() if len(ids) > 1}
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
                },
                "problematic_passwords": problematic,
            }
        )

    def _calculate_score(self, total, weak, medium, duplicates, outdated):
        """
        Calcula pontuação de saúde (0–100).

        Cada senha contribui com pontos base:
          strong = 100  medium = 60  weak = 20

        Penalidades adicionais (acumulativas):
          duplicada  → -20 pts
          desatualizada → -10 pts
        """
        if total == 0:
            return 100

        strong = total - weak - medium
        base_points = strong * 100 + medium * 60 + weak * 20
        penalty = duplicates * 20 + outdated * 10
        total_points = max(0, base_points - penalty)
        max_points = total * 100
        return round(total_points * 100 / max_points)

    def _empty_report(self):
        return {
            "score": 100,
            "total_passwords": 0,
            "issues_summary": {"weak": 0, "medium": 0, "duplicate": 0, "outdated": 0},
            "problematic_passwords": [],
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

    Parses an export file (Bitwarden JSON or LastPass CSV) in-memory and
    returns a list of entries for the user to review before importing.
    The file is NEVER persisted to disk.

    Request (multipart/form-data):
      file   — the export file
      format — "bitwarden_json" or "lastpass_csv"

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
            if format_name == "bitwarden_json":
                entries = parse_bitwarden_json(content)
            else:
                entries = parse_lastpass_csv(content)
        except ImportParseError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        # Duplicate detection against existing passwords for this user
        from members.models import Member

        try:
            member = Member.objects.get(user=request.user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = set(
            Password.objects.filter(owner=member, is_deleted=False).values_list(
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
            member = Member.objects.get(user=request.user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = set(
            Password.objects.filter(owner=member, is_deleted=False).values_list(
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
                pw.password = password_text  # VaultEncryptedField setter encrypts
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
            password_list[i], password_list[j] = password_list[j], password_list[i]

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
            Password, pk=pk, owner__user=request.user, is_deleted=False
        )
        tokens = CredentialShareToken.objects.filter(password=password_obj)
        serializer = CredentialShareTokenSerializer(tokens, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        password_obj = get_object_or_404(
            Password, pk=pk, owner__user=request.user, is_deleted=False
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

        # Re-encrypt with app key as a snapshot (vault-key-independent)
        encrypted_snapshot = FieldEncryption.encrypt_data(plaintext)

        token_obj = CredentialShareToken.objects.create(
            password=password_obj,
            _encrypted_password=encrypted_snapshot,
            expires_at=timezone.now() + timedelta(hours=ttl_hours),
            max_uses=max_uses,
            created_by=request.user,
        )

        log_activity(
            request,
            "create",
            "CredentialShareToken",
            token_obj.id,
            f"Criou link de compartilhamento para senha: {password_obj.title}",
        )

        return Response(
            CredentialShareTokenSerializer(token_obj).data,
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
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class RedeemShareTokenView(APIView):
    """
    GET /api/v1/security/share/<token>/

    Endpoint público (sem autenticação). Descriptografa e retorna a
    credencial se o token for válido. Registra acesso no ActivityLog.

    Retorna 410 Gone se o token estiver expirado, revogado ou esgotado.
    """

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ShareTokenRateThrottle]

    def get(self, request, token):
        try:
            token_obj = CredentialShareToken.objects.select_related("password").get(
                token=token
            )
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

        # Decrypt with app key (snapshot stored at token creation)
        try:
            plaintext = FieldEncryption.decrypt_data(token_obj._encrypted_password)
        except Exception:
            logger.error(
                "Failed to decrypt share token snapshot (token_id=%s)", token_obj.id
            )
            return Response(
                {"error": "Erro ao descriptografar a senha."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Update usage tracking before returning (prevents race condition double-use)
        token_obj.use_count += 1
        token_obj.used_at = timezone.now()
        token_obj.save(update_fields=["use_count", "used_at"])

        ActivityLog.log_action(
            user=None,
            action="shared_reveal",
            description=f"Acesso via link compartilhado: {token_obj.password.title}",
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
