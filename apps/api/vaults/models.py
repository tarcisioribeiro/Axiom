import datetime
from calendar import monthrange
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.utils import timezone

from app.models import BaseModel
from vaults.services.yield_calc import (
    compound_yield,
    count_business_days,
    daily_rate_from,
)

__all__ = [
    "count_business_days",
    "Vault",
    "VaultTransaction",
    "VaultRecurringContribution",
    "FinancialGoal",
]


VAULT_TRANSACTION_TYPES = (
    ("deposit", "Depósito"),
    ("withdrawal", "Saque"),
    ("yield", "Rendimento"),
)


class Vault(BaseModel):
    """
    Modelo para cofres financeiros.

    Um cofre é uma reserva financeira associada a uma conta bancária,
    com possibilidade de rendimento automático baseado em taxa configurável.
    """

    description = models.CharField(
        max_length=200,
        verbose_name="Descrição",
        help_text="Nome ou descrição do cofre",
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.PROTECT,
        verbose_name="Conta Associada",
        related_name="vaults",
        help_text="Conta bancária associada a este cofre",
    )
    current_balance = models.DecimalField(
        verbose_name="Saldo Atual",
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Saldo atual do cofre (incluindo rendimentos)",
    )
    accumulated_yield = models.DecimalField(
        verbose_name="Rendimentos Acumulados",
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total de rendimentos acumulados",
    )
    yield_rate = models.DecimalField(
        verbose_name="Taxa de Rendimento Diária (legado)",
        max_digits=10,
        decimal_places=6,
        default=Decimal("0.000000"),
        help_text="Taxa de rendimento diária (legado) - use annual_yield_rate",
    )
    annual_yield_rate = models.DecimalField(
        verbose_name="Taxa de Rendimento Anual",
        max_digits=8,
        decimal_places=4,
        default=Decimal("0.0000"),
        help_text="Taxa de rendimento anual (ex: 0.1200 = 12% ao ano)",
    )
    last_yield_date = models.DateField(
        verbose_name="Data do Último Rendimento",
        null=True,
        blank=True,
        help_text="Data em que o último rendimento foi calculado",
    )
    is_active = models.BooleanField(
        verbose_name="Ativo",
        default=True,
        help_text="Se o cofre está ativo e aceitando operações",
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    currency_code = models.CharField(
        max_length=3,
        default="BRL",
        verbose_name="Moeda",
        help_text="Código ISO 4217 da moeda (ex: BRL, USD, EUR)",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Cofre"
        verbose_name_plural = "Cofres"
        indexes = [
            models.Index(fields=["account", "is_active"]),
            models.Index(fields=["is_active", "is_deleted"]),
        ]

    def __str__(self):
        return f"{self.description} - {self.account.account_name}"

    @property
    def daily_yield_rate(self):
        """
        Calcula a taxa diária a partir da taxa anual.
        Se annual_yield_rate > 0, usa ela. Caso contrário,
        usa yield_rate (legado).
        """
        return daily_rate_from(self.annual_yield_rate, self.yield_rate)

    def calculate_yield(self, as_of_date=None):
        """
        Calcula o rendimento do cofre até a data especificada.

        Parameters
        ----------
        as_of_date : date, optional
            Data até a qual calcular o rendimento. Default é hoje.

        Returns
        -------
        Decimal
            Valor do rendimento calculado
        """
        if as_of_date is None:
            as_of_date = timezone.now().date()

        if not self.last_yield_date or self.daily_yield_rate <= 0:
            return Decimal("0.00")

        # Número de dias úteis desde o último rendimento
        days = count_business_days(self.last_yield_date, as_of_date)
        if days <= 0:
            return Decimal("0.00")

        # Rendimento composto diário sobre o principal (saldo - rendimentos);
        # sem distinção positiva, usa o saldo total.
        principal = self.current_balance - self.accumulated_yield
        if principal <= 0:
            principal = self.current_balance

        return compound_yield(principal, self.daily_yield_rate, days)

    def apply_yield(self, as_of_date=None, user=None):
        """
        Aplica o rendimento calculado ao saldo do cofre.

        Parameters
        ----------
        as_of_date : date, optional
            Data até a qual calcular e aplicar o rendimento.
        user : User, optional
            Usuário que está realizando a operação.

        Returns
        -------
        Decimal
            Valor do rendimento aplicado
        """
        if as_of_date is None:
            as_of_date = timezone.now().date()

        yield_value = self.calculate_yield(as_of_date)

        with transaction.atomic():
            if yield_value > 0:
                self.current_balance += yield_value
                self.accumulated_yield += yield_value
                self.last_yield_date = as_of_date

                self._materialize_yield_revenue(yield_value, as_of_date, user)

                # Registrar a transação de rendimento
                VaultTransaction.objects.create(
                    vault=self,
                    transaction_type="yield",
                    amount=yield_value,
                    balance_after=self.current_balance,
                    description=f"Rendimento automático até {as_of_date}",
                    created_by=user or self.created_by,
                )

                self.save()

            # Defesa em profundidade: garante Σ(Revenue income ativas) ==
            # accumulated_yield mesmo se algo fora deste método tiver
            # desviado um lado do outro (recálculo de taxa, edição manual).
            drift = self._reconcile_yield_invariant(user)

            if yield_value > 0 or drift != 0:
                # O rendimento é lançado como receita na conta associada, de
                # modo que o saldo da conta (receitas - despesas) acompanhe
                # o valor reservado no cofre e o saldo disponível não seja
                # afetado.
                from accounts.services import recalculate_account_balance

                recalculate_account_balance(self.account_id)

        return yield_value

    def _materialize_yield_revenue(self, yield_value, as_of_date, user):
        """
        Soma ``yield_value`` na receita de rendimento consolidada do mês.

        Cria a receita (categoria ``income``) se ainda não existir uma para
        este cofre no mês de ``as_of_date``. Retorna a ``Revenue`` afetada.
        """
        from revenues.models import Revenue

        month_start = as_of_date.replace(day=1)
        if as_of_date.month == 12:
            next_month = datetime.date(as_of_date.year + 1, 1, 1)
        else:
            next_month = datetime.date(
                as_of_date.year, as_of_date.month + 1, 1
            )

        revenue = (
            Revenue.objects.filter(
                related_vault=self,
                account=self.account,
                category="income",
                is_deleted=False,
                date__gte=month_start,
                date__lt=next_month,
            )
            .order_by("created_at")
            .first()
        )

        if revenue is None:
            revenue = Revenue.objects.create(
                description=(
                    f"Rendimento — {self.description} "
                    f"({month_start.strftime('%m/%Y')})"
                ),
                value=yield_value,
                date=as_of_date,
                horary=timezone.now().time(),
                category="income",
                account=self.account,
                received=True,
                related_vault=self,
                member=self.account.owner,
                created_by=user or self.created_by,
                updated_by=user or self.created_by,
                notes=(
                    "Receita gerada automaticamente pelo rendimento do cofre."
                ),
            )
        else:
            revenue.value += yield_value
            revenue.net_amount = None  # recalculado no save()
            revenue.updated_by = user or self.created_by
            revenue.save()

        return revenue

    def deposit(self, amount, description=None, user=None):
        """
        Realiza um depósito no cofre.

        Parameters
        ----------
        amount : Decimal
            Valor a ser depositado
        description : str, optional
            Descrição do depósito
        user : User, optional
            Usuário que está realizando o depósito

        Returns
        -------
        VaultTransaction
            Transação criada
        """
        if amount <= 0:
            raise ValueError("O valor do depósito deve ser positivo")

        # Verificar saldo disponível na conta (total - reservado em cofres)
        available = self.account.available_balance
        if available < amount:
            raise ValueError(
                f"Saldo insuficiente na conta. "
                f"Disponível: {available},"
                f" Solicitado: {amount}"
            )

        # Aplicar rendimentos pendentes antes do depósito
        was_empty = self.current_balance <= 0
        self.apply_yield(user=user)

        # Atualizar saldo do cofre. O saldo da conta NÃO é alterado aqui: ele
        # continua sendo (receitas recebidas - despesas pagas); o valor movido
        # para o cofre é refletido em Account.available_balance.
        self.current_balance += amount

        # Reinicia o "relógio" de rendimento quando o cofre estava zerado, para
        # não acumular rendimento retroativo sobre um período sem saldo.
        if was_empty or not self.last_yield_date:
            self.last_yield_date = timezone.now().date()

        self.save()

        # Registrar transação
        vault_transaction = VaultTransaction.objects.create(
            vault=self,
            transaction_type="deposit",
            amount=amount,
            balance_after=self.current_balance,
            description=description or "Depósito",
            created_by=user,
        )

        return vault_transaction

    def withdraw(self, amount, description=None, user=None):
        """
        Realiza um saque do cofre.

        Parameters
        ----------
        amount : Decimal
            Valor a ser sacado
        description : str, optional
            Descrição do saque
        user : User, optional
            Usuário que está realizando o saque

        Returns
        -------
        VaultTransaction
            Transação criada
        """
        if amount <= 0:
            raise ValueError("O valor do saque deve ser positivo")

        with transaction.atomic():
            # Aplicar rendimentos pendentes antes do saque
            self.apply_yield(user=user)

            if amount > self.current_balance:
                raise ValueError(
                    f"Saldo insuficiente no cofre. "
                    f"Disponível: {self.current_balance}, Solicitado: {amount}"
                )

            # Atualizar saldo do cofre. O principal sai primeiro; o valor
            # deixa de estar reservado e volta a Account.available_balance
            # automaticamente.
            yield_before = self.accumulated_yield
            self.current_balance -= amount

            if self.current_balance <= 0:
                # Cofre zerado: o rendimento acumulado deixa de existir e o
                # "relógio" de rendimento é encerrado, para que um próximo
                # depósito reinicie a contagem a partir da data do depósito.
                self.current_balance = Decimal("0.00")
                self.accumulated_yield = Decimal("0.00")
                self.last_yield_date = None
            elif self.accumulated_yield > self.current_balance:
                # accumulated_yield nunca pode exceder o saldo do cofre.
                self.accumulated_yield = self.current_balance

            self.save()

            # O rendimento consumido no saque deixa de existir: abate as
            # receitas de rendimento correspondentes para não vazar ao saldo
            # disponível.
            yield_consumed = yield_before - self.accumulated_yield
            if yield_consumed > 0:
                self._reduce_yield_revenues(yield_consumed, user)

            # Defesa em profundidade: mesma garantia de invariante aplicada
            # em apply_yield.
            self._reconcile_yield_invariant(user)

            # Registrar transação
            vault_transaction = VaultTransaction.objects.create(
                vault=self,
                transaction_type="withdrawal",
                amount=amount,
                balance_after=self.current_balance,
                description=description or "Saque",
                created_by=user,
            )

        return vault_transaction

    def recalculate_yields(self, new_rate=None, from_date=None, user=None):
        """
        Recalcula os rendimentos com uma nova taxa a partir de uma data.

        Parameters
        ----------
        new_rate : Decimal, optional
            Nova taxa anual de rendimento (ex: 0.1200 = 12% a.a.).
            Se não fornecida, usa a taxa atual.
        from_date : date, optional
            Data a partir da qual recalcular. Se não fornecida, recalcula tudo.
        user : User, optional
            Usuário que está realizando a operação.

        Returns
        -------
        dict
            Informações sobre o recálculo
        """
        if new_rate is not None:
            self.annual_yield_rate = new_rate

        with transaction.atomic():
            # Obter todas as transações de rendimento para recalcular
            yield_transactions = self.transactions.filter(
                transaction_type="yield", is_deleted=False
            )

            if from_date:
                yield_transactions = yield_transactions.filter(
                    created_at__date__gte=from_date
                )

            # Reverter os rendimentos
            total_reversed = Decimal("0.00")
            for yield_txn in yield_transactions:
                total_reversed += yield_txn.amount
                yield_txn.is_deleted = True
                yield_txn.deleted_at = timezone.now()
                yield_txn.save()

            # Estornar as receitas de rendimento consolidadas correspondentes.
            self._reduce_yield_revenues(total_reversed, user, recalc=False)

            # Atualizar o saldo do cofre
            self.current_balance -= total_reversed
            self.accumulated_yield -= total_reversed
            if self.current_balance < 0:
                self.current_balance = Decimal("0.00")
            if self.accumulated_yield < 0:
                self.accumulated_yield = Decimal("0.00")

            # Recalcular a partir do primeiro depósito ou from_date
            first_deposit = (
                self.transactions.filter(
                    transaction_type="deposit", is_deleted=False
                )
                .order_by("created_at")
                .first()
            )

            if first_deposit:
                start_date = from_date or first_deposit.created_at.date()
                self.last_yield_date = start_date

            self.save()

            # Defesa em profundidade antes de recalcular a conta e reaplicar.
            self._reconcile_yield_invariant(user)

            # O estorno das receitas altera o saldo da conta associada.
            from accounts.services import recalculate_account_balance

            recalculate_account_balance(self.account_id)

            # Aplicar novo rendimento (recalcula a conta novamente por dentro).
            new_yield = self.apply_yield(user=user)

        return {
            "reversed_amount": total_reversed,
            "new_yield_amount": new_yield,
            "difference": new_yield - total_reversed,
        }

    def _reduce_yield_revenues(self, amount, user, recalc=True):
        """
        Abate ``amount`` das receitas de rendimento ativas do cofre (mais
        recentes primeiro), removendo (soft-delete) as que zerarem.

        Usado quando o rendimento deixa de estar no cofre — saque que consome
        ``accumulated_yield``, cofre esvaziado ou estorno de rendimentos — de
        modo que o rendimento nunca vaze para o saldo disponível da conta.
        """
        if amount <= 0:
            return

        from revenues.models import Revenue

        revenues = Revenue.objects.filter(
            related_vault=self,
            account=self.account,
            category="income",
            is_deleted=False,
        ).order_by("-date", "-created_at")

        remaining = amount
        for revenue in revenues:
            if remaining <= 0:
                break
            take = min(revenue.value, remaining)
            revenue.value -= take
            remaining -= take
            if revenue.value <= 0:
                revenue.is_deleted = True
                revenue.deleted_at = timezone.now()
                revenue.deleted_by = user or self.created_by
            else:
                revenue.net_amount = None
                revenue.updated_by = user or self.created_by
            revenue.save()

        if recalc:
            from accounts.services import recalculate_account_balance

            recalculate_account_balance(self.account_id)

    def _reconcile_yield_invariant(self, user=None):
        """
        Garante Σ(Revenue income ativas deste cofre) == accumulated_yield.

        Chamado ao final de toda operação que mexe em rendimento, como
        defesa em profundidade: corrige qualquer desvio entre os dois lados
        do ledger (receita a mais/a menos), independente da causa — falha
        parcial, recálculo de taxa, ajuste manual. Não recalcula o saldo da
        conta; quem chama decide se/quando fazer isso.
        """
        from django.db.models import Sum

        from revenues.models import Revenue

        total_income = Revenue.objects.filter(
            related_vault=self,
            account=self.account,
            category="income",
            is_deleted=False,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

        diff = self.accumulated_yield - total_income
        if diff > 0:
            self._materialize_yield_revenue(diff, timezone.now().date(), user)
        elif diff < 0:
            self._reduce_yield_revenues(-diff, user, recalc=False)

        return diff


class VaultTransaction(BaseModel):
    """
    Modelo para transações do cofre (depósitos, saques, rendimentos).
    """

    vault = models.ForeignKey(
        Vault,
        on_delete=models.PROTECT,
        verbose_name="Cofre",
        related_name="transactions",
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=VAULT_TRANSACTION_TYPES,
        verbose_name="Tipo de Transação",
    )
    amount = models.DecimalField(
        verbose_name="Valor", max_digits=15, decimal_places=2
    )
    balance_after = models.DecimalField(
        verbose_name="Saldo Após Transação", max_digits=15, decimal_places=2
    )
    description = models.CharField(
        max_length=200, verbose_name="Descrição", null=True, blank=True
    )
    transaction_date = models.DateField(
        verbose_name="Data da Transação", default=timezone.now
    )
    recurring_contribution = models.ForeignKey(
        "VaultRecurringContribution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_transactions",
        verbose_name="Contribuição Recorrente",
        help_text="Contribuição recorrente que gerou esta transação",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Transação do Cofre"
        verbose_name_plural = "Transações do Cofre"
        indexes = [
            models.Index(fields=["vault", "transaction_type"]),
            models.Index(fields=["transaction_date"]),
        ]

    def __str__(self):
        return (
            f"{self.get_transaction_type_display()}"
            f" - {self.amount} - {self.vault.description}"
        )


class VaultRecurringContribution(BaseModel):
    """
    Contribuição recorrente mensal a um cofre.

    Gera automaticamente uma FixedExpense na conta associada ao cofre
    e processa o depósito no mês programado via comando de gestão.
    """

    vault = models.ForeignKey(
        Vault,
        on_delete=models.CASCADE,
        verbose_name="Cofre",
        related_name="recurring_contributions",
    )
    amount = models.DecimalField(
        verbose_name="Valor",
        max_digits=15,
        decimal_places=2,
        help_text="Valor a ser depositado mensalmente",
    )
    day_of_month = models.PositiveIntegerField(
        verbose_name="Dia do Mês",
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Dia do mês em que o depósito será realizado (1-31)",
    )
    is_active = models.BooleanField(
        verbose_name="Ativa",
        default=True,
        help_text="Desmarque para suspender sem excluir",
    )
    start_date = models.DateField(
        verbose_name="Data de Início",
        help_text="Mês a partir do qual as contribuições serão geradas",
    )
    end_date = models.DateField(
        verbose_name="Data de Término",
        null=True,
        blank=True,
        help_text="Mês até o qual as contribuições serão geradas (opcional)",
    )
    description = models.CharField(
        max_length=200,
        verbose_name="Descrição",
        help_text="Descrição da contribuição (ex: Poupança mensal)",
    )
    fixed_expense = models.OneToOneField(
        "expenses.FixedExpense",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vault_contribution",
        verbose_name="Despesa Fixa Associada",
        help_text="Template de despesa fixa gerado automaticamente",
    )
    last_generated_month = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        verbose_name="Último Mês Gerado",
        help_text="Formato: YYYY-MM",
    )

    class Meta:
        ordering = ["day_of_month", "description"]
        verbose_name = "Contribuição Recorrente"
        verbose_name_plural = "Contribuições Recorrentes"
        indexes = [
            models.Index(fields=["vault", "is_active"]),
            models.Index(fields=["is_active", "is_deleted"]),
        ]

    def __str__(self):
        return (
            f"{self.description} - Dia {self.day_of_month}"
            f" - {self.vault.description}"
        )

    @property
    def next_contribution_date(self):
        """Retorna a data da próxima contribuição agendada."""
        today = timezone.now().date()
        year, month = today.year, today.month

        last_day = monthrange(year, month)[1]
        day = min(self.day_of_month, last_day)
        candidate = datetime.date(year, month, day)

        if candidate < today:
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1
            last_day = monthrange(year, month)[1]
            day = min(self.day_of_month, last_day)
            candidate = datetime.date(year, month, day)

        # Check if within active date range
        if self.end_date and candidate > self.end_date:
            return None
        return candidate

    def is_in_scope_for_month(self, year: int, month: int) -> bool:
        """Verifica se esta contribuição deve ser gerada para o mês dado."""
        if not self.is_active or self.is_deleted:
            return False
        month_str = f"{year:04d}-{month:02d}"
        start_month = self.start_date.strftime("%Y-%m")
        if month_str < start_month:
            return False
        if self.end_date:
            end_month = self.end_date.strftime("%Y-%m")
            if month_str > end_month:
                return False
        return True


GOAL_CATEGORIES = (
    ("savings", "Poupança"),
    ("investment", "Investimento"),
    ("emergency", "Reserva de Emergência"),
    ("travel", "Viagem"),
    ("education", "Educação"),
    ("property", "Imóvel"),
    ("vehicle", "Veículo"),
    ("retirement", "Aposentadoria"),
    ("health", "Saúde"),
    ("reduce_expenses", "Reduzir Despesas"),
    ("increase_revenue", "Aumentar Receitas"),
    ("other", "Outro"),
)


class FinancialGoal(BaseModel):
    """
    Modelo para metas financeiras.

    Uma meta financeira agrega um ou mais cofres e acompanha
    o progresso em direção a um valor alvo.
    """

    description = models.CharField(
        max_length=200,
        verbose_name="Descrição",
        help_text="Nome ou descrição da meta",
    )
    category = models.CharField(
        max_length=50,
        choices=GOAL_CATEGORIES,
        default="savings",
        verbose_name="Categoria",
    )
    target_value = models.DecimalField(
        verbose_name="Valor Alvo",
        max_digits=15,
        decimal_places=2,
        help_text="Valor que se deseja atingir",
    )
    vaults = models.ManyToManyField(
        Vault,
        verbose_name="Cofres Associados",
        related_name="goals",
        blank=True,
        help_text="Cofres que contribuem para esta meta",
    )
    target_date = models.DateField(
        verbose_name="Data Alvo",
        null=True,
        blank=True,
        help_text="Data prevista para atingir a meta",
    )
    is_active = models.BooleanField(verbose_name="Ativa", default=True)
    is_completed = models.BooleanField(verbose_name="Concluída", default=False)
    completed_at = models.DateTimeField(
        verbose_name="Concluída em", null=True, blank=True
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    linked_expense_category = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Categoria de Despesa Vinculada",
        help_text=(
            "Categoria de despesa usada para medir progresso"
            " (para metas de redução de despesas)"
        ),
    )
    linked_account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_goals",
        verbose_name="Conta Vinculada",
        help_text="Conta usada para filtrar transações ao calcular progresso",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Meta Financeira"
        verbose_name_plural = "Metas Financeiras"
        indexes = [
            models.Index(fields=["is_active", "is_completed"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return f"{self.description} - {self.target_value}"

    @property
    def current_value(self):
        """
        Retorna o valor atual da meta (soma dos saldos dos cofres associados).
        """
        total = self.vaults.filter(is_deleted=False, is_active=True).aggregate(
            total=models.Sum("current_balance")
        )["total"]
        return total or Decimal("0.00")

    @property
    def progress_percentage(self):
        """
        Retorna o percentual de progresso da meta.
        """
        if self.target_value <= 0:
            return Decimal("0.00")
        percentage = (self.current_value / self.target_value) * 100
        return min(percentage, Decimal("100.00")).quantize(Decimal("0.01"))

    @property
    def remaining_value(self):
        """
        Retorna o valor restante para atingir a meta.
        """
        remaining = self.target_value - self.current_value
        return max(remaining, Decimal("0.00"))

    @property
    def days_remaining(self):
        """
        Retorna o número de dias até a data alvo.
        """
        if not self.target_date:
            return None
        today = timezone.now().date()
        delta = self.target_date - today
        return delta.days

    @property
    def monthly_required(self):
        """
        Calcula o valor mensal necessário para atingir a meta no prazo.
        """
        if not self.target_date:
            return None
        days = self.days_remaining
        if days is None or days <= 0:
            return None
        months = days / 30
        if months <= 0:
            return None
        return (self.remaining_value / Decimal(str(months))).quantize(
            Decimal("0.01")
        )

    def check_completion(self):
        """
        Verifica se a meta foi atingida e atualiza o status.
        """
        if self.current_value >= self.target_value and not self.is_completed:
            self.is_completed = True
            self.completed_at = timezone.now()
            self.save()
            return True
        return False

    def get_vaults_summary(self):
        """
        Retorna um resumo dos cofres associados à meta.
        """
        vaults = self.vaults.filter(
            is_deleted=False, is_active=True
        ).select_related("account")

        return [
            {
                "id": vault.id,
                "uuid": str(vault.uuid),
                "description": vault.description,
                "current_balance": float(vault.current_balance),
                "accumulated_yield": float(vault.accumulated_yield),
                "account_name": vault.account.account_name,
                "contribution_percentage": float(
                    (vault.current_balance / self.current_value * 100)
                    if self.current_value > 0
                    else 0
                ),
            }
            for vault in vaults
        ]
