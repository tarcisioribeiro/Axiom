from django.db import models

from accounts.models import Account
from app.models import LOAN_STATUS_CHOICES, PAYMENT_FREQUENCY_CHOICES, BaseModel
from expenses.models import EXPENSES_CATEGORIES
from members.models import Member


class Loan(BaseModel):
    description = models.CharField(
        max_length=200, verbose_name="Descrição", null=False, blank=False
    )
    value = models.DecimalField(
        verbose_name="Valor", null=False, blank=False, max_digits=10, decimal_places=2
    )
    payed_value = models.DecimalField(
        verbose_name="Valor Pago",
        null=False,
        blank=False,
        max_digits=10,
        decimal_places=2,
    )
    date = models.DateField(verbose_name="Data", null=False, blank=False)
    horary = models.TimeField(verbose_name="Horário", null=False, blank=False)
    category = models.CharField(
        max_length=200,
        choices=EXPENSES_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=False, blank=False, verbose_name="Conta"
    )
    benefited = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Beneficiado",
        related_name="Benefited",
    )
    creditor = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Credor",
        related_name="Creditor",
    )
    payed = models.BooleanField(verbose_name="Pago")
    interest_rate = models.DecimalField(
        verbose_name="Taxa de Juros (%)",
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    installments = models.IntegerField(verbose_name="Número de Parcelas", default=1)
    due_date = models.DateField(
        verbose_name="Data de Vencimento", null=True, blank=True
    )
    contract_document = models.FileField(
        upload_to="loans/contracts/",
        verbose_name="Documento do Contrato",
        null=True,
        blank=True,
    )
    payment_frequency = models.CharField(
        max_length=20,
        choices=PAYMENT_FREQUENCY_CHOICES,
        verbose_name="Frequência de Pagamento",
        default="monthly",
    )
    late_fee = models.DecimalField(
        verbose_name="Multa por Atraso", max_digits=10, decimal_places=2, default=0.00
    )
    guarantor = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        verbose_name="Avalista",
        related_name="Guarantor",
        null=True,
        blank=True,
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=LOAN_STATUS_CHOICES,
        verbose_name="Status",
        default="active",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name = "Empréstimo"
        verbose_name_plural = "Empréstimos"

    def clean(self):
        """
        Valida os dados do empréstimo antes de salvar.

        Raises
        ------
        ValidationError
            Se payed_value for maior que value
        """
        from django.core.exceptions import ValidationError

        # Validar que valor pago não excede valor total
        if self.payed_value and self.value:
            if self.payed_value > self.value:
                raise ValidationError(
                    {
                        "payed_value": (
                            "O valor pago não pode ser maior que"
                            " o valor total do empréstimo."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        """
        Sobrescreve save para chamar full_clean antes de salvar.
        """
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"""{
            self.description
        },{self.category} - {self.date},{self.horary}"""
