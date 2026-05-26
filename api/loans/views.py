from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
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
                category=loan.category,
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


def _add_months(date, months):
    from calendar import monthrange

    month = date.month - 1 + months
    year = date.year + month // 12
    month = month % 12 + 1
    day = min(date.day, monthrange(year, month)[1])
    from datetime import date as dt

    return dt(year, month, day)
