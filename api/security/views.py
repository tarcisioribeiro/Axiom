import logging
import re
import secrets
import string
from datetime import timedelta

from rest_framework import generics, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone

logger = logging.getLogger(__name__)
from app.permissions import GlobalDefaultPermission
from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from security.models import (
    Password, StoredCreditCard, StoredBankAccount,
    Archive, PASSWORD_CATEGORIES
)
from security.activity_logs.models import ActivityLog, ACTION_TYPES
from security.serializers import (
    PasswordSerializer, PasswordCreateUpdateSerializer, PasswordRevealSerializer,
    StoredCreditCardSerializer, StoredCreditCardCreateUpdateSerializer, StoredCreditCardRevealSerializer,
    StoredBankAccountSerializer, StoredBankAccountCreateUpdateSerializer, StoredBankAccountRevealSerializer,
    ArchiveSerializer, ArchiveCreateUpdateSerializer, ArchiveRevealSerializer,
    ActivityLogSerializer
)


def get_client_ip(request):
    """Extrai o IP do cliente da requisição."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
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
        user_agent=request.META.get('HTTP_USER_AGENT', '')
    )


# ============================================================================
# PASSWORD VIEWS
# ============================================================================

class PasswordListCreateView(BaseListCreateView):
    """Lista todas as senhas ou cria uma nova."""
    queryset = Password.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campo criptografado na listagem (performance)
        return Password.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner').defer('_password')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PasswordCreateUpdateSerializer
        return PasswordSerializer

    def perform_create(self, serializer):
        password = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )
        log_activity(
            self.request,
            'create',
            'Password',
            password.id,
            f'Criou senha: {password.title}'
        )


class PasswordDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma senha."""
    queryset = Password.objects.all()

    def get_queryset(self):
        return Password.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return PasswordCreateUpdateSerializer
        return PasswordSerializer

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
        # Soft delete
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            'delete',
            'Password',
            instance.id,
            f'Deletou senha: {instance.title}'
        )


class PasswordRevealView(generics.RetrieveAPIView):
    """Revela a senha descriptografada (com log de auditoria)."""
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = PasswordRevealSerializer
    queryset = Password.objects.all()

    def get_queryset(self):
        return Password.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        # Log da revelação
        log_activity(
            request,
            'reveal',
            'Password',
            instance.id,
            f'Revelou senha: {instance.title}'
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ============================================================================
# STORED CREDIT CARD VIEWS
# ============================================================================

class StoredCreditCardListCreateView(BaseListCreateView):
    """Lista todos os cartões ou cria um novo."""
    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campos criptografados na listagem (performance)
        return StoredCreditCard.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner', 'finance_card').defer('_card_number', '_security_code')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StoredCreditCardCreateUpdateSerializer
        return StoredCreditCardSerializer

    def perform_create(self, serializer):
        card = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )
        log_activity(
            self.request,
            'create',
            'StoredCreditCard',
            card.id,
            f'Criou cartão: {card.name}'
        )


class StoredCreditCardDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um cartão."""
    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        return StoredCreditCard.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner', 'finance_card')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StoredCreditCardCreateUpdateSerializer
        return StoredCreditCardSerializer

    def perform_update(self, serializer):
        card = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            'update',
            'StoredCreditCard',
            card.id,
            f'Atualizou cartão: {card.name}'
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            'delete',
            'StoredCreditCard',
            instance.id,
            f'Deletou cartão: {instance.name}'
        )


class StoredCreditCardRevealView(generics.RetrieveAPIView):
    """Revela dados completos do cartão (com log de auditoria)."""
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = StoredCreditCardRevealSerializer
    queryset = StoredCreditCard.objects.all()

    def get_queryset(self):
        return StoredCreditCard.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            'reveal',
            'StoredCreditCard',
            instance.id,
            f'Revelou dados do cartão: {instance.name}'
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ============================================================================
# STORED BANK ACCOUNT VIEWS
# ============================================================================

class StoredBankAccountListCreateView(BaseListCreateView):
    """Lista todas as contas bancárias ou cria uma nova."""
    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campos criptografados na listagem (performance)
        return StoredBankAccount.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner', 'finance_account').defer(
            '_account_number', '_password', '_digital_password'
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StoredBankAccountCreateUpdateSerializer
        return StoredBankAccountSerializer

    def perform_create(self, serializer):
        account = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )
        log_activity(
            self.request,
            'create',
            'StoredBankAccount',
            account.id,
            f'Criou conta bancária: {account.name}'
        )


class StoredBankAccountDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma conta bancária."""
    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        return StoredBankAccount.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner', 'finance_account')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StoredBankAccountCreateUpdateSerializer
        return StoredBankAccountSerializer

    def perform_update(self, serializer):
        account = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            'update',
            'StoredBankAccount',
            account.id,
            f'Atualizou conta bancária: {account.name}'
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            'delete',
            'StoredBankAccount',
            instance.id,
            f'Deletou conta bancária: {instance.name}'
        )


class StoredBankAccountRevealView(generics.RetrieveAPIView):
    """Revela dados completos da conta bancária (com log de auditoria)."""
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = StoredBankAccountRevealSerializer
    queryset = StoredBankAccount.objects.all()

    def get_queryset(self):
        return StoredBankAccount.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            'reveal',
            'StoredBankAccount',
            instance.id,
            f'Revelou dados da conta: {instance.name}'
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ============================================================================
# ARCHIVE VIEWS
# ============================================================================

class ArchiveListCreateView(BaseListCreateView):
    """Lista todos os arquivos ou cria um novo."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Archive.objects.all()

    def get_queryset(self):
        # Usa defer() para excluir campo criptografado na listagem (performance)
        return Archive.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner').defer('_encrypted_text')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ArchiveCreateUpdateSerializer
        return ArchiveSerializer

    def perform_create(self, serializer):
        try:
            archive = serializer.save(
                created_by=self.request.user,
                updated_by=self.request.user
            )
        except PermissionError:
            logger.error("Permissão negada ao salvar arquivo em /app/media/security/")
            raise serializers.ValidationError({
                'encrypted_file': (
                    'Erro de permissão ao salvar o arquivo no servidor. '
                    'O diretório de armazenamento não possui permissão de escrita. '
                    'Contate o administrador do sistema.'
                )
            })
        except OSError as e:
            logger.error(f"Erro de I/O ao salvar arquivo: {e}")
            raise serializers.ValidationError({
                'encrypted_file': (
                    f'Erro ao salvar o arquivo no servidor: {e.strerror}. '
                    'Contate o administrador do sistema.'
                )
            })
        log_activity(
            self.request,
            'create',
            'Archive',
            archive.id,
            f'Criou arquivo: {archive.title}'
        )


class ArchiveDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um arquivo."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Archive.objects.all()

    def get_queryset(self):
        return Archive.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        ).select_related('owner')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ArchiveCreateUpdateSerializer
        return ArchiveSerializer

    def perform_update(self, serializer):
        try:
            archive = serializer.save(updated_by=self.request.user)
        except PermissionError:
            logger.error("Permissão negada ao atualizar arquivo em /app/media/security/")
            raise serializers.ValidationError({
                'encrypted_file': (
                    'Erro de permissão ao salvar o arquivo no servidor. '
                    'O diretório de armazenamento não possui permissão de escrita. '
                    'Contate o administrador do sistema.'
                )
            })
        except OSError as e:
            logger.error(f"Erro de I/O ao atualizar arquivo: {e}")
            raise serializers.ValidationError({
                'encrypted_file': (
                    f'Erro ao salvar o arquivo no servidor: {e.strerror}. '
                    'Contate o administrador do sistema.'
                )
            })
        log_activity(
            self.request,
            'update',
            'Archive',
            archive.id,
            f'Atualizou arquivo: {archive.title}'
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            'delete',
            'Archive',
            instance.id,
            f'Deletou arquivo: {instance.title}'
        )


class ArchiveRevealView(generics.RetrieveAPIView):
    """Revela conteúdo de texto do arquivo (com log de auditoria)."""
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = ArchiveRevealSerializer
    queryset = Archive.objects.all()

    def get_queryset(self):
        return Archive.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        log_activity(
            request,
            'reveal',
            'Archive',
            instance.id,
            f'Revelou conteúdo do arquivo: {instance.title}'
        )

        response_data = {
            'id': instance.id,
            'title': instance.title,
            'text_content': None,
            'error': None,
            'error_type': None,
        }

        if not instance._encrypted_text:
            response_data['error'] = 'Este arquivo não possui conteúdo de texto armazenado.'
            response_data['error_type'] = 'no_content'
            return Response(response_data)

        try:
            from app.encryption import FieldEncryption
            decrypted = FieldEncryption.decrypt_data(instance._encrypted_text)
            if decrypted is None:
                response_data['error'] = (
                    'Não foi possível descriptografar o conteúdo. '
                    'A chave de criptografia pode ter sido alterada.'
                )
                response_data['error_type'] = 'decryption_failed'
            else:
                response_data['text_content'] = decrypted
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erro ao descriptografar arquivo {instance.id}: {str(e)}")
            response_data['error'] = (
                'Não foi possível descriptografar o conteúdo. '
                'Verifique se a chave de criptografia (ENCRYPTION_KEY) está correta.'
            )
            response_data['error_type'] = 'decryption_failed'

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
                pk=pk,
                owner__user=request.user,
                deleted_at__isnull=True
            )
        except Archive.DoesNotExist:
            return Response(
                {'error': 'Arquivo não encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not archive.encrypted_file:
            return Response(
                {'error': 'Este arquivo não possui um arquivo anexado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Log da atividade
        log_activity(
            request,
            'download',
            'Archive',
            archive.id,
            f'Fez download do arquivo: {archive.title}'
        )

        # Retornar o arquivo via streaming (proxy through Django to avoid CORS)
        from django.http import FileResponse
        import mimetypes

        try:
            file = archive.encrypted_file.open('rb')
        except Exception:
            return Response(
                {'error': 'Arquivo não encontrado no sistema de arquivos'},
                status=status.HTTP_404_NOT_FOUND
            )

        filename = archive.file_name or archive.encrypted_file.name.split('/')[-1]
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            content_type = 'application/octet-stream'

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

class ActivityLogListView(generics.ListAPIView):
    """Lista logs de atividades (somente leitura)."""
    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = ActivityLogSerializer
    queryset = ActivityLog.objects.all()

    def get_queryset(self):
        return ActivityLog.objects.filter(
            user=self.request.user
        ).order_by('-created_at')


# ============================================================================
# SECURITY DASHBOARD VIEWS
# ============================================================================

class SecurityDashboardStatsView(APIView):
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
            return Response({
                'total_passwords': 0,
                'total_stored_cards': 0,
                'total_stored_accounts': 0,
                'total_archives': 0,
                'passwords_by_category': [],
                'recent_activity': [],
                'items_distribution': [],
                'password_strength_distribution': [],
                'activities_by_action': [],
                'activities_timeline': []
            })

        # Querysets filtrados por owner e não deletados
        passwords_qs = Password.objects.filter(
            owner=member,
            deleted_at__isnull=True
        )
        stored_cards_qs = StoredCreditCard.objects.filter(
            owner=member,
            deleted_at__isnull=True
        )
        stored_accounts_qs = StoredBankAccount.objects.filter(
            owner=member,
            deleted_at__isnull=True
        )
        archives_qs = Archive.objects.filter(
            owner=member,
            deleted_at__isnull=True
        )

        # Contadores
        total_passwords = passwords_qs.count()
        total_stored_cards = stored_cards_qs.count()
        total_stored_accounts = stored_accounts_qs.count()
        total_archives = archives_qs.count()

        # Senhas por categoria (Top 5)
        passwords_by_category = list(
            passwords_qs
            .values('category')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )

        # Adicionar display name das categorias
        category_dict = dict(PASSWORD_CATEGORIES)
        for item in passwords_by_category:
            item['category_display'] = category_dict.get(item['category'], item['category'])

        # Distribuição de tipos de itens (para gráfico de pizza)
        items_distribution = []
        if total_passwords > 0:
            items_distribution.append({
                'type': 'passwords',
                'type_display': 'Senhas',
                'count': total_passwords
            })
        if total_stored_cards > 0:
            items_distribution.append({
                'type': 'cards',
                'type_display': 'Cartões',
                'count': total_stored_cards
            })
        if total_stored_accounts > 0:
            items_distribution.append({
                'type': 'accounts',
                'type_display': 'Contas',
                'count': total_stored_accounts
            })
        if total_archives > 0:
            items_distribution.append({
                'type': 'archives',
                'type_display': 'Arquivos',
                'count': total_archives
            })

        # Análise de força de senhas
        password_strength_distribution = self._calculate_password_strength(passwords_qs)

        # Atividades por tipo de ação
        security_models = ['Password', 'StoredCreditCard', 'StoredBankAccount', 'Archive']
        activities_by_action = list(
            ActivityLog.objects.filter(
                user=user,
                model_name__in=security_models
            )
            .values('action')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        action_dict = dict(ACTION_TYPES)
        for item in activities_by_action:
            item['action_display'] = action_dict.get(item['action'], item['action'])

        # Timeline de atividades (últimos 6 meses)
        six_months_ago = timezone.now() - timedelta(days=180)
        activities_timeline = list(
            ActivityLog.objects.filter(
                user=user,
                model_name__in=security_models,
                created_at__gte=six_months_ago
            )
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )

        for item in activities_timeline:
            item['month'] = item['month'].strftime('%Y-%m')

        # Atividades recentes (últimas 10)
        recent_activity = ActivityLog.objects.filter(
            user=user,
            model_name__in=security_models
        ).order_by('-created_at')[:10]

        recent_activity_data = []
        for log in recent_activity:
            recent_activity_data.append({
                'action': log.action,
                'action_display': action_dict.get(log.action, log.action),
                'model_name': log.model_name,
                'description': log.description,
                'created_at': log.created_at.isoformat()
            })

        stats = {
            'total_passwords': total_passwords,
            'total_stored_cards': total_stored_cards,
            'total_stored_accounts': total_stored_accounts,
            'total_archives': total_archives,
            'passwords_by_category': passwords_by_category,
            'recent_activity': recent_activity_data,
            'items_distribution': items_distribution,
            'password_strength_distribution': password_strength_distribution,
            'activities_by_action': activities_by_action,
            'activities_timeline': activities_timeline
        }

        return Response(stats)

    def _calculate_password_strength(self, passwords_qs):
        """Calcula a distribuição de força das senhas."""
        strength_counts = {'weak': 0, 'medium': 0, 'strong': 0}

        for password in passwords_qs:
            decrypted_password = password.password
            if not decrypted_password:
                continue

            strength = self._get_password_strength(decrypted_password)
            strength_counts[strength] += 1

        distribution = []
        if strength_counts['weak'] > 0:
            distribution.append({
                'strength': 'weak',
                'strength_display': 'Fraca',
                'count': strength_counts['weak']
            })
        if strength_counts['medium'] > 0:
            distribution.append({
                'strength': 'medium',
                'strength_display': 'Média',
                'count': strength_counts['medium']
            })
        if strength_counts['strong'] > 0:
            distribution.append({
                'strength': 'strong',
                'strength_display': 'Forte',
                'count': strength_counts['strong']
            })

        return distribution

    def _get_password_strength(self, password):
        """Determina a força de uma senha."""
        if len(password) < 8:
            return 'weak'

        has_upper = bool(re.search(r'[A-Z]', password))
        has_lower = bool(re.search(r'[a-z]', password))
        has_digit = bool(re.search(r'\d', password))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))

        criteria_met = sum([has_upper, has_lower, has_digit, has_special])

        if len(password) >= 12 and criteria_met >= 3:
            return 'strong'
        elif len(password) >= 8 and criteria_met >= 2:
            return 'medium'
        else:
            return 'weak'


def get_password_strength(password):
    """Determina a força de uma senha (standalone function)."""
    if len(password) < 8:
        return 'weak'

    has_upper = bool(re.search(r'[A-Z]', password))
    has_lower = bool(re.search(r'[a-z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))

    criteria_met = sum([has_upper, has_lower, has_digit, has_special])

    if len(password) >= 12 and criteria_met >= 3:
        return 'strong'
    elif len(password) >= 8 and criteria_met >= 2:
        return 'medium'
    else:
        return 'weak'


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

        length = data['length']
        use_upper = data['uppercase']
        use_lower = data['lowercase']
        use_numbers = data['numbers']
        use_special = data['special_characters']
        exclude_ambiguous = data['exclude_ambiguous']

        # Build character pools
        ambiguous_chars = set('0OIl1|')
        charset = ''
        required_chars = []

        if use_upper:
            pool = string.ascii_uppercase
            if exclude_ambiguous:
                pool = ''.join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if use_lower:
            pool = string.ascii_lowercase
            if exclude_ambiguous:
                pool = ''.join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if use_numbers:
            pool = string.digits
            if exclude_ambiguous:
                pool = ''.join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if use_special:
            pool = '!@#$%^&*()_+-=[]{}|;:,.<>?'
            if exclude_ambiguous:
                pool = ''.join(c for c in pool if c not in ambiguous_chars)
            charset += pool
            required_chars.append(secrets.choice(pool))

        if not charset:
            return Response(
                {'error': 'Selecione pelo menos um tipo de caractere.'},
                status=status.HTTP_400_BAD_REQUEST
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

        generated_password = ''.join(password_list)
        strength = get_password_strength(generated_password)

        return Response({
            'password': generated_password,
            'length': len(generated_password),
            'strength': strength,
        })
