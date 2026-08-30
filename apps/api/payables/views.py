from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone
from django.utils.dateparse import parse_date
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
    RecalculationPreviewSerializer,
)


class PayableCreateListView(BaseListCreateView):
    queryset = Payable.objects.all()  # GlobalDefaultPermission
    serializer_class = PayableSerializer

    def get_queryset(self):
        return (
            Payable.objects.filter(created_by=self.request.user)
            .select_related("member")
            .order_by(
                Case(
                    When(status="active", then=Value(0)),
                    When(status="overdue", then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                ),
                "-date",
            )
        )

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
        edits_schedule = any(
            field in request.data for field in ("value", "due_date")
        )
        if installment.payed and edits_schedule:
            return Response(
                {"detail": "Parcela já paga não pode ser editada."},
                status=status.HTTP_400_BAD_REQUEST,
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


class PayablePaymentPlanView(APIView):
    """POST /payables/<pk>/payment-plan/ — cria o plano de pagamento
    parcelado de um Payable que ainda não tem parcelamento (requisito 1)."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Payable.objects.none()

    def post(self, request, pk):
        from accounts.models import Account
        from expenses.serializers import FixedExpenseSerializer
        from payables.signals import generate_payable_installments

        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if payable.installments > 1:
            return Response(
                {"detail": "Este valor a pagar já tem um plano de pagamento."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        installment_count = request.data.get("installments")
        account_id = request.data.get("account")
        payment_frequency = request.data.get("payment_frequency")
        first_due_date_raw = request.data.get("first_due_date")

        if not installment_count or int(installment_count) < 2:
            return Response(
                {"detail": "installments deve ser um número >= 2."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not account_id:
            return Response(
                {"detail": "account é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_due_date = None
        if first_due_date_raw:
            first_due_date = parse_date(str(first_due_date_raw))
            if first_due_date is None:
                return Response(
                    {"detail": "first_due_date inválida (use YYYY-MM-DD)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            account = Account.objects.get(pk=account_id, is_deleted=False)
        except Account.DoesNotExist:
            return Response(
                {"detail": "Account not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            if payment_frequency:
                payable.payment_frequency = payment_frequency
                payable.save(update_fields=["payment_frequency", "updated_at"])
            fixed_expense = generate_payable_installments(
                payable,
                int(installment_count),
                request.user,
                account,
                first_due_date=first_due_date,
            )

        return Response(
            {
                "payable": PayableSerializer(payable).data,
                "fixed_expense": FixedExpenseSerializer(fixed_expense).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PayableIncreaseValueView(APIView):
    """POST /payables/<pk>/increase-value/ — requisitos 4/5: aumenta o
    valor de uma dívida cumulativa e recalcula as parcelas em aberto."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Payable.objects.none()

    def post(self, request, pk):
        from decimal import Decimal

        from payables.services import increase_payable_value

        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        new_value = request.data.get("new_value")
        dry_run = bool(request.data.get("dry_run", True))
        if new_value is None:
            return Response(
                {"detail": "new_value é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            preview = increase_payable_value(
                payable,
                Decimal(str(new_value)),
                request.user,
                dry_run=dry_run,
            )
        except DjangoValidationError as exc:
            return Response(
                exc.message_dict, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "preview": RecalculationPreviewSerializer(preview).data,
                "payable": (
                    PayableSerializer(payable).data if not dry_run else None
                ),
            }
        )


class PayableRecalculateInstallmentsView(APIView):
    """POST /payables/<pk>/recalculate-installments/ — requisitos 5/6:
    redistribui as parcelas em aberto mantendo ou alterando a
    quantidade."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Payable.objects.none()

    def post(self, request, pk):
        from payables.services import recalculate_installments

        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        mode = request.data.get("mode")
        new_installment_count = request.data.get("new_installment_count")
        dry_run = bool(request.data.get("dry_run", True))

        try:
            preview = recalculate_installments(
                payable,
                mode=mode,
                new_installment_count=new_installment_count,
                user=request.user,
                dry_run=dry_run,
            )
        except DjangoValidationError as exc:
            return Response(
                exc.message_dict, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "preview": RecalculationPreviewSerializer(preview).data,
                "payable": (
                    PayableSerializer(payable).data if not dry_run else None
                ),
            }
        )


class PayableRedistributeAfterPaymentView(APIView):
    """POST /payables/<pk>/redistribute-after-payment/ — requisito 7:
    endpoint atômico que cria a Expense vinculada ao Payable e redistribui
    o saldo restante pelas parcelas pendentes numa única transação."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Payable.objects.none()

    def post(self, request, pk):
        from payables.services import create_expense_and_redistribute

        payable = Payable.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not payable:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        expense_data = request.data.get("expense")
        mode = request.data.get("mode")
        new_installment_count = request.data.get("new_installment_count")
        dry_run = bool(request.data.get("dry_run", True))

        if not expense_data or not expense_data.get("value"):
            return Response(
                {"detail": "expense.value é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            expense, preview = create_expense_and_redistribute(
                payable,
                expense_data,
                mode=mode,
                new_installment_count=new_installment_count,
                user=request.user,
                dry_run=dry_run,
            )
        except DjangoValidationError as exc:
            return Response(
                exc.message_dict, status=status.HTTP_400_BAD_REQUEST
            )

        from expenses.serializers import ExpenseSerializer

        return Response(
            {
                "expense": (
                    ExpenseSerializer(expense).data if expense else None
                ),
                "preview": RecalculationPreviewSerializer(preview).data,
                "payable": (
                    PayableSerializer(payable).data if not dry_run else None
                ),
            },
            status=(
                status.HTTP_201_CREATED if not dry_run else status.HTTP_200_OK
            ),
        )
