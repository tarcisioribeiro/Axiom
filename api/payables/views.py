from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from payables.models import Payable, PayableInstallment
from payables.serializers import (
    PayableInstallmentSerializer,
    PayableSerializer,
)


class PayableCreateListView(BaseListCreateView):
    queryset = Payable.objects.all()  # GlobalDefaultPermission
    serializer_class = PayableSerializer

    def get_queryset(self):
        return Payable.objects.filter(
            created_by=self.request.user
        ).select_related("member")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class PayableRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    queryset = Payable.objects.all()  # GlobalDefaultPermission
    serializer_class = PayableSerializer

    def get_queryset(self):
        return Payable.objects.filter(
            created_by=self.request.user
        ).select_related("member")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class PayableInstallmentListView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = PayableInstallment.objects.none()

    def get(self, request, pk):
        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        installments = PayableInstallment.objects.filter(
            payable=payable
        ).order_by("installment_number")
        serializer = PayableInstallmentSerializer(installments, many=True)
        return Response(serializer.data)

    def patch(self, request, pk):
        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
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
            installment = PayableInstallment.objects.get(
                payable=payable, installment_number=installment_number
            )
        except PayableInstallment.DoesNotExist:
            return Response(
                {"detail": "Installment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PayableInstallmentSerializer(
            installment, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PayablePaymentView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Payable.objects.none()

    def post(self, request, pk):
        from decimal import Decimal

        from accounts.models import Account
        from accounts.services import recalculate_account_balance
        from expenses.models import Expense

        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
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

        payed = not scheduled

        with transaction.atomic():
            expense = Expense.objects.create(
                description=f"Pagamento: {payable.description}",
                value=value,
                date=date,
                horary=timezone.now().time(),
                category=payable.category,
                account=account,
                payed=payed,
                notes=notes,
                related_payable=payable,
                created_by=request.user,
                updated_by=request.user,
            )

            if payed:
                new_paid = payable.paid_value + Decimal(str(value))
                payable.paid_value = min(new_paid, payable.value)
                payable.save()
                recalculate_account_balance(account.id)

        from expenses.serializers import ExpenseSerializer

        return Response(
            {
                "expense": ExpenseSerializer(expense).data,
                "payable": PayableSerializer(payable).data,
                "scheduled": scheduled,
            },
            status=status.HTTP_201_CREATED,
        )
