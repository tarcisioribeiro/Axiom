from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import recalculate_account_balance
from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from transfers.models import FixedTransfer, Transfer
from transfers.serializers import (
    BulkGenerateTransfersRequestSerializer,
    BulkGenerateTransfersResponseSerializer,
    FixedTransferCreateUpdateSerializer,
    FixedTransferSerializer,
    TransferSerializer,
)
from transfers.services import bulk_generate_fixed_transfers


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
        return Transfer.objects.filter(
            created_by=self.request.user
        ).select_related("origin_account", "destiny_account")

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
        return Transfer.objects.filter(
            created_by=self.request.user
        ).select_related("origin_account", "destiny_account")

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


class FixedTransferListCreateView(BaseListCreateView):
    queryset = FixedTransfer.objects.all()

    def get_queryset(self):
        return FixedTransfer.objects.select_related(
            "origin_account", "destiny_account"
        ).order_by("due_day", "description")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FixedTransferCreateUpdateSerializer
        return FixedTransferSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class FixedTransferDetailView(BaseRetrieveUpdateDestroyView):
    queryset = FixedTransfer.objects.select_related(
        "origin_account", "destiny_account"
    )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return FixedTransferCreateUpdateSerializer
        return FixedTransferSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()


class BulkGenerateFixedTransfersView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = FixedTransfer.objects.none()

    def post(self, request):
        serializer = BulkGenerateTransfersRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = bulk_generate_fixed_transfers(
            month=serializer.validated_data["month"],
            user=request.user,
        )

        response_serializer = BulkGenerateTransfersResponseSerializer(result)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED
        )
