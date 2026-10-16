from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    parser_classes,
    permission_classes,
)
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from members.models import Member
from members.serializers import MemberSerializer


class MemberCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar membros.

    Permite:
    - GET: Lista todos os membros (exclui deletados)
    - POST: Cria um novo membro

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de membros não deletados
    serializer_class : class
        Serializer usado para validação e serialização
    """

    serializer_class = MemberSerializer

    # TODO(security #340): IDOR - queryset is not scoped to the requesting
    # user, so any authenticated user can list/create members belonging to
    # other users. Filter by the owning user, mirroring every sibling app
    # (Account, Expense, Transfer, ...).
    def get_queryset(self):
        return Member.objects.filter(is_deleted=False).defer("_document")


class MemberRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em membros.

    Permite:
    - GET: Recupera um membro específico (exclui deletados)
    - PUT/PATCH: Atualiza um membro existente
    - DELETE: Remove um membro (soft delete)

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de membros não deletados
    serializer_class : class
        Serializer usado para validação e serialização
    """

    serializer_class = MemberSerializer

    # TODO(security #340): IDOR - queryset is not scoped to the requesting
    # user, so any authenticated user can read/update/delete any other
    # user's Member record (including decrypted PII such as `document`).
    def get_queryset(self):
        return Member.objects.filter(is_deleted=False)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_current_user_member(request):
    """
    Retorna o membro associado ao usuário logado.

    Returns
    -------
    Response
        JSON com os dados do membro ou erro 404 se não encontrado
    """
    try:
        member = Member.objects.get(user=request.user)
        serializer = MemberSerializer(member)
        return Response(serializer.data)
    except Member.DoesNotExist:
        return Response(
            {"error": "Membro não encontrado para este usuário"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def manage_profile_photo(request):
    """
    PATCH: Faz upload da foto de perfil do membro do usuário logado.
    DELETE: Remove a foto de perfil.
    """
    try:
        member = Member.objects.get(user=request.user, is_deleted=False)
    except Member.DoesNotExist:
        return Response(
            {"error": "Membro não encontrado para este usuário"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "DELETE":
        if member.profile_photo:
            member.profile_photo.delete(save=False)
            member.profile_photo = None
            member.save(update_fields=["profile_photo"])
        serializer = MemberSerializer(member)
        return Response(serializer.data)

    if "profile_photo" not in request.FILES:
        return Response(
            {"error": "Nenhuma foto enviada"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if member.profile_photo:
        member.profile_photo.delete(save=False)

    member.profile_photo = request.FILES["profile_photo"]
    member.save(update_fields=["profile_photo"])

    serializer = MemberSerializer(member)
    return Response(serializer.data)


class MemberPhotoStreamView(APIView):
    """Redireciona para a foto de perfil do membro (ver docstring de
    BookCoverStreamView em library/views.py para o motivo)."""

    # TODO(security #340): IDOR - get() below fetches by pk with no
    # ownership check, so any authenticated user can stream another user's
    # member profile photo.
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        member = get_object_or_404(Member, pk=pk, is_deleted=False)
        if not member.profile_photo:
            return Response(
                {"detail": "Este membro não possui foto de perfil."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = member.profile_photo.url
        except Exception:
            return Response(
                {"detail": "Foto não encontrada no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        response["Cache-Control"] = "private, max-age=3600"
        return response
