from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from loans.models import Loan, LoanInstallment
from loans.serializers import LoanInstallmentSerializer, LoanSerializer


class LoanCreateListView(BaseListCreateView):
    queryset = Loan.objects.all()  # GlobalDefaultPermission
    serializer_class = LoanSerializer

    def get_queryset(self):
        return Loan.objects.filter(
            created_by=self.request.user
        ).select_related("account", "benefited", "creditor", "guarantor")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class LoanRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    queryset = Loan.objects.all()  # GlobalDefaultPermission
    serializer_class = LoanSerializer

    def get_queryset(self):
        return Loan.objects.filter(
            created_by=self.request.user
        ).select_related("account", "benefited", "creditor", "guarantor")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class LoanInstallmentListView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = LoanInstallment.objects.none()

    def get(self, request, pk):
        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        installments = LoanInstallment.objects.filter(loan=loan).order_by(
            "installment_number"
        )
        serializer = LoanInstallmentSerializer(installments, many=True)
        return Response(serializer.data)

    def patch(self, request, pk):
        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
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
            installment = LoanInstallment.objects.get(
                loan=loan, installment_number=installment_number
            )
        except LoanInstallment.DoesNotExist:
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
        serializer = LoanInstallmentSerializer(
            installment, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LoanPaymentView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Loan.objects.none()

    def post(self, request, pk):
        from expenses.models import Expense

        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        value = request.data.get("value")
        account_id = request.data.get("account")
        date = request.data.get("date")
        notes = request.data.get("notes", "")

        if not all([value, account_id, date]):
            return Response(
                {"detail": "value, account and date are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from accounts.models import Account
        from accounts.services import recalculate_account_balance

        try:
            account = Account.objects.get(pk=account_id, is_deleted=False)
        except Account.DoesNotExist:
            return Response(
                {"detail": "Account not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            expense = Expense.objects.create(
                description=f"Pagamento: {loan.description}",
                value=value,
                date=date,
                horary=timezone.now().time(),
                category=loan.category,
                account=account,
                payed=True,
                notes=notes,
                related_loan=loan,
                created_by=request.user,
                updated_by=request.user,
            )
            recalculate_account_balance(account.id)

        from expenses.serializers import ExpenseSerializer
        from loans.serializers import LoanSerializer as LS

        return Response(
            {
                "expense": ExpenseSerializer(expense).data,
                "loan": LS(loan).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoanReceiptView(APIView):
    """
    Registra o recebimento de valor em um empréstimo onde o usuário é
    credor.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Loan.objects.none()

    def post(self, request, pk):
        from accounts.models import Account
        from accounts.services import recalculate_account_balance
        from revenues.models import Revenue

        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
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
                description=f"Recebimento: {loan.description}",
                value=value,
                date=date,
                horary=timezone.now().time(),
                category="loan_devolution",
                account=account,
                received=received,
                notes=notes,
                related_loan=loan,
                created_by=request.user,
                updated_by=request.user,
            )
            if received:
                recalculate_account_balance(account.id)

        from revenues.serializers import RevenueSerializer

        return Response(
            {
                "revenue": RevenueSerializer(revenue).data,
                "loan": LoanSerializer(loan).data,
                "scheduled": scheduled,
            },
            status=status.HTTP_201_CREATED,
        )


class LoanAmortizationView(APIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Loan.objects.none()

    def get(self, request, pk):
        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        method = request.query_params.get("method", "price").lower()
        if method not in ("price", "sac"):
            return Response(
                {"detail": "method must be 'price' or 'sac'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        n = loan.installments or 1
        pv = Decimal(str(loan.value))
        rate = Decimal(str(loan.interest_rate or 0)) / Decimal("100")
        start_date = loan.date

        schedule = []

        if method == "price":
            if rate == 0:
                payment = (pv / n).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                r = rate
                payment = (
                    pv * r * (1 + r) ** n / ((1 + r) ** n - 1)
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            balance = pv
            for i in range(1, n + 1):
                interest = (balance * rate).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                principal = (payment - interest).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                balance = (balance - principal).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                due = _add_months(start_date, i)
                schedule.append(
                    {
                        "installment": i,
                        "due_date": due.isoformat(),
                        "payment": str(payment),
                        "principal": str(principal),
                        "interest": str(interest),
                        "balance": str(max(balance, Decimal("0"))),
                    }
                )
        else:  # SAC
            principal = (pv / n).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            balance = pv
            for i in range(1, n + 1):
                interest = (balance * rate).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                payment = (principal + interest).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                balance = (balance - principal).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                due = _add_months(start_date, i)
                schedule.append(
                    {
                        "installment": i,
                        "due_date": due.isoformat(),
                        "payment": str(payment),
                        "principal": str(principal),
                        "interest": str(interest),
                        "balance": str(max(balance, Decimal("0"))),
                    }
                )

        return Response({"method": method, "schedule": schedule})


class LoanPaymentPlanView(APIView):
    """POST /loans/<pk>/payment-plan/ — converte um Loan sem parcelamento
    (installments <= 1) em um plano de pagamento parcelado, dando a Loan
    paridade com o fluxo de plano de pagamento de Payable (requisito 1).
    Fora do escopo de increase-value/recalculate-installments (decisão de
    negócio 5.2) — Loan mantém o parcelamento imutável após criado."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Loan.objects.none()

    def post(self, request, pk):
        from app.debt_installment_utils import (
            build_equal_installment_schedule,
            default_first_due_date,
        )
        from expenses.models import FixedExpense
        from expenses.serializers import FixedExpenseSerializer

        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if loan.installments and loan.installments > 1:
            return Response(
                {"detail": "Este empréstimo já tem um plano de pagamento."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        installment_count = request.data.get("installments")
        if not installment_count or int(installment_count) < 2:
            return Response(
                {"detail": "installments deve ser um número >= 2."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_due_date_raw = request.data.get("first_due_date")
        if first_due_date_raw:
            first_due_date = parse_date(str(first_due_date_raw))
            if first_due_date is None:
                return Response(
                    {"detail": "first_due_date inválida (use YYYY-MM-DD)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            first_due_date = default_first_due_date(
                loan.date.day,
                loan.payment_frequency,
                today=timezone.now().date(),
            )

        remaining_value = loan.value - loan.payed_value
        schedule = build_equal_installment_schedule(
            remaining_value,
            int(installment_count),
            loan.date,
            loan.payment_frequency,
            first_due_date=first_due_date,
        )

        with transaction.atomic():
            LoanInstallment.objects.bulk_create(
                [
                    LoanInstallment(
                        loan=loan,
                        installment_number=item["number"],
                        value=item["value"],
                        due_date=item["due_date"],
                        payed=False,
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    for item in schedule
                ]
            )
            loan.installments = int(installment_count)
            loan.save(update_fields=["installments", "updated_at"])

            first = schedule[0]
            fixed_expense = FixedExpense.objects.create(
                description=loan.description,
                default_value=first["value"],
                category=loan.category,
                account=loan.account,
                due_day=first["due_date"].day,
                is_active=True,
                allow_value_edit=False,
                related_loan=loan,
                created_by=request.user,
                updated_by=request.user,
            )

        return Response(
            {
                "loan": LoanSerializer(loan).data,
                "fixed_expense": FixedExpenseSerializer(fixed_expense).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoanRecalculateInstallmentsView(APIView):
    """POST /loans/<pk>/recalculate-installments/ — redistribui as parcelas
    em aberto de um empréstimo já parcelado, mantendo ou alterando a
    quantidade (paridade com o fluxo de Payable). Parcelas já pagas nunca
    são tocadas."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Loan.objects.none()

    def post(self, request, pk):
        from django.core.exceptions import (
            ValidationError as DjangoValidationError,
        )

        from loans.serializers import LoanRecalculationPreviewSerializer
        from loans.services import recalculate_loan_installments

        loan = Loan.objects.filter(
            pk=pk, created_by=request.user, is_deleted=False
        ).first()
        if not loan:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if not loan.installments or loan.installments <= 1:
            return Response(
                {"detail": "Este empréstimo não tem plano de pagamento."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mode = request.data.get("mode")
        new_installment_count = request.data.get("new_installment_count")
        dry_run = bool(request.data.get("dry_run", True))

        try:
            preview = recalculate_loan_installments(
                loan,
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
                "preview": LoanRecalculationPreviewSerializer(preview).data,
                "loan": (LoanSerializer(loan).data if not dry_run else None),
            }
        )


def _add_months(date, months):
    from calendar import monthrange

    month = date.month - 1 + months
    year = date.year + month // 12
    month = month % 12 + 1
    day = min(date.day, monthrange(year, month)[1])
    from datetime import date as dt

    return dt(year, month, day)
