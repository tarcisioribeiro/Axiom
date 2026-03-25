from django.db import transaction

from accounts.services import recalculate_account_balance
from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from transfers.models import Transfer
from transfers.serializers import TransferSerializer


def _recalculate_transfer_accounts(origin_id, destiny_id):
    """Recalculate balances for both accounts involved in a transfer."""
    if origin_id:
        recalculate_account_balance(origin_id)
    if destiny_id and destiny_id != origin_id:
        recalculate_account_balance(destiny_id)


class TransferCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar transferências.

    Permite:
    - GET: Lista todas as transferências (exclui deletadas)
    - POST: Cria uma nova transferência

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de transferências não deletadas
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Transfer.objects.all()  # GlobalDefaultPermission
    serializer_class = TransferSerializer

    def get_queryset(self):
        return Transfer.objects.filter(created_by=self.request.user).select_related(
            "origin_account", "destiny_account"
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save(
                created_by=self.request.user, updated_by=self.request.user
            )
            _recalculate_transfer_accounts(
                instance.origin_account_id, instance.destiny_account_id
            )


class TransferRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em transferências.

    Permite:
    - GET: Recupera uma transferência específica
    - PUT/PATCH: Atualiza uma transferência existente
    - DELETE: Remove uma transferência

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de todas as transferências (exclui deletadas)
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Transfer.objects.all()  # GlobalDefaultPermission
    serializer_class = TransferSerializer

    def get_queryset(self):
        return Transfer.objects.filter(created_by=self.request.user).select_related(
            "origin_account", "destiny_account"
        )

    def perform_update(self, serializer):
        with transaction.atomic():
            instance = serializer.save(updated_by=self.request.user)
            _recalculate_transfer_accounts(
                instance.origin_account_id, instance.destiny_account_id
            )

    def perform_destroy(self, instance):
        origin_id = instance.origin_account_id
        destiny_id = instance.destiny_account_id
        with transaction.atomic():
            instance.delete()
            _recalculate_transfer_accounts(origin_id, destiny_id)
