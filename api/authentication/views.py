# views.py
import re

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


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
            errors.append("Username deve conter apenas letras, numeros e underscore")

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


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response({"detail": "Logout efetuado com sucesso."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    GET /api/v1/me/

    Retorna dados completos do usuário autenticado incluindo:
    - Informações do User (Django)
    - Informações do Member vinculado (se existir)
    - Permissões do usuário

    FEAT-01: Endpoint centralizado para dados do usuário.
    """
    from members.models import Member

    user = request.user

    # Buscar membro vinculado
    try:
        member = Member.objects.get(user=user, is_deleted=False)
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
def get_user_permissions(request):
    user = request.user

    # Bloqueia superusuários de usar a interface Streamlit
    if user.is_superuser:
        return Response(
            {"error": "Administradores não podem acessar esta interface"},
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
def get_available_users(request):
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
def create_user_with_member(request):
    """
    Cria um novo usuário e o vincula a um membro.
    Endpoint público para registro de novos usuários.
    """
    import logging

    from django.db import transaction

    from members.models import Member

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
    document_exists = Member.objects.filter(document=document_clean).exists()

    if username_exists or document_exists:
        # Log interno para auditoria (nao exposto ao usuario)
        if username_exists:
            logger.warning(f"Tentativa de registro com username duplicado: {username}")
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
                last_name=(" ".join(name.split()[1:]) if len(name.split()) > 1 else ""),
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
                pass

            # Cria o membro vinculado
            member = Member.objects.create(
                name=name,
                document=document_clean,
                phone=re.sub(r"[^0-9]", "", phone),
                email=email,
                sex="M",  # Default, pode ser alterado depois
                user=user,
                is_creditor=True,
                is_benefited=True,
                active=True,
            )

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
