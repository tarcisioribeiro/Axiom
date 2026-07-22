from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from receivables.models import Receivable, ReceivableInstallment
from receivables.serializers import (
    ReceivableInstallmentSerializer,
    ReceivableSerializer,
)


class ReceivableCreateListView(BaseListCreateView):
    queryset = Receivable.objects.all()
    serializer_class = ReceivableSerializer

    def get_queryset(self):
        return Receivable.objects.filter(
            created_by=self.request.user
        ).select_related("member")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class ReceivableRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    queryset = Receivable.objects.all()
    serializer_class = ReceivableSerializer

    def get_queryset(self):
        return Receivable.objects.filter(
            created_by=self.request.user
        ).select_related("member")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ReceivableInstallmentListView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = ReceivableInstallment.objects.none()

    def get(self, request, pk):
        receivable = Receivable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not receivable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        installments = ReceivableInstallment.objects.filter(
            receivable=receivable
        ).order_by("installment_number")
        serializer = ReceivableInstallmentSerializer(installments, many=True)
        return Response(serializer.data)

    def patch(self, request, pk):
        receivable = Receivable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not receivable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        installment_number = request.data.get("installment_number")
        if not installment_number:
            return Response(
                {"detail": "installment_number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            installment = ReceivableInstallment.objects.get(
                receivable=receivable, installment_number=installment_number
            )
        except ReceivableInstallment.DoesNotExist:
            return Response(
                {"detail": "Installment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ReceivableInstallmentSerializer(
            installment, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ReceivableReceiptView(APIView):
    """Registra o recebimento de um valor a receber."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Receivable.objects.none()

    def post(self, request, pk):
        from accounts.models import Account
        from accounts.services import recalculate_account_balance
        from revenues.models import Revenue

        receivable = Receivable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not receivable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        value = request.data.get("value")
        account_id = request.data.get("account")
        date = request.data.get("date")
        notes = request.data.get("notes", "")
        scheduled = request.data.get("scheduled", False)

        if not all([value, account_id, date]):
            return Response(
                {"detail": "value, account and date are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            account = Account.objects.get(pk=account_id, is_deleted=False)
        except Account.DoesNotExist:
            return Response(
                {"detail": "Account not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        received = not scheduled

        with transaction.atomic():
            revenue = Revenue.objects.create(
                description=f"Recebimento: {receivable.description}",
                value=value,
                date=date,
                horary=timezone.now().time(),
                category=receivable.category,
                account=account,
                received=received,
                notes=notes,
                related_receivable=receivable,
                created_by=request.user,
                updated_by=request.user,
            )

            if received:
                new_received = receivable.received_value + Decimal(str(value))
                receivable.received_value = min(new_received, receivable.value)
                receivable.save()
                recalculate_account_balance(account.id)

        from revenues.serializers import RevenueSerializer

        return Response(
            {
                "revenue": RevenueSerializer(revenue).data,
                "receivable": ReceivableSerializer(receivable).data,
                "scheduled": scheduled,
            },
            status=status.HTTP_201_CREATED,
        )
