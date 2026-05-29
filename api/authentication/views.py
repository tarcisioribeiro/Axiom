# views.py
import re
from typing import cast

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from app.config import cfg

from .throttles import RegisterRateThrottle


def validate_cpf(cpf: str) -> bool:
    """Valida CPF brasileiro."""
    cpf = re.sub(r"[^0-9]", "", cpf)
    if len(cpf) != 11:
        return False
    if cpf == cpf[0] * 11:
        return False
    # Calcula primeiro digito verificador
    soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
    resto = (soma * 10) % 11
    if resto == 10:
        resto = 0
    if resto != int(cpf[9]):
        return False
    # Calcula segundo digito verificador
    soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
    resto = (soma * 10) % 11
    if resto == 10:
        resto = 0
    return resto == int(cpf[10])


def validate_registration_data(data: dict) -> tuple[bool, list[str]]:
    """
    Valida dados de registro de usuario.
    Retorna (is_valid, list_of_errors).
    """
    errors = []

    username = data.get("username", "")
    password = data.get("password", "")
    name = data.get("name", "")
    document = data.get("document", "")
    phone = data.get("phone", "")
    email = data.get("email", "")

    # Validar campos obrigatorios
    if not username:
        errors.append("Username e obrigatorio")
    if not password:
        errors.append("Senha e obrigatoria")
    if not name:
        errors.append("Nome e obrigatorio")
    if not document:
        errors.append("Documento e obrigatorio")
    if not phone:
        errors.append("Telefone e obrigatorio")

    # Validar username (alfanumerico, 3-30 caracteres)
    if username:
        if len(username) < 3 or len(username) > 30:
            errors.append("Username deve ter entre 3 e 30 caracteres")
        if not re.match(r"^[a-zA-Z0-9_]+$", username):
            errors.append(
                "Username deve conter apenas letras, numeros e underscore"
            )

    # Validar senha usando validators do Django
    if password:
        try:
            validate_password(password)
        except DjangoValidationError as e:
            errors.extend(e.messages)

    # Validar nome (2-100 caracteres)
    if name:
        if len(name) < 2 or len(name) > 100:
            errors.append("Nome deve ter entre 2 e 100 caracteres")

    # Validar documento (CPF)
    if document:
        if not validate_cpf(document):
            errors.append("CPF invalido")

    # Validar telefone (formato brasileiro)
    if phone:
        phone_clean = re.sub(r"[^0-9]", "", phone)
        if len(phone_clean) < 10 or len(phone_clean) > 11:
            errors.append("Telefone deve ter 10 ou 11 digitos")

    # Validar email (se fornecido)
    if email:
        try:
            validate_email(email)
        except DjangoValidationError:
            errors.append("Email invalido")

    return (len(errors) == 0, errors)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_current_user(request: Request) -> Response:
    """
    GET /api/v1/me/

    Retorna dados completos do usuário autenticado incluindo:
    - Informações do User (Django)
    - Informações do Member vinculado (se existir)
    - Permissões do usuário

    FEAT-01: Endpoint centralizado para dados do usuário.
    """
    from members.models import Member

    user = cast(User, request.user)

    # Buscar membro vinculado
    try:
        member = Member.objects.get(user=user)
        member_data = {
            "id": member.id,
            "name": member.name,
            "document": member.document,
            "phone": member.phone,
            "email": member.email,
            "sex": member.sex,
            "is_creditor": member.is_creditor,
            "is_benefited": member.is_benefited,
            "active": member.active,
            "email_verified": member.email_verified,
        }
    except Member.DoesNotExist:
        member_data = None

    # Permissões do usuário
    perms = user.get_all_permissions()

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_active": user.is_active,
            "date_joined": user.date_joined,
            "permissions": list(perms),
            "member": member_data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_permissions(request: Request) -> Response:
    user = request.user

    # Superusuários devem usar o Django Admin — bloqueados neste endpoint
    if user.is_superuser:
        return Response(
            {"detail": "Superusuários não têm acesso a este endpoint."},
            status=status.HTTP_403_FORBIDDEN,
        )

    perms = user.get_all_permissions()
    return Response(
        {
            "username": user.username,
            "permissions": list(perms),
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_available_users(request: Request) -> Response:
    """
    Retorna lista de usuários disponíveis para vinculação com membros.
    Exclui superusuários e usuários já vinculados a membros.
    """
    from members.models import Member

    # Pega IDs de usuários já vinculados a membros
    linked_user_ids = Member.objects.filter(user__isnull=False).values_list(
        "user_id", flat=True
    )

    # Lista usuários não superusuários e não vinculados
    available_users = (
        User.objects.filter(is_superuser=False, is_active=True)
        .exclude(id__in=linked_user_ids)
        .values("id", "username", "first_name", "last_name", "email")
    )

    return Response(list(available_users))


@api_view(["POST"])
@throttle_classes([RegisterRateThrottle])
def create_user_with_member(request: Request) -> Response:
    """
    Cria um novo usuário e o vincula a um membro.
    Endpoint público para registro de novos usuários.
    """
    import logging

    from django.db import transaction

    from members.models import Member, compute_document_hash

    logger = logging.getLogger("expenselit.audit")

    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")
    name = request.data.get("name", "").strip()
    document = request.data.get("document", "").strip()
    phone = request.data.get("phone", "").strip()
    email = request.data.get("email", "").strip()

    # Validacoes completas
    is_valid, validation_errors = validate_registration_data(request.data)
    if not is_valid:
        return Response(
            {"error": "Dados invalidos", "details": validation_errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verifica duplicidade (mensagem generica para evitar enumeracao)
    # Usa mesma mensagem para username e documento para nao revelar qual existe
    username_exists = User.objects.filter(username=username).exists()
    document_clean = re.sub(r"[^0-9]", "", document)
    document_exists = Member.objects.filter(
        document_hash=compute_document_hash(document_clean)
    ).exists()

    if username_exists or document_exists:
        # Log interno para auditoria (nao exposto ao usuario)
        if username_exists:
            logger.warning(
                f"Tentativa de registro com username duplicado: {username}"
            )
        if document_exists:
            logger.warning("Tentativa de registro com documento duplicado")
        return Response(
            {"error": "Usuario ou documento ja cadastrado"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        with transaction.atomic():
            # Cria o usuario
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email or "",
                first_name=name.split()[0] if name else "",
                last_name=(
                    " ".join(name.split()[1:]) if len(name.split()) > 1 else ""
                ),
                is_superuser=False,
                is_staff=False,
                is_active=True,
            )

            # Adiciona usuario ao grupo members
            from django.contrib.auth.models import Group

            try:
                members_group = Group.objects.get(name="members")
                user.groups.add(members_group)
            except Group.DoesNotExist:
                logger.warning(
                    "Group 'members' not found during"
                    " registration of user '%s'. "
                    "Run 'python manage.py setup_permissions' to create it.",
                    username,
                )

            # Cria o membro vinculado
            member = Member(
                name=name,
                phone=re.sub(r"[^0-9]", "", phone),
                email=email,
                sex="M",  # Default, pode ser alterado depois
                user=user,
                is_creditor=True,
                is_benefited=True,
                active=True,
            )
            member.document = document_clean
            member.save()

            # Enviar email de verificação se tiver email
            if email and hasattr(member, "email_verification_token"):
                import uuid as _uuid_mod

                from django.conf import settings
                from django.core.mail import send_mail
                from django.template.loader import render_to_string
                from django.utils import timezone

                _token = _uuid_mod.uuid4()
                member.email_verification_token = _token
                member.email_verification_sent_at = timezone.now()
                member.save(
                    update_fields=[
                        "email_verification_token",
                        "email_verification_sent_at",
                    ]
                )
                try:
                    _verification_url = (
                        f"{cfg('SITE_URL')}/verify-email?token={_token}"
                    )
                    _html_message = render_to_string(
                        "email/email_verification.html",
                        {
                            "user": user,
                            "verification_url": _verification_url,
                            "app_name": "Axiom",
                        },
                    )
                    send_mail(
                        subject="Confirme seu email — Axiom",
                        message=f"Confirme em: {_verification_url}",
                        from_email=getattr(
                            settings,
                            "DEFAULT_FROM_EMAIL",
                            "noreply@axiom.app",
                        ),
                        recipient_list=[email],
                        html_message=_html_message,
                        fail_silently=True,
                    )
                except Exception:
                    pass  # não bloquear o cadastro por falha de email

            logger.info(f"Novo usuario registrado: {username}")

            return Response(
                {
                    "message": "Usuario criado com sucesso",
                    "user_id": user.id,
                    "member_id": member.id,
                    "username": username,
                },
                status=status.HTTP_201_CREATED,
            )

    except Exception as e:
        logger.error(f"Erro ao criar usuario: {str(e)}")
        return Response(
            {"error": "Erro ao criar usuario. Tente novamente."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ============================================================================
# PASSWORD RESET VIEWS
# ============================================================================


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/users/password-reset/

    Solicita redefinição de senha. Envia e-mail com link de reset.
    Retorna 200 mesmo se o e-mail não existir (anti-enumeração).
    """

    permission_classes = []
    authentication_classes = []

    def post(self, request: Request) -> Response:
        import logging

        from django.conf import settings
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        logger = logging.getLogger("expenselit.audit")

        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {
                    "message": (
                        "Se este e-mail estiver cadastrado, "
                        "você receberá um link em breve."
                    )
                }
            )

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            # Anti-enumeração: retorna 200 mesmo sem usuário
            return Response(
                {
                    "message": (
                        "Se este e-mail estiver cadastrado, "
                        "você receberá um link em breve."
                    )
                }
            )

        token_generator = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        reset_url = f"{cfg('SITE_URL')}/reset-password/{uid}/{token}/"

        try:
            html_message = render_to_string(
                "email/password_reset.html",
                {"user": user, "reset_url": reset_url, "app_name": "Axiom"},
            )
            send_mail(
                subject="Redefinição de senha — Axiom",
                message=f"Acesse o link para redefinir sua senha: {reset_url}",
                from_email=getattr(
                    settings, "DEFAULT_FROM_EMAIL", "noreply@axiom.app"
                ),
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=True,
            )
        except Exception:
            logger.warning(
                "Falha ao enviar e-mail de reset de senha para %s", email
            )

        return Response(
            {
                "message": (
                    "Se este e-mail estiver cadastrado, "
                    "você receberá um link em breve."
                )
            }
        )


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/users/password-reset/confirm/

    Confirma a redefinição de senha usando uid + token gerados pelo Django.
    Body: { "uid": "...", "token": "...", "new_password": "...",
            "confirm_password": "..." }
    """

    permission_classes = []
    authentication_classes = []

    def post(self, request: Request) -> Response:
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        uid = (request.data.get("uid") or "").strip()
        token = (request.data.get("token") or "").strip()
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not all([uid, token, new_password, confirm_password]):
            return Response(
                {"error": "Todos os campos são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"error": "As senhas não coincidem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"error": "Link inválido ou expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return Response(
                {"error": "Link inválido ou expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response(
                {"error": "Senha inválida.", "details": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"message": "Senha redefinida com sucesso."})


# ============================================================================
# EMAIL VERIFICATION VIEWS
# ============================================================================


class EmailVerificationSendView(APIView):
    """
    POST /api/v1/users/email-verification/send/

    Envia (ou reenvia) o e-mail de verificação para o usuário autenticado.
    Requer que o member tenha um e-mail cadastrado e que o model Member
    possua os campos email_verified / email_verification_token.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        import logging
        import uuid

        from django.conf import settings
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils import timezone

        from members.models import Member

        logger = logging.getLogger("expenselit.audit")

        auth_user = cast(User, request.user)
        try:
            member = Member.objects.get(user=auth_user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(
                {"error": "Perfil de membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not hasattr(member, "email_verified"):
            return Response(
                {"error": "Verificação de e-mail não disponível."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        email = member.email or auth_user.email
        if not email:
            return Response(
                {"error": "Nenhum e-mail cadastrado para este perfil."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if member.email_verified:
            return Response({"message": "E-mail já verificado."})

        token = uuid.uuid4()
        Member.objects.filter(pk=member.pk).update(
            email_verification_token=token,
            email_verification_sent_at=timezone.now(),
        )

        verification_url = f"{cfg('SITE_URL')}/verify-email?token={token}"

        try:
            html_message = render_to_string(
                "email/email_verification.html",
                {
                    "user": request.user,
                    "verification_url": verification_url,
                    "app_name": "Axiom",
                },
            )
            send_mail(
                subject="Confirme seu e-mail — Axiom",
                message=f"Confirme seu e-mail em: {verification_url}",
                from_email=getattr(
                    settings, "DEFAULT_FROM_EMAIL", "noreply@axiom.app"
                ),
                recipient_list=[email],
                html_message=html_message,
                fail_silently=True,
            )
        except Exception:
            logger.warning(
                "Falha ao enviar e-mail de verificação para user %s",
                request.user.id,
            )

        return Response(
            {"message": "E-mail de verificação enviado. Verifique sua caixa."}
        )


class EmailVerificationConfirmView(APIView):
    """
    GET /api/v1/users/email-verification/confirm/?token=<uuid>

    Confirma o e-mail do usuário usando o token enviado por e-mail.
    Valida expiração de 48 horas.
    """

    permission_classes = []
    authentication_classes = []

    def get(self, request: Request) -> Response:
        from django.utils import timezone

        from members.models import Member

        token = (request.query_params.get("token") or "").strip()
        if not token:
            return Response(
                {"error": "Token ausente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            member = Member.objects.get(
                email_verification_token=token, is_deleted=False
            )
        except (Member.DoesNotExist, Exception):
            return Response(
                {"error": "Token inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not hasattr(member, "email_verified"):
            return Response(
                {"error": "Verificação de e-mail não disponível."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        if member.email_verified:
            return Response({"message": "E-mail já verificado anteriormente."})

        sent_at = member.email_verification_sent_at
        if sent_at is None:
            return Response(
                {"error": "Token inválido ou expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        elapsed = timezone.now() - sent_at
        if elapsed.total_seconds() > 172800:  # 48 horas
            return Response(
                {
                    "error": (
                        "Token expirado. Solicite um novo"
                        " e-mail de verificação."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        member.email_verified = True
        member.email_verification_token = None
        member.email_verification_sent_at = None
        member.save(
            update_fields=[
                "email_verified",
                "email_verification_token",
                "email_verification_sent_at",
            ]
        )

        return Response({"message": "E-mail verificado com sucesso!"})


# ============================================================================
# CHANGE PASSWORD VIEW
# ============================================================================


class ChangePasswordView(APIView):
    """
    POST /api/v1/users/change-password/

    Altera a senha do usuário autenticado.
    Body: { "current_password": "...", "new_password": "...",
    "confirm_password": "..." }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast(User, request.user)
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not all([current_password, new_password, confirm_password]):
            return Response(
                {"error": "Todos os campos são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {"error": "Senha atual incorreta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"error": "As senhas não coincidem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response(
                {"error": "Senha inválida.", "details": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"message": "Senha alterada com sucesso."})


# ============================================================================
# 2FA / TOTP VIEWS
# ============================================================================


class TwoFactorSetupView(APIView):
    """
    GET /api/v1/users/2fa/setup/

    Gera (ou retorna existente pendente) um secret TOTP
    e retorna QR code em base64.
    Só funciona se 2FA ainda não estiver ativo para o usuário.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        import base64
        import io

        import pyotp
        import qrcode

        from .models import TOTPDevice

        user = cast(User, request.user)

        # Se já existe device ativo, rejeitar
        try:
            device = user.totp_device  # type: ignore[attr-defined]
            if device.is_active:
                return Response(
                    {"error": "2FA já está ativado para esta conta."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except TOTPDevice.DoesNotExist:
            device = TOTPDevice.objects.create(
                user=user,
                secret=pyotp.random_base32(),
            )

        uri = device.generate_provisioning_uri()

        qr = qrcode.make(uri)
        img_buffer = io.BytesIO()
        qr.save(img_buffer, format="PNG")
        qr_base64 = base64.b64encode(img_buffer.getvalue()).decode()

        return Response(
            {
                "secret": device.secret,
                "qr_code": f"data:image/png;base64,{qr_base64}",
                "manual_entry_key": device.secret,
            }
        )


class TwoFactorActivateView(APIView):
    """
    POST /api/v1/users/2fa/activate/
    Body: { "code": "123456" }

    Ativa 2FA após o usuário confirmar o primeiro código TOTP válido.
    Retorna backup codes (exibição única — não armazenados em plaintext).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        from django.utils import timezone

        from .models import TOTPDevice

        user = cast(User, request.user)
        code = (request.data.get("code") or "").strip()

        if not code:
            return Response(
                {"error": "Código é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            device = user.totp_device  # type: ignore[attr-defined]
        except TOTPDevice.DoesNotExist:
            return Response(
                {
                    "error": (
                        "Nenhum setup de 2FA pendente."
                        " Acesse /2fa/setup/ primeiro."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if device.is_active:
            return Response(
                {"error": "2FA já está ativado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not device.verify_token(code):
            return Response(
                {"error": "Código inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plaintext_codes, hashed_codes = TOTPDevice.generate_backup_codes()
        device.is_active = True
        device.backup_codes = hashed_codes
        device.activated_at = timezone.now()
        device.save(
            update_fields=["is_active", "backup_codes", "activated_at"]
        )

        return Response(
            {
                "message": "2FA ativado com sucesso.",
                "backup_codes": plaintext_codes,
            },
            status=status.HTTP_200_OK,
        )


class TwoFactorVerifyView(APIView):
    """
    POST /api/v1/users/2fa/verify/
    Body: { "temp_token": "...", "code": "123456" }

    Valida o código TOTP (ou backup code) durante o login de dois fatores.
    Se válido, emite os cookies JWT e conclui o login.
    Chamado pelo frontend após receber requires_2fa=true do endpoint de login.
    """

    permission_classes = []
    authentication_classes = []

    def post(self, request: Request) -> Response:
        from django.conf import settings
        from django.core.cache import cache

        from rest_framework_simplejwt.tokens import RefreshToken

        from .models import TOTPDevice

        temp_token = (request.data.get("temp_token") or "").strip()
        code = (request.data.get("code") or "").strip()

        if not temp_token or not code:
            return Response(
                {"error": "temp_token e code são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"2fa_temp:{temp_token}"
        user_id = cache.get(cache_key)
        if not user_id:
            return Response(
                {"error": "Token expirado. Faça login novamente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=user_id)
            device = user.totp_device  # type: ignore[attr-defined]
        except (User.DoesNotExist, TOTPDevice.DoesNotExist):
            cache.delete(cache_key)
            return Response(
                {"error": "Usuário ou device não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar código TOTP ou backup code
        valid = device.verify_token(code) or device.verify_backup_code(code)
        if not valid:
            return Response(
                {"error": "Código inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Consumir temp token
        cache.delete(cache_key)

        # Emitir cookies JWT
        refresh = RefreshToken.for_user(user)
        response = Response(
            {"message": "Login realizado com sucesso"},
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            key="access_token",
            value=str(refresh.access_token),
            max_age=60 * 15,
            httponly=True,
            secure=settings.DEBUG is False,
            samesite="Strict",
            path="/",
        )
        response.set_cookie(
            key="refresh_token",
            value=str(refresh),
            max_age=60 * 60,
            httponly=True,
            secure=settings.DEBUG is False,
            samesite="Strict",
            path="/api/v1/authentication/",
        )

        return response


class TwoFactorDisableView(APIView):
    """
    POST /api/v1/users/2fa/disable/
    Body: { "password": "senha_atual" }

    Desativa 2FA após confirmação de senha.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        from .models import TOTPDevice

        user = cast(User, request.user)
        password = request.data.get("password", "")

        if not user.check_password(password):
            return Response(
                {"error": "Senha incorreta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TOTPDevice.objects.filter(user=user).delete()
        return Response(
            {"message": "2FA desativado com sucesso."},
            status=status.HTTP_200_OK,
        )


class TwoFactorStatusView(APIView):
    """
    GET /api/v1/users/2fa/status/

    Retorna se 2FA está ativo para o usuário autenticado.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from .models import TOTPDevice

        user = cast(User, request.user)
        try:
            device = user.totp_device  # type: ignore[attr-defined]
            is_active = device.is_active
        except TOTPDevice.DoesNotExist:
            is_active = False

        return Response({"is_active": is_active})
