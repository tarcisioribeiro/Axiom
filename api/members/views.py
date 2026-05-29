import csv
from decimal import Decimal

from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.http import FileResponse, HttpResponse
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
from app.export_utils import format_decimal
from app.permissions import GlobalDefaultPermission
from expenses.models import Expense
from loans.models import Loan
from members.models import Member
from members.serializers import MemberPermissionsSerializer, MemberSerializer
from payables.models import Payable
from revenues.models import Revenue
from transfers.models import Transfer


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_member_permissions(request, pk):
    """
    Retorna as permissões de um membro específico.

    Parameters
    ----------
    pk : int
        ID do membro

    Returns
    -------
    Response
        JSON com lista de codenames de permissões do membro ou erro 404
    """
    try:
        member = Member.objects.get(pk=pk)

        # Verificar se o membro tem um usuário associado
        if not member.user:
            return Response(
                {"error": "Membro não possui usuário associado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Obter todas as permissões do usuário
        user_permissions = member.user.user_permissions.all()
        permission_codenames = [perm.codename for perm in user_permissions]

        return Response({"permissions": permission_codenames})

    except Member.DoesNotExist:
        return Response(
            {"error": "Membro não encontrado"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_member_permissions(request, pk):
    """
    Atualiza as permissões de um membro específico.

    Parameters
    ----------
    pk : int
        ID do membro

    Request Body
    ------------
    {
        "permission_codenames": ["view_account", "add_expense", ...]
    }

    Returns
    -------
    Response
        JSON com mensagem de sucesso e novas permissões ou erro
    """
    try:
        member = Member.objects.get(pk=pk)

        # Verificar se o membro tem um usuário associado
        if not member.user:
            return Response(
                {"error": "Membro não possui usuário associado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar dados de entrada
        serializer = MemberPermissionsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        permission_codenames = serializer.validated_data[
            "permission_codenames"
        ]

        # Limpar permissões atuais
        member.user.user_permissions.clear()

        # Adicionar novas permissões
        permissions_to_add = []
        for codename in permission_codenames:
            try:
                permission = Permission.objects.get(codename=codename)
                permissions_to_add.append(permission)
            except Permission.DoesNotExist:
                return Response(
                    {
                        "error": (
                            f"Permissão com codename"
                            f' "{codename}" não encontrada'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        member.user.user_permissions.add(*permissions_to_add)

        return Response(
            {
                "message": "Permissões atualizadas com sucesso",
                "permissions": permission_codenames,
            }
        )

    except Member.DoesNotExist:
        return Response(
            {"error": "Membro não encontrado"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_available_permissions(request):
    """
    Retorna todas as permissões disponíveis no sistema organizadas por app.

    Returns
    -------
    Response
        JSON com permissões organizadas por app
    """
    # Apps que queremos mostrar
    relevant_apps = [
        "accounts",
        "expenses",
        "revenues",
        "credit_cards",
        "loans",
        "transfers",
        "security",
        "library",
    ]

    permissions_by_app = {}

    for app_name in relevant_apps:
        try:
            # Obter o ContentType para este app
            content_types = ContentType.objects.filter(app_label=app_name)

            # Obter todas as permissões deste app
            permissions = Permission.objects.filter(
                content_type__in=content_types
            )

            permissions_by_app[app_name] = [
                {
                    "id": perm.id,
                    "name": perm.name,
                    "codename": perm.codename,
                    "app": app_name,
                }
                for perm in permissions
            ]
        except Exception:
            permissions_by_app[app_name] = []

    return Response(permissions_by_app)


class MemberPhotoStreamView(APIView):
    """Proxy da foto de perfil do membro via Django."""

    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        member = get_object_or_404(Member, pk=pk, is_deleted=False)
        if not member.profile_photo:
            return Response(
                {"detail": "Este membro não possui foto de perfil."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            file_obj = member.profile_photo.open("rb")
        except Exception:
            return Response(
                {"detail": "Foto não encontrada no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        filename = member.profile_photo.name.split("/")[-1]
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        mime_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "gif": "image/gif",
        }
        content_type = mime_map.get(ext, "image/jpeg")
        response = FileResponse(file_obj, content_type=content_type)
        response["Cache-Control"] = "private, max-age=3600"
        return response


class MemberFinancialReportView(APIView):
    """
    Retorna um relatório financeiro consolidado de um membro específico.

    Query params:
    - start_date (optional): YYYY-MM-DD
    - end_date (optional): YYYY-MM-DD
    - export_format (optional): 'csv' para exportação (default: json)

    Requer permissão view_member (GlobalDefaultPermission).
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Member.objects.all()

    def get(self, request, pk):
        member = get_object_or_404(
            Member, pk=pk, user=request.user, is_deleted=False
        )

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        date_filter = {}
        if start_date:
            date_filter["date__gte"] = start_date
        if end_date:
            date_filter["date__lte"] = end_date

        expenses = [
            {
                "id": e.id,
                "description": e.description,
                "value": str(e.value),
                "date": str(e.date),
                "category": e.category,
                "payed": e.payed,
                "merchant": e.merchant or "",
            }
            for e in Expense.objects.filter(
                member=member,
                related_transfer__isnull=True,
                is_initial_balance=False,
                **date_filter,
            ).order_by("-date")
        ]

        revenues = [
            {
                "id": r.id,
                "description": r.description,
                "value": str(r.value),
                "date": str(r.date),
                "category": r.category,
                "received": r.received,
                "source": r.source or "",
            }
            for r in Revenue.objects.filter(
                member=member,
                related_transfer__isnull=True,
                is_initial_balance=False,
                **date_filter,
            ).order_by("-date")
        ]

        loans_as_benefited = [
            {
                "id": lo.id,
                "description": lo.description,
                "value": str(lo.value),
                "payed_value": str(lo.payed_value),
                "date": str(lo.date),
                "status": lo.status,
                "creditor": lo.creditor.name,
            }
            for lo in Loan.objects.filter(benefited=member, **date_filter)
            .select_related("creditor")
            .order_by("-date")
        ]

        loans_as_creditor = [
            {
                "id": lo.id,
                "description": lo.description,
                "value": str(lo.value),
                "payed_value": str(lo.payed_value),
                "date": str(lo.date),
                "status": lo.status,
                "benefited": lo.benefited.name,
            }
            for lo in Loan.objects.filter(creditor=member, **date_filter)
            .select_related("benefited")
            .order_by("-date")
        ]

        payables = [
            {
                "id": p.id,
                "description": p.description,
                "value": str(p.value),
                "paid_value": str(p.paid_value),
                "date": str(p.date),
                "due_date": str(p.due_date) if p.due_date else None,
                "status": p.status,
                "category": p.category,
            }
            for p in Payable.objects.filter(
                member=member, **date_filter
            ).order_by("-date")
        ]

        transfers = [
            {
                "id": t.id,
                "description": t.description,
                "value": str(t.value),
                "date": str(t.date),
                "category": t.category,
                "transfered": t.transfered,
            }
            for t in Transfer.objects.filter(
                member=member, **date_filter
            ).order_by("-date")
        ]

        total_expenses = sum(Decimal(e["value"]) for e in expenses)
        total_revenues = sum(Decimal(r["value"]) for r in revenues)
        total_loans_benefited = sum(
            Decimal(lo["value"]) for lo in loans_as_benefited
        )
        total_loans_creditor = sum(
            Decimal(lo["value"]) for lo in loans_as_creditor
        )
        total_payables = sum(Decimal(p["value"]) for p in payables)
        total_transfers = sum(Decimal(t["value"]) for t in transfers)
        net_balance = total_revenues - total_expenses - total_payables

        category_totals: dict = {}
        for e in expenses:
            cat = e["category"]
            category_totals[cat] = category_totals.get(
                cat, Decimal("0")
            ) + Decimal(e["value"])
        expenses_by_category = [
            {"category": cat, "total": str(val)}
            for cat, val in sorted(
                category_totals.items(), key=lambda x: x[1], reverse=True
            )
        ]

        if request.query_params.get("export_format") == "csv":
            return self._generate_csv(
                member=member,
                expenses=expenses,
                revenues=revenues,
                loans_as_benefited=loans_as_benefited,
                loans_as_creditor=loans_as_creditor,
                payables=payables,
                transfers=transfers,
                summary={
                    "total_revenues": total_revenues,
                    "total_expenses": total_expenses,
                    "total_payables": total_payables,
                    "total_loans_benefited": total_loans_benefited,
                    "total_loans_creditor": total_loans_creditor,
                    "total_transfers": total_transfers,
                    "net_balance": net_balance,
                },
                start_date=start_date,
                end_date=end_date,
            )

        return Response(
            {
                "member": {"id": member.id, "name": member.name},
                "period": {"start_date": start_date, "end_date": end_date},
                "summary": {
                    "total_revenues": str(total_revenues),
                    "total_expenses": str(total_expenses),
                    "total_payables": str(total_payables),
                    "total_loans_as_benefited": str(total_loans_benefited),
                    "total_loans_as_creditor": str(total_loans_creditor),
                    "total_transfers": str(total_transfers),
                    "net_balance": str(net_balance),
                },
                "expenses_by_category": expenses_by_category,
                "expenses": expenses,
                "revenues": revenues,
                "loans_as_benefited": loans_as_benefited,
                "loans_as_creditor": loans_as_creditor,
                "payables": payables,
                "transfers": transfers,
            }
        )

    def _generate_csv(  # noqa: PLR0913
        self,
        member,
        expenses,
        revenues,
        loans_as_benefited,
        loans_as_creditor,
        payables,
        transfers,
        summary,
        start_date,
        end_date,
    ):
        safe_name = member.name.replace(" ", "_")
        filename = f"relatorio_{safe_name}_{start_date or 'all'}.csv"
        response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.write("\ufeff")

        writer = csv.writer(response)
        period = f"{start_date or 'Início'} a {end_date or 'Hoje'}"

        writer.writerow([f"Relatório Financeiro: {member.name}"])
        writer.writerow([f"Período: {period}"])
        writer.writerow([])

        writer.writerow(["RESUMO"])
        writer.writerow(["Tipo", "Valor"])
        writer.writerow(
            ["Receitas", format_decimal(summary["total_revenues"])]
        )
        writer.writerow(
            ["Despesas", format_decimal(summary["total_expenses"])]
        )
        writer.writerow(
            ["Valores a Pagar", format_decimal(summary["total_payables"])]
        )
        writer.writerow(
            [
                "Empréstimos Recebidos",
                format_decimal(summary["total_loans_benefited"]),
            ]
        )
        writer.writerow(
            [
                "Empréstimos Concedidos",
                format_decimal(summary["total_loans_creditor"]),
            ]
        )
        writer.writerow(
            ["Transferências", format_decimal(summary["total_transfers"])]
        )
        writer.writerow(
            ["Saldo Líquido", format_decimal(summary["net_balance"])]
        )
        writer.writerow([])

        writer.writerow(["DESPESAS"])
        writer.writerow(
            [
                "ID",
                "Descrição",
                "Valor",
                "Data",
                "Categoria",
                "Estabelecimento",
                "Pago",
            ]
        )
        for e in expenses:
            writer.writerow(
                [
                    e["id"],
                    e["description"],
                    format_decimal(e["value"]),
                    e["date"],
                    e["category"],
                    e.get("merchant", ""),
                    "Sim" if e["payed"] else "Não",
                ]
            )
        writer.writerow([])

        writer.writerow(["RECEITAS"])
        writer.writerow(
            [
                "ID",
                "Descrição",
                "Valor",
                "Data",
                "Categoria",
                "Fonte",
                "Recebido",
            ]
        )
        for r in revenues:
            writer.writerow(
                [
                    r["id"],
                    r["description"],
                    format_decimal(r["value"]),
                    r["date"],
                    r["category"],
                    r.get("source", ""),
                    "Sim" if r["received"] else "Não",
                ]
            )
        writer.writerow([])

        writer.writerow(["EMPRÉSTIMOS RECEBIDOS (Como Beneficiado)"])
        writer.writerow(
            [
                "ID",
                "Descrição",
                "Valor",
                "Valor Pago",
                "Data",
                "Status",
                "Credor",
            ]
        )
        for lo in loans_as_benefited:
            writer.writerow(
                [
                    lo["id"],
                    lo["description"],
                    format_decimal(lo["value"]),
                    format_decimal(lo["payed_value"]),
                    lo["date"],
                    lo["status"],
                    lo["creditor"],
                ]
            )
        writer.writerow([])

        writer.writerow(["EMPRÉSTIMOS CONCEDIDOS (Como Credor)"])
        writer.writerow(
            [
                "ID",
                "Descrição",
                "Valor",
                "Valor Pago",
                "Data",
                "Status",
                "Beneficiado",
            ]
        )
        for lo in loans_as_creditor:
            writer.writerow(
                [
                    lo["id"],
                    lo["description"],
                    format_decimal(lo["value"]),
                    format_decimal(lo["payed_value"]),
                    lo["date"],
                    lo["status"],
                    lo["benefited"],
                ]
            )
        writer.writerow([])

        writer.writerow(["VALORES A PAGAR"])
        writer.writerow(
            [
                "ID",
                "Descrição",
                "Valor Total",
                "Valor Pago",
                "Data",
                "Vencimento",
                "Status",
                "Categoria",
            ]
        )
        for p in payables:
            writer.writerow(
                [
                    p["id"],
                    p["description"],
                    format_decimal(p["value"]),
                    format_decimal(p["paid_value"]),
                    p["date"],
                    p["due_date"] or "",
                    p["status"],
                    p["category"],
                ]
            )
        writer.writerow([])

        writer.writerow(["TRANSFERÊNCIAS"])
        writer.writerow(
            ["ID", "Descrição", "Valor", "Data", "Categoria", "Transferido"]
        )
        for t in transfers:
            writer.writerow(
                [
                    t["id"],
                    t["description"],
                    format_decimal(t["value"]),
                    t["date"],
                    t["category"],
                    "Sim" if t["transfered"] else "Não",
                ]
            )

        return response
