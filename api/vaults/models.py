import datetime
from decimal import Decimal

from django.db import models
from django.utils import timezone

from app.models import BaseModel


def count_business_days(start_date, end_date):
    """
    Conta dias úteis (seg-sex) entre start_date (exclusivo) e end_date (inclusivo).
    """
    if end_date <= start_date:
        return 0

    total_days = (end_date - start_date).days

    # Semanas completas e dias restantes
    full_weeks = total_days // 7
    remaining_days = total_days % 7

    # Cada semana completa tem 5 dias úteis
    business_days = full_weeks * 5

    # Contar dias úteis no período restante
    # Começar do dia seguinte a start_date
    current = start_date + datetime.timedelta(days=(full_weeks * 7) + 1)
    for _ in range(remaining_days):
        if current.weekday() < 5:  # 0=seg ... 4=sex
            business_days += 1
        current += datetime.timedelta(days=1)

    return business_days


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
        max_length=200, verbose_name="Descrição", help_text="Nome ou descrição do cofre"
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
        Se annual_yield_rate > 0, usa ela. Caso contrário, usa yield_rate (legado).
        """
        if self.annual_yield_rate > 0:
            return (self.annual_yield_rate / Decimal("252")).quantize(
                Decimal("0.000001")
            )
        return self.yield_rate

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

        # Rendimento composto diário
        # Fórmula: V = P * (1 + r)^n - P
        rate = Decimal(str(self.daily_yield_rate))
        principal = self.current_balance - self.accumulated_yield  # Apenas o principal
        if principal <= 0:
            principal = self.current_balance  # Se não há distinção, usa o saldo total

        total_value = principal * ((1 + rate) ** days)
        yield_value = total_value - principal

        return yield_value.quantize(Decimal("0.01"))

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
        if yield_value > 0:
            self.current_balance += yield_value
            self.accumulated_yield += yield_value
            self.last_yield_date = as_of_date

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

        return yield_value

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

        # Verificar saldo disponível na conta
        if self.account.current_balance < amount:
            raise ValueError(
                f"Saldo insuficiente na conta. "
                f"Disponível: {self.account.current_balance}, Solicitado: {amount}"
            )

        # Aplicar rendimentos pendentes antes do depósito
        self.apply_yield(user=user)

        # Atualizar saldos
        self.current_balance += amount
        self.account.current_balance -= amount

        # Se é o primeiro depósito, define a data do último rendimento
        if not self.last_yield_date:
            self.last_yield_date = timezone.now().date()

        self.save()
        self.account.save()

        # Registrar transação
        transaction = VaultTransaction.objects.create(
            vault=self,
            transaction_type="deposit",
            amount=amount,
            balance_after=self.current_balance,
            description=description or "Depósito",
            created_by=user,
        )

        return transaction

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

        # Aplicar rendimentos pendentes antes do saque
        self.apply_yield(user=user)

        if amount > self.current_balance:
            raise ValueError(
                f"Saldo insuficiente no cofre. "
                f"Disponível: {self.current_balance}, Solicitado: {amount}"
            )

        # Atualizar saldos
        self.current_balance -= amount
        self.account.current_balance += amount

        self.save()
        self.account.save()

        # Registrar transação
        transaction = VaultTransaction.objects.create(
            vault=self,
            transaction_type="withdrawal",
            amount=amount,
            balance_after=self.current_balance,
            description=description or "Saque",
            created_by=user,
        )

        return transaction

    def recalculate_yields(self, new_rate=None, from_date=None, user=None):
        """
        Recalcula os rendimentos com uma nova taxa a partir de uma data.

        Parameters
        ----------
        new_rate : Decimal, optional
            Nova taxa de rendimento. Se não fornecida, usa a taxa atual.
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
            self.yield_rate = new_rate

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
        for transaction in yield_transactions:
            total_reversed += transaction.amount
            transaction.is_deleted = True
            transaction.deleted_at = timezone.now()
            transaction.save()

        # Atualizar o saldo do cofre
        self.current_balance -= total_reversed
        self.accumulated_yield -= total_reversed

        # Recalcular a partir do primeiro depósito ou from_date
        first_deposit = (
            self.transactions.filter(transaction_type="deposit", is_deleted=False)
            .order_by("created_at")
            .first()
        )

        if first_deposit:
            start_date = from_date or first_deposit.created_at.date()
            self.last_yield_date = start_date

        self.save()

        # Aplicar novo rendimento
        new_yield = self.apply_yield(user=user)

        return {
            "reversed_amount": total_reversed,
            "new_yield_amount": new_yield,
            "difference": new_yield - total_reversed,
        }


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
        max_length=20, choices=VAULT_TRANSACTION_TYPES, verbose_name="Tipo de Transação"
    )
    amount = models.DecimalField(verbose_name="Valor", max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(
        verbose_name="Saldo Após Transação", max_digits=15, decimal_places=2
    )
    description = models.CharField(
        max_length=200, verbose_name="Descrição", null=True, blank=True
    )
    transaction_date = models.DateField(
        verbose_name="Data da Transação", default=timezone.now
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
    ("other", "Outro"),
)


class FinancialGoal(BaseModel):
    """
    Modelo para metas financeiras.

    Uma meta financeira agrega um ou mais cofres e acompanha
    o progresso em direção a um valor alvo.
    """

    description = models.CharField(
        max_length=200, verbose_name="Descrição", help_text="Nome ou descrição da meta"
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
        return (self.remaining_value / Decimal(str(months))).quantize(Decimal("0.01"))

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
        vaults = self.vaults.filter(is_deleted=False, is_active=True).select_related(
            "account"
        )

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
