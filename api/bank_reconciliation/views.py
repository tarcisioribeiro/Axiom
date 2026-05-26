import hashlib

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.permissions import GlobalDefaultPermission
from expenses.models import Expense
from revenues.models import Revenue

from .models import BankStatementEntry, BankStatementImport
from .parsers import parse_statement
from .serializers import (
    BankStatementEntryManualMatchSerializer,
    BankStatementEntrySerializer,
    BankStatementEntryUpdateSerializer,
    BankStatementImportListSerializer,
    BankStatementImportSerializer,
)
from .services import recount_import_stats, run_matching


class BankStatementImportCreateView(APIView):
    """POST /api/v1/bank-reconciliation/imports/
    — upload and parse a statement file."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = BankStatementImport.objects.all()

    def post(self, request):
        file_obj = request.FILES.get("file")
        account_id = request.data.get("account")
        file_format = request.data.get("file_format", "").lower()

        if not file_obj:
            return Response(
                {"detail": "Arquivo não fornecido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not account_id:
            return Response(
                {"detail": "Conta não informada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file_format not in ("ofx", "csv", "cnab240", "cnab400"):
            # Auto-detect from filename
            name = file_obj.name.lower()
            if name.endswith(".ofx"):
                file_format = "ofx"
            elif name.endswith(".csv"):
                file_format = "csv"
            elif name.endswith(".rem") or name.endswith(".ret"):
                # CNAB files often use .rem (remessa) or .ret (retorno)
                # Default to CNAB 240; user can override via file_format field
                file_format = "cnab240"
            else:
                return Response(
                    {
                        "detail": (
                            "Formato inválido. Use OFX, CSV,"
                            " CNAB 240 ou CNAB 400."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        file_content = file_obj.read()
        file_hash = hashlib.sha256(file_content).hexdigest()

        # Check duplicate
        if BankStatementImport.objects.filter(
            owner=request.user, file_hash=file_hash
        ).exists():
            return Response(
                {"detail": "Arquivo já importado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create import record
        from accounts.models import Account

        try:
            account = Account.objects.get(pk=account_id)
        except Account.DoesNotExist:
            return Response(
                {"detail": "Conta não encontrada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stmt_import = BankStatementImport.objects.create(
            owner=request.user,
            created_by=request.user,
            account=account,
            file_hash=file_hash,
            original_filename=file_obj.name,
            file_format=file_format,
            status="processing",
        )

        # Parse
        try:
            transactions = parse_statement(file_content, file_format)
        except ValueError as exc:
            stmt_import.status = "failed"
            stmt_import.error_message = str(exc)
            stmt_import.save(update_fields=["status", "error_message"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Bulk create entries
        entries = [
            BankStatementEntry(
                statement_import=stmt_import,
                created_by=request.user,
                transaction_id=t["transaction_id"],
                date=t["date"],
                amount=t["amount"],
                description=t["description"],
                transaction_type=t["type"],
                status="pending",
            )
            for t in transactions
        ]
        BankStatementEntry.objects.bulk_create(entries)

        stmt_import.status = "completed"
        stmt_import.save(update_fields=["status"])
        recount_import_stats(stmt_import)

        serializer = BankStatementImportSerializer(stmt_import)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BankStatementImportListView(generics.ListAPIView):
    """GET /api/v1/bank-reconciliation/imports/
    — list all imports for current user."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = BankStatementImportListSerializer

    def get_queryset(self):
        return BankStatementImport.objects.filter(
            owner=self.request.user,
        ).order_by("-created_at")


class BankStatementImportDetailView(generics.RetrieveAPIView):
    """GET /api/v1/bank-reconciliation/imports/<pk>/
    — import detail with entries."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = BankStatementImportSerializer

    def get_queryset(self):
        return BankStatementImport.objects.filter(
            owner=self.request.user,
        ).prefetch_related("entries")


class BankStatementMatchView(APIView):
    """POST /api/v1/bank-reconciliation/imports/<pk>/match/
    — run auto-matching."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = BankStatementImport.objects.all()

    def post(self, request, pk):
        try:
            stmt_import = BankStatementImport.objects.get(
                pk=pk, owner=request.user
            )
        except BankStatementImport.DoesNotExist:
            return Response(
                {"detail": "Importação não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        run_matching(stmt_import)
        recount_import_stats(stmt_import)

        serializer = BankStatementImportSerializer(stmt_import)
        return Response(serializer.data)


class BankStatementEntryManualMatchView(APIView):
    """PATCH /api/v1/bank-reconciliation/imports/
    <import_pk>/entries/<entry_pk>/match/

    Manually link a statement entry to an existing Expense or Revenue.
    Sets match_confidence='manual' and status='matched'.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = BankStatementEntry.objects.all()

    def patch(self, request, import_pk, entry_pk):
        try:
            stmt_import = BankStatementImport.objects.get(
                pk=import_pk, owner=request.user
            )
        except BankStatementImport.DoesNotExist:
            return Response(
                {"detail": "Importação não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            entry = BankStatementEntry.objects.get(
                pk=entry_pk, statement_import=stmt_import, is_deleted=False
            )
        except BankStatementEntry.DoesNotExist:
            return Response(
                {"detail": "Entrada não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = BankStatementEntryManualMatchSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        matched_expense_id = serializer.validated_data.get(
            "matched_expense_id"
        )
        matched_revenue_id = serializer.validated_data.get(
            "matched_revenue_id"
        )

        if matched_expense_id:
            try:
                expense = Expense.objects.get(
                    pk=matched_expense_id,
                    created_by=request.user,
                    is_deleted=False,
                )
            except Expense.DoesNotExist:
                return Response(
                    {"detail": "Despesa não encontrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            entry.matched_expense = expense
            entry.matched_revenue = None
        else:
            try:
                revenue = Revenue.objects.get(
                    pk=matched_revenue_id,
                    created_by=request.user,
                    is_deleted=False,
                )
            except Revenue.DoesNotExist:
                return Response(
                    {"detail": "Receita não encontrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            entry.matched_revenue = revenue
            entry.matched_expense = None

        entry.match_confidence = "manual"
        entry.status = "matched"
        entry.save(
            update_fields=[
                "matched_expense",
                "matched_revenue",
                "match_confidence",
                "status",
            ]
        )
        recount_import_stats(stmt_import)

        return Response(BankStatementEntrySerializer(entry).data)


class BankStatementEntryUpdateView(generics.UpdateAPIView):
    """PATCH /api/v1/bank-reconciliation/entries/<pk>/
    — update entry status."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = BankStatementEntryUpdateSerializer
    http_method_names = ["patch"]

    def get_queryset(self):
        return BankStatementEntry.objects.filter(
            statement_import__owner=self.request.user,
        ).select_related("statement_import")

    def perform_update(self, serializer):
        entry = serializer.save()
        recount_import_stats(entry.statement_import)
