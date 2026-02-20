from django.db import models
from django.core.exceptions import ValidationError
from accounts.models import Account
from expenses.models import EXPENSES_CATEGORIES
from app.encryption import EncryptedField, MaskedEncryptedField
from app.models import BaseModel, BILL_STATUS_CHOICES


FLAGS = (
    ('MSC', 'Master Card'),
    ('VSA', 'Visa'),
    ('ELO', 'Elo'),
    ('EXP', 'American Express'),
    ('HCD', 'Hipercard'),
)

YEARS = (
    ('2025', '2025'),
    ('2026', '2026'),
    ('2027', '2027'),
    ('2028', '2028'),
    ('2029', '2029'),
    ('2030', '2030')
)

MONTHS = (
    ('Jan', 'Janeiro'),
    ('Feb', 'Fevereiro'),
    ('Mar', 'Março'),
    ('Apr', 'Abril'),
    ('May', 'Maio'),
    ('Jun', 'Junho'),
    ('Jul', 'Julho'),
    ('Aug', 'Agosto'),
    ('Sep', 'Setembro'),
    ('Oct', 'Outubro'),
    ('Nov', 'Novembro'),
    ('Dec', 'Dezembro')
)


def _validate_cvv(value: str) -> None:
    if not value.isdigit() or len(value) not in [3, 4]:
        raise ValidationError("CVV deve conter 3 ou 4 dígitos numéricos")


class CreditCard(BaseModel):
    name = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        verbose_name="Nome"
    )
    on_card_name = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        verbose_name="Nome no cartão"
    )
    flag = models.CharField(
        max_length=200,
        choices=FLAGS,
        null=False,
        blank=False,
        verbose_name="Bandeira",
    )
    validation_date = models.DateField(
        verbose_name="Data de Validade",
        null=False,
        blank=False
    )
    _security_code = models.TextField(
        verbose_name="Código de Segurança (Criptografado)",
        blank=False,
        null=False,
        help_text="Campo criptografado para armazenar o CVV"
    )
    credit_limit = models.DecimalField(
        verbose_name="Limite de crédito",
        null=False,
        blank=False,
        decimal_places=2,
        max_digits=10
    )
    max_limit = models.DecimalField(
        verbose_name="Limite Máximo",
        null=False,
        blank=False,
        decimal_places=2,
        max_digits=10
    )
    associated_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta associada"
    )
    _card_number = models.TextField(
        verbose_name="Número do Cartão (Criptografado)",
        null=True,
        blank=True,
        help_text="Campo criptografado"
    )
    is_active = models.BooleanField(
        verbose_name="Ativo",
        default=True
    )
    closing_day = models.IntegerField(
        verbose_name="Dia de Fechamento",
        null=True,
        blank=True,
        help_text="Dia do mês em que a fatura fecha"
    )
    due_day = models.IntegerField(
        verbose_name="Dia de Vencimento",
        null=True,
        blank=True,
        help_text="Dia do mês em que a fatura vence"
    )
    interest_rate = models.DecimalField(
        verbose_name="Taxa de Juros (%)",
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    annual_fee = models.DecimalField(
        verbose_name="Anuidade",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    owner = models.ForeignKey(
        'members.Member',
        on_delete=models.PROTECT,
        verbose_name="Proprietário",
        null=True,
        blank=True
    )
    notes = models.TextField(
        verbose_name="Observações",
        null=True,
        blank=True
    )

    security_code = EncryptedField('_security_code', validator=_validate_cvv)
    card_number = EncryptedField('_card_number')
    card_number_masked = MaskedEncryptedField('_card_number', fallback='****')

    class Meta:
        verbose_name = "Cartão de Crédito"
        verbose_name_plural = "Cartões de Crédito"

    def __str__(self):
        return self.name

    def clean(self):
        """
        Validação customizada do modelo.

        Raises
        ------
        ValidationError
            Se a data de validade for anterior ou igual à data atual.
        """
        super().clean()

        # Validação da data de validade
        from datetime import date
        if self.validation_date and self.validation_date <= date.today():
            raise ValidationError(
                "Data de validade não pode ser anterior ou igual à data atual"
            )

    def save(self, *args, **kwargs):
        """
        Override do save para executar validações.

        Parameters
        ----------
        *args
            Argumentos posicionais do método save.
        **kwargs
            Argumentos nomeados do método save.
        """
        self.full_clean()
        super().save(*args, **kwargs)


class CreditCardBill(BaseModel):
    credit_card = models.ForeignKey(
        CreditCard,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Cartão"
    )
    year = models.CharField(
        verbose_name="Ano",
        blank=False,
        null=False,
        choices=YEARS
    )
    month = models.CharField(
        verbose_name="Mês",
        blank=False,
        null=False,
        choices=MONTHS
    )
    invoice_beginning_date = models.DateField(
        verbose_name="Data de começo da fatura",
        null=False,
        blank=False
    )
    invoice_ending_date = models.DateField(
        verbose_name="Data de fim da fatura",
        null=False,
        blank=False
    )
    closed = models.BooleanField(
        verbose_name="Fechada"
    )
    total_amount = models.DecimalField(
        verbose_name="Valor Total",
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    minimum_payment = models.DecimalField(
        verbose_name="Pagamento Mínimo",
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    due_date = models.DateField(
        verbose_name="Data de Vencimento",
        null=True,
        blank=True
    )
    paid_amount = models.DecimalField(
        verbose_name="Valor Pago",
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    payment_date = models.DateField(
        verbose_name="Data do Pagamento",
        null=True,
        blank=True
    )
    interest_charged = models.DecimalField(
        verbose_name="Juros Cobrados",
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    late_fee = models.DecimalField(
        verbose_name="Multa por Atraso",
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    status = models.CharField(
        max_length=20,
        choices=BILL_STATUS_CHOICES,
        verbose_name="Status",
        default='open'
    )

    class Meta:
        verbose_name = "Fatura"
        verbose_name_plural = "Faturas"

    def __str__(self):
        return f"{self.credit_card} - {self.year}/{self.month}"


class CreditCardPurchase(BaseModel):
    """
    Representa uma compra no cartão de crédito.
    Cada compra pode ter múltiplas parcelas (CreditCardInstallment).
    """
    description = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        verbose_name="Descrição"
    )
    total_value = models.DecimalField(
        verbose_name="Valor Total",
        blank=False,
        null=False,
        decimal_places=2,
        max_digits=12,
        help_text="Valor total da compra"
    )
    purchase_date = models.DateField(
        null=False,
        blank=False,
        verbose_name="Data da Compra"
    )
    purchase_time = models.TimeField(
        null=False,
        blank=False,
        verbose_name="Horário da Compra"
    )
    category = models.CharField(
        max_length=200,
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria"
    )
    card = models.ForeignKey(
        CreditCard,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Cartão",
        related_name='purchases'
    )
    total_installments = models.PositiveIntegerField(
        verbose_name="Quantidade de Parcelas",
        default=1
    )
    merchant = models.CharField(
        max_length=200,
        verbose_name="Estabelecimento",
        null=True,
        blank=True
    )
    member = models.ForeignKey(
        'members.Member',
        on_delete=models.PROTECT,
        verbose_name="Membro Responsável",
        null=True,
        blank=True
    )
    notes = models.TextField(
        verbose_name="Observações",
        null=True,
        blank=True
    )
    receipt = models.FileField(
        upload_to='credit_cards/receipts/',
        verbose_name="Comprovante",
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['-purchase_date', '-id']
        verbose_name = "Compra de Cartão"
        verbose_name_plural = "Compras de Cartão"
        indexes = [
            models.Index(fields=['-purchase_date']),
            models.Index(fields=['card', '-purchase_date']),
            models.Index(fields=['category', '-purchase_date']),
        ]

    def __str__(self):
        return f"{self.description} - {self.card} ({self.purchase_date})"

    @property
    def installment_value(self):
        """Valor de cada parcela"""
        if self.total_installments > 0:
            return self.total_value / self.total_installments
        return self.total_value


class CreditCardInstallment(BaseModel):
    """
    Representa uma parcela de uma compra no cartão de crédito.
    """
    purchase = models.ForeignKey(
        CreditCardPurchase,
        on_delete=models.CASCADE,
        null=False,
        blank=False,
        verbose_name="Compra",
        related_name='installments'
    )
    installment_number = models.PositiveIntegerField(
        verbose_name="Número da Parcela",
        null=False,
        blank=False
    )
    value = models.DecimalField(
        verbose_name="Valor da Parcela",
        blank=False,
        null=False,
        decimal_places=2,
        max_digits=12
    )
    due_date = models.DateField(
        null=False,
        blank=False,
        verbose_name="Data de Vencimento"
    )
    bill = models.ForeignKey(
        CreditCardBill,
        on_delete=models.SET_NULL,
        verbose_name="Fatura",
        null=True,
        blank=True,
        related_name='installments'
    )
    payed = models.BooleanField(
        verbose_name="Paga",
        default=False
    )

    class Meta:
        ordering = ['purchase', 'installment_number']
        verbose_name = "Parcela de Cartão"
        verbose_name_plural = "Parcelas de Cartão"
        indexes = [
            models.Index(fields=['bill', 'payed']),
            models.Index(fields=['due_date']),
            models.Index(fields=['purchase', 'installment_number']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['purchase', 'installment_number'],
                name='unique_purchase_installment'
            )
        ]

    def __str__(self):
        return f"{self.purchase.description} - Parcela {self.installment_number}/{self.purchase.total_installments}"

    @property
    def description(self):
        """Descrição da compra para facilitar visualização"""
        return self.purchase.description

    @property
    def category(self):
        """Categoria da compra para facilitar visualização"""
        return self.purchase.category

    @property
    def card(self):
        """Cartão da compra para facilitar visualização"""
        return self.purchase.card

    @property
    def total_installments(self):
        """Total de parcelas da compra"""
        return self.purchase.total_installments
