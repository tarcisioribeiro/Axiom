import logging
from calendar import monthrange
from datetime import datetime

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from expenses.models import FixedExpense

from .models import (
    FinancialGoal,
    Vault,
    VaultRecurringContribution,
    VaultTransaction,
)
from .serializers import (
    FinancialGoalListSerializer,
    FinancialGoalSerializer,
    VaultDepositSerializer,
    VaultRecurringContributionCreateSerializer,
    VaultRecurringContributionSerializer,
    VaultSerializer,
    VaultTransactionSerializer,
    VaultTransactionUpdateSerializer,
    VaultWithdrawSerializer,
    VaultYieldUpdateSerializer,
)

logger = logging.getLogger(__name__)


class VaultListCreateView(BaseListCreateView):
    """
    ViewSet para listar e criar cofres.

    GET: Lista todos os cofres ativos
    POST: Cria um novo cofre
    """

    queryset = Vault.objects.all()
    serializer_class = VaultSerializer

    def get_queryset(self):
        queryset = Vault.objects.filter(created_by=self.request.user)
        account_id = self.request.query_params.get("account")
        is_active = self.request.query_params.get("is_active")

        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        return queryset.select_related("account")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VaultDetailView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em cofres.

    GET: Recupera um cofre específico
    PUT/PATCH: Atualiza um cofre
    DELETE: Remove um cofre (soft delete)
    """

    queryset = Vault.objects.all()
    serializer_class = VaultSerializer

    def get_queryset(self):
        return Vault.objects.filter(
            created_by=self.request.user
        ).select_related("account")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class VaultDepositView(APIView):
    """
    Endpoint para realizar depósitos em um cofre.

    POST: Realiza um depósito da conta associada para o cofre
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = Vault.objects.all()  # Required for GlobalDefaultPermission

    @transaction.atomic
    def post(self, request, pk):
        try:
            vault = Vault.objects.select_for_update().get(
                pk=pk, is_active=True
            )
            # Lock the associated account to prevent race conditions
            account = Account.objects.select_for_update().get(
                pk=vault.account_id
            )
            vault.account = account
        except Vault.DoesNotExist:
            return Response(
                {"error": "Cofre não encontrado ou inativo"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Account.DoesNotExist:
            return Response(
                {"error": "Conta associada não encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = VaultDepositSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        amount = serializer.validated_data["amount"]
        description = serializer.validated_data.get("description")

        try:
            vault_transaction = vault.deposit(
                amount=amount, description=description, user=request.user
            )
        except ValueError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )

        # Refresh objects from database to ensure consistent state
        # for serialization
        vault.refresh_from_db()
        vault.account.refresh_from_db()
        vault_transaction.refresh_from_db()

        return Response(
            {
                "message": "Depósito realizado com sucesso",
                "transaction": VaultTransactionSerializer(
                    vault_transaction
                ).data,
                "vault": VaultSerializer(vault).data,
            },
            status=status.HTTP_200_OK,
        )


class VaultWithdrawView(APIView):
    """
    Endpoint para realizar saques de um cofre.

    POST: Realiza um saque do cofre para a conta associada
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = Vault.objects.all()  # Required for GlobalDefaultPermission

    @transaction.atomic
    def post(self, request, pk):
        try:
            vault = Vault.objects.select_for_update().get(
                pk=pk, is_active=True
            )
            # Lock the associated account to prevent race conditions
            account = Account.objects.select_for_update().get(
                pk=vault.account_id
            )
            vault.account = account
        except Vault.DoesNotExist:
            return Response(
                {"error": "Cofre não encontrado ou inativo"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Account.DoesNotExist:
            return Response(
                {"error": "Conta associada não encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = VaultWithdrawSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        amount = serializer.validated_data["amount"]
        description = serializer.validated_data.get("description")

        try:
            vault_transaction = vault.withdraw(
                amount=amount, description=description, user=request.user
            )
        except ValueError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )

        # Refresh objects from database to ensure consistent state
        # for serialization
        vault.refresh_from_db()
        vault.account.refresh_from_db()
        vault_transaction.refresh_from_db()

        return Response(
            {
                "message": "Saque realizado com sucesso",
                "transaction": VaultTransactionSerializer(
                    vault_transaction
                ).data,
                "vault": VaultSerializer(vault).data,
            },
            status=status.HTTP_200_OK,
        )


class VaultApplyYieldView(APIView):
    """
    Endpoint para aplicar rendimentos pendentes a um cofre.

    POST: Calcula e aplica os rendimentos desde a última aplicação
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = Vault.objects.all()  # Required for GlobalDefaultPermission

    @transaction.atomic
    def post(self, request, pk):
        try:
            vault = Vault.objects.select_for_update().get(
                pk=pk, is_active=True
            )
        except Vault.DoesNotExist:
            return Response(
                {"error": "Cofre não encontrado ou inativo"},
                status=status.HTTP_404_NOT_FOUND,
            )

        yield_value = vault.apply_yield(user=request.user)

        return Response(
            {
                "message": (
                    "Rendimento aplicado com sucesso"
                    if yield_value > 0
                    else "Nenhum rendimento a aplicar"
                ),
                "yield_applied": float(yield_value),
                "vault": VaultSerializer(vault).data,
            },
            status=status.HTTP_200_OK,
        )


class VaultUpdateYieldView(APIView):
    """
    Endpoint para atualizar taxa de rendimento e/ou rendimentos acumulados.

    POST: Atualiza taxa e opcionalmente recalcula rendimentos
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = Vault.objects.all()  # Required for GlobalDefaultPermission

    @transaction.atomic
    def post(self, request, pk):
        try:
            vault = Vault.objects.select_for_update().get(pk=pk)
        except Vault.DoesNotExist:
            return Response(
                {"error": "Cofre não encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = VaultYieldUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        response_data = {"message": "Atualização realizada com sucesso"}

        # Atualizar taxa de rendimento anual
        if "annual_yield_rate" in data:
            old_annual_rate = vault.annual_yield_rate
            vault.annual_yield_rate = data["annual_yield_rate"]
            response_data["annual_yield_rate_changed"] = {
                "old": float(old_annual_rate),
                "new": float(data["annual_yield_rate"]),
            }

        # Atualizar taxa de rendimento diária (legado)
        if "yield_rate" in data:
            old_rate = vault.yield_rate
            vault.yield_rate = data["yield_rate"]
            response_data["yield_rate_changed"] = {
                "old": float(old_rate),
                "new": float(data["yield_rate"]),
            }

        # Atualizar rendimentos acumulados manualmente
        if "accumulated_yield" in data:
            old_yield = vault.accumulated_yield
            difference = data["accumulated_yield"] - old_yield

            vault.accumulated_yield = data["accumulated_yield"]
            vault.current_balance += difference

            response_data["accumulated_yield_changed"] = {
                "old": float(old_yield),
                "new": float(data["accumulated_yield"]),
                "balance_adjustment": float(difference),
            }

        # Recalcular rendimentos se solicitado
        if data.get("recalculate", False):
            recalc_result = vault.recalculate_yields(
                new_rate=data.get("yield_rate"),
                from_date=data.get("from_date"),
                user=request.user,
            )
            response_data["recalculation"] = {
                "reversed_amount": float(recalc_result["reversed_amount"]),
                "new_yield_amount": float(recalc_result["new_yield_amount"]),
                "difference": float(recalc_result["difference"]),
            }

        vault.updated_by = request.user
        vault.save()

        response_data["vault"] = VaultSerializer(vault).data
        return Response(response_data, status=status.HTTP_200_OK)


class VaultTransactionListView(generics.ListAPIView):
    """
    Lista todas as transações de um cofre específico.
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    serializer_class = VaultTransactionSerializer
    queryset = (
        VaultTransaction.objects.all()
    )  # Required for GlobalDefaultPermission

    def get_queryset(self):
        vault_id = self.kwargs.get("pk")
        queryset = VaultTransaction.objects.filter(
            vault_id=vault_id
        ).select_related("vault")

        # Filtros opcionais
        transaction_type = self.request.query_params.get("type")
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        return queryset


class AllVaultTransactionsView(generics.ListAPIView):
    """
    Lista todas as transações de todos os cofres.
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    serializer_class = VaultTransactionSerializer
    queryset = VaultTransaction.objects.all()

    def get_queryset(self):
        queryset = (
            super().get_queryset().select_related("vault", "vault__account")
        )

        # Filtros opcionais
        vault_id = self.request.query_params.get("vault")
        transaction_type = self.request.query_params.get("type")

        if vault_id:
            queryset = queryset.filter(vault_id=vault_id)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        return queryset


class VaultTransactionUpdateView(APIView):
    """
    Endpoint para editar ou excluir transações de rendimento.

    PATCH: Edita uma transação de rendimento
    DELETE: Exclui uma transação de rendimento (soft delete)
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = (
        VaultTransaction.objects.all()
    )  # Required for GlobalDefaultPermission

    @transaction.atomic
    def patch(self, request, pk):
        try:
            vault_transaction = (
                VaultTransaction.objects.select_for_update().get(pk=pk)
            )
        except VaultTransaction.DoesNotExist:
            return Response(
                {"error": "Transação não encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if vault_transaction.transaction_type != "yield":
            return Response(
                {
                    "error": (
                        "Apenas transações de rendimento podem ser editadas"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        vault = Vault.objects.select_for_update().get(
            pk=vault_transaction.vault_id
        )
        old_amount = vault_transaction.amount

        serializer = VaultTransactionUpdateSerializer(
            vault_transaction, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        new_amount = serializer.validated_data.get("amount", old_amount)
        amount_difference = new_amount - old_amount

        # Atualiza os saldos do cofre
        vault.current_balance += amount_difference
        vault.accumulated_yield += amount_difference
        vault.save()

        serializer.save()

        return Response(
            {
                "message": "Transação atualizada com sucesso",
                "transaction": VaultTransactionSerializer(
                    vault_transaction
                ).data,
                "vault": VaultSerializer(vault).data,
                "adjustment": {
                    "old_amount": float(old_amount),
                    "new_amount": float(new_amount),
                    "difference": float(amount_difference),
                },
            },
            status=status.HTTP_200_OK,
        )

    @transaction.atomic
    def delete(self, request, pk):
        try:
            vault_transaction = (
                VaultTransaction.objects.select_for_update().get(pk=pk)
            )
        except VaultTransaction.DoesNotExist:
            return Response(
                {"error": "Transação não encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if vault_transaction.transaction_type != "yield":
            return Response(
                {
                    "error": (
                        "Apenas transações de rendimento podem ser excluídas"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        vault = Vault.objects.select_for_update().get(
            pk=vault_transaction.vault_id
        )
        amount = vault_transaction.amount

        # Reverte os saldos do cofre
        vault.current_balance -= amount
        vault.accumulated_yield -= amount
        vault.save()

        # Soft delete
        vault_transaction.is_deleted = True
        vault_transaction.deleted_at = timezone.now()
        vault_transaction.save()

        return Response(
            {
                "message": "Transação excluída com sucesso",
                "vault": VaultSerializer(vault).data,
                "reversed_amount": float(amount),
            },
            status=status.HTTP_200_OK,
        )


# ============== Financial Goals Views ==============


class FinancialGoalListCreateView(BaseListCreateView):
    """
    ViewSet para listar e criar metas financeiras.

    GET: Lista todas as metas
    POST: Cria uma nova meta
    """

    queryset = FinancialGoal.objects.all()

    def get_serializer_class(self):
        if self.request.method == "GET":
            return FinancialGoalListSerializer
        return FinancialGoalSerializer

    def get_queryset(self):
        queryset = FinancialGoal.objects.filter(created_by=self.request.user)
        is_active = self.request.query_params.get("is_active")
        is_completed = self.request.query_params.get("is_completed")
        category = self.request.query_params.get("category")

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")
        if is_completed is not None:
            queryset = queryset.filter(
                is_completed=is_completed.lower() == "true"
            )
        if category:
            queryset = queryset.filter(category=category)

        return queryset.prefetch_related("vaults")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FinancialGoalDetailView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em metas financeiras.

    GET: Recupera uma meta específica
    PUT/PATCH: Atualiza uma meta
    DELETE: Remove uma meta (soft delete)
    """

    queryset = FinancialGoal.objects.all()
    serializer_class = FinancialGoalSerializer

    def get_queryset(self):
        return FinancialGoal.objects.filter(
            created_by=self.request.user
        ).prefetch_related("vaults", "vaults__account")

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class FinancialGoalCheckCompletionView(APIView):
    """
    Verifica e atualiza o status de conclusão de uma meta.

    POST: Verifica se a meta foi atingida
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = (
        FinancialGoal.objects.all()
    )  # Required for GlobalDefaultPermission

    def post(self, request, pk):
        try:
            goal = FinancialGoal.objects.get(pk=pk, is_active=True)
        except FinancialGoal.DoesNotExist:
            return Response(
                {"error": "Meta não encontrada ou inativa"},
                status=status.HTTP_404_NOT_FOUND,
            )

        was_completed = goal.check_completion()

        return Response(
            {
                "message": (
                    "Meta concluída!"
                    if was_completed
                    else "Meta ainda não atingida"
                ),
                "is_completed": goal.is_completed,
                "current_value": float(goal.current_value),
                "target_value": float(goal.target_value),
                "progress_percentage": float(goal.progress_percentage),
                "goal": FinancialGoalSerializer(goal).data,
            },
            status=status.HTTP_200_OK,
        )


class FinancialGoalAddVaultsView(APIView):
    """
    Adiciona cofres a uma meta financeira.

    POST: Adiciona um ou mais cofres à meta
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = (
        FinancialGoal.objects.all()
    )  # Required for GlobalDefaultPermission

    def post(self, request, pk):
        try:
            goal = FinancialGoal.objects.get(pk=pk)
        except FinancialGoal.DoesNotExist:
            return Response(
                {"error": "Meta não encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        vault_ids = request.data.get("vault_ids", [])
        if not vault_ids:
            return Response(
                {"error": "Nenhum cofre especificado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar se os cofres existem
        vaults = Vault.objects.filter(id__in=vault_ids, is_active=True)

        if not vaults.exists():
            return Response(
                {"error": "Nenhum cofre válido encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Adicionar cofres
        goal.vaults.add(*vaults)
        goal.updated_by = request.user
        goal.save()

        # Verificar conclusão após adicionar cofres
        goal.check_completion()

        return Response(
            {
                "message": f"{vaults.count()} cofre(s) adicionado(s) à meta",
                "goal": FinancialGoalSerializer(goal).data,
            },
            status=status.HTTP_200_OK,
        )


class FinancialGoalRemoveVaultsView(APIView):
    """
    Remove cofres de uma meta financeira.

    POST: Remove um ou mais cofres da meta
    """

    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    queryset = (
        FinancialGoal.objects.all()
    )  # Required for GlobalDefaultPermission

    def post(self, request, pk):
        try:
            goal = FinancialGoal.objects.get(pk=pk)
        except FinancialGoal.DoesNotExist:
            return Response(
                {"error": "Meta não encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        vault_ids = request.data.get("vault_ids", [])
        if not vault_ids:
            return Response(
                {"error": "Nenhum cofre especificado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Remover cofres
        vaults = Vault.objects.filter(id__in=vault_ids)
        goal.vaults.remove(*vaults)
        goal.updated_by = request.user
        goal.save()

        return Response(
            {
                "message": f"{vaults.count()} cofre(s) removido(s) da meta",
                "goal": FinancialGoalSerializer(goal).data,
            },
            status=status.HTTP_200_OK,
        )


# ============== Vault Recurring Contributions Views ==============


class VaultRecurringContributionListCreateView(BaseListCreateView):
    """Lista e cria contribuições recorrentes de um cofre específico."""

    queryset = VaultRecurringContribution.objects.all()
    serializer_class = VaultRecurringContributionSerializer

    def get_queryset(self):
        vault_id = self.kwargs.get("vault_pk")
        qs = VaultRecurringContribution.objects.filter(
            vault_id=vault_id
        ).select_related("vault", "vault__account", "fixed_expense")
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return VaultRecurringContributionCreateSerializer
        return VaultRecurringContributionSerializer

    def perform_create(self, serializer):
        vault_id = self.kwargs.get("vault_pk")
        vault = Vault.objects.select_related("account").get(pk=vault_id)

        contribution = serializer.save(
            vault=vault,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

        # Auto-create the corresponding FixedExpense template
        fixed_expense = FixedExpense(
            description=contribution.description,
            default_value=contribution.amount,
            category="investments",
            account=vault.account,
            due_day=contribution.day_of_month,
            is_active=contribution.is_active,
            notes=(
                "Contribuição recorrente automática"
                f" para o cofre: {vault.description}"
            ),
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        fixed_expense.save()

        contribution.fixed_expense = fixed_expense
        contribution.save(update_fields=["fixed_expense"])


class VaultRecurringContributionDetailView(BaseRetrieveUpdateDestroyView):
    """Detalhe, atualização e exclusão de contribuição recorrente."""

    queryset = VaultRecurringContribution.objects.all()
    serializer_class = VaultRecurringContributionSerializer

    def get_queryset(self):
        return VaultRecurringContribution.objects.select_related(
            "vault", "vault__account", "fixed_expense"
        )

    def perform_update(self, serializer):
        contribution = serializer.save(updated_by=self.request.user)

        # Sync the linked FixedExpense
        if contribution.fixed_expense:
            fe = contribution.fixed_expense
            fe.description = contribution.description
            fe.default_value = contribution.amount
            fe.due_day = contribution.day_of_month
            fe.is_active = contribution.is_active
            fe.updated_by = self.request.user
            fe.save()

    def perform_destroy(self, instance):
        # Deactivate the linked FixedExpense instead of deleting it
        if instance.fixed_expense:
            fe = instance.fixed_expense
            fe.is_active = False
            fe.updated_by = self.request.user
            fe.save()

        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


class GenerateVaultContributionsView(APIView):
    """
    Processa contribuições recorrentes para um mês específico.

    POST: Executa os depósitos programados e cria VaultTransactions.

    Body: { "month": "YYYY-MM" }  (default: mês atual)
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = VaultRecurringContribution.objects.none()

    @transaction.atomic
    def post(self, request):
        month_str = request.data.get("month")
        if month_str:
            try:
                year_int, month_int = [int(x) for x in month_str.split("-")]
                if not (1 <= month_int <= 12):
                    raise ValueError
            except (ValueError, AttributeError):
                return Response(
                    {"error": "Formato de mês inválido. Use YYYY-MM."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            today = timezone.localdate()
            year_int, month_int = today.year, today.month
            month_str = f"{year_int:04d}-{month_int:02d}"

        contributions = VaultRecurringContribution.objects.filter(
            is_active=True
        ).select_related("vault", "vault__account")

        generated = []
        skipped = []
        errors = []

        for contrib in contributions:
            if not contrib.is_in_scope_for_month(year_int, month_int):
                skipped.append(
                    {"id": contrib.id, "reason": "Fora do período ativo"}
                )
                continue

            if contrib.last_generated_month == month_str:
                skipped.append(
                    {"id": contrib.id, "reason": "Já gerado para este mês"}
                )
                continue

            vault = Vault.objects.select_for_update().get(pk=contrib.vault_id)
            account = Account.objects.select_for_update().get(
                pk=vault.account_id
            )
            vault.account = account

            last_day = monthrange(year_int, month_int)[1]
            day = min(contrib.day_of_month, last_day)
            try:
                deposit_date = datetime(year_int, month_int, day).date()
            except ValueError:
                deposit_date = datetime(year_int, month_int, last_day).date()

            try:
                vault_tx = vault.deposit(
                    amount=contrib.amount,
                    description=contrib.description,
                    user=request.user,
                )
                vault_tx.recurring_contribution = contrib
                vault_tx.transaction_date = deposit_date
                vault_tx.save(
                    update_fields=[
                        "recurring_contribution",
                        "transaction_date",
                    ]
                )

                contrib.last_generated_month = month_str
                contrib.save(update_fields=["last_generated_month"])

                generated.append(
                    {
                        "contribution_id": contrib.id,
                        "vault": contrib.vault.description,
                        "amount": float(contrib.amount),
                        "transaction_id": vault_tx.id,
                        "deposit_date": deposit_date.isoformat(),
                    }
                )
            except ValueError as e:
                errors.append(
                    {
                        "contribution_id": contrib.id,
                        "vault": contrib.vault.description,
                        "error": str(e),
                    }
                )

        return Response(
            {
                "month": month_str,
                "generated_count": len(generated),
                "skipped_count": len(skipped),
                "error_count": len(errors),
                "generated": generated,
                "errors": errors,
            },
            status=status.HTTP_200_OK,
        )


class VaultContributionHistoryView(generics.ListAPIView):
    """
    Histórico de contribuições recorrentes geradas para um cofre.

    Retorna VaultTransactions do tipo 'deposit' geradas por
    contribuições recorrentes.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = VaultTransactionSerializer
    queryset = VaultTransaction.objects.all()

    def get_queryset(self):
        vault_id = self.kwargs.get("vault_pk")
        return (
            VaultTransaction.objects.filter(
                vault_id=vault_id,
                recurring_contribution__isnull=False,
            )
            .select_related("vault", "recurring_contribution")
            .order_by("-transaction_date")
        )


# ============== Vault Simulator View ==============

MONTH_NAMES_PT = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
]


class VaultSimulatorView(APIView):
    """
    Simulador de rendimento de cofre (sem persistência).

    POST: Recebe até 3 cenários e retorna projeções mensais
    com juros compostos.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        scenarios_data = request.data.get("scenarios", [])

        if not scenarios_data:
            return Response(
                {"error": "Pelo menos um cenário é necessário."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(scenarios_data) > 3:
            return Response(
                {"error": "Máximo de 3 cenários permitido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        results = []

        for i, scenario in enumerate(scenarios_data):
            try:
                name = scenario.get("name") or f"Cenário {i + 1}"
                initial_amount = float(scenario.get("initial_amount", 0))
                monthly_deposit = float(scenario.get("monthly_deposit", 0))
                annual_rate = float(scenario.get("annual_rate", 0))
                months = int(scenario.get("months", 12))
            except (ValueError, TypeError):
                return Response(
                    {"error": f"Dados inválidos no cenário {i + 1}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if initial_amount < 0 or monthly_deposit < 0:
                return Response(
                    {"error": "Valores não podem ser negativos."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if annual_rate < 0 or annual_rate > 10000:
                return Response(
                    {"error": "Taxa anual inválida."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if months < 1 or months > 600:
                return Response(
                    {"error": "Prazo inválido (1–600 meses)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Taxa mensal equivalente à taxa anual
            monthly_rate = (1 + annual_rate / 100) ** (1 / 12) - 1

            data_points = []
            balance = initial_amount

            year = today.year
            month = today.month

            # Ponto 0: saldo inicial
            data_points.append(
                {
                    "month": 0,
                    "balance": round(balance, 2),
                    "label": f"{MONTH_NAMES_PT[month - 1]}/{year}",
                }
            )

            for m in range(1, months + 1):
                balance = balance * (1 + monthly_rate) + monthly_deposit
                next_month = month + m
                next_year = year + (next_month - 1) // 12
                next_month_idx = (next_month - 1) % 12
                data_points.append(
                    {
                        "month": m,
                        "balance": round(balance, 2),
                        "label": (
                            f"{MONTH_NAMES_PT[next_month_idx]}/{next_year}"
                        ),
                    }
                )

            total_invested = initial_amount + monthly_deposit * months
            total_yield = round(balance - total_invested, 2)

            results.append(
                {
                    "name": name,
                    "initial_amount": initial_amount,
                    "monthly_deposit": monthly_deposit,
                    "annual_rate": annual_rate,
                    "monthly_rate": round(monthly_rate * 100, 6),
                    "months": months,
                    "final_balance": round(balance, 2),
                    "total_invested": round(total_invested, 2),
                    "total_yield": total_yield,
                    "data_points": data_points,
                }
            )

        return Response({"scenarios": results}, status=status.HTTP_200_OK)
