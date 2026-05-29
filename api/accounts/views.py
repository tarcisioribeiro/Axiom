import datetime

from django.db.models import QuerySet
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from accounts.models import Account
from accounts.serializers import AccountSerializer
from accounts.services import get_projected_balance
from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission


class AccountCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar contas bancárias.

    Permite:
    - GET: Lista todas as contas ordenadas por nome (exclui deletadas)
    - POST: Cria uma nova conta

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de contas não deletadas
    serializer_class : class
        Serializer usado para validação e serialização
    ordering : list
        Ordenação padrão por nome
    """

    queryset = Account.objects.all()  # GlobalDefaultPermission
    serializer_class = AccountSerializer
    ordering = ["name"]

    def get_queryset(self) -> QuerySet[Account]:
        # Usa defer() para excluir campo criptografado na listagem
        # (performance)
        return Account.objects.filter(
            created_by=self.request.user  # type: ignore[misc]
        ).defer("_account_number")

    def perform_create(self, serializer: BaseSerializer[Account]) -> None:
        serializer.save(  # type: ignore[misc]
            created_by=self.request.user, updated_by=self.request.user
        )


class AccountRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em contas bancárias.

    Permite:
    - GET: Recupera uma conta específica (exclui deletadas)
    - PUT/PATCH: Atualiza uma conta existente
    - DELETE: Remove uma conta (soft delete)

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de contas não deletadas
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Account.objects.all()  # GlobalDefaultPermission
    serializer_class = AccountSerializer

    def get_queryset(self) -> QuerySet[Account]:
        return Account.objects.filter(  # type: ignore[misc]
            created_by=self.request.user
        )

    def perform_update(self, serializer: BaseSerializer[Account]) -> None:
        serializer.save(updated_by=self.request.user)  # type: ignore[misc]

    def perform_destroy(self, instance: Account) -> None:
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user  # type: ignore[assignment]
        instance.save()


class AccountProjectedBalanceView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Account.objects.none()

    def get(self, request: Request, pk: str) -> Response:
        date_str = request.query_params.get("date")
        if not date_str:
            return Response(
                {"detail": "Parâmetro 'date' é obrigatório (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            account = Account.objects.get(
                pk=pk, created_by=request.user, is_deleted=False  # type: ignore[misc]  # noqa: E501
            )
        except Account.DoesNotExist:
            return Response(
                {"detail": "Conta não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        projected = get_projected_balance(account.id, target_date)
        return Response(
            {
                "account_id": str(account.id),
                "date": date_str,
                "current_balance": str(account.current_balance),
                "projected_balance": str(projected),
            }
        )
