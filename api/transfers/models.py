from django.db import models

from accounts.models import Account
from app.models import BaseModel

TRANSFER_CATEGORIES = (
    ("doc", "DOC"),
    ("ted", "TED"),
    ("pix", "PIX"),
)


class Transfer(BaseModel):
    description = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Descrição"
    )
    value = models.DecimalField(
        verbose_name="Valor", null=False, blank=False, decimal_places=2, max_digits=10
    )
    date = models.DateField(verbose_name="Data", null=False, blank=False)
    horary = models.TimeField(verbose_name="Horário", null=False, blank=False)
    category = models.CharField(
        max_length=200,
        choices=TRANSFER_CATEGORIES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    origin_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta de Origem",
        related_name="Credora",
    )
    destiny_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Conta de Destino",
        related_name="Beneficiada",
    )
    transfered = models.BooleanField(verbose_name="Transferido", default=False)
    transaction_id = models.CharField(
        max_length=100,
        verbose_name="ID da Transação",
        null=True,
        blank=True,
        unique=True,
    )
    fee = models.DecimalField(
        verbose_name="Taxa", max_digits=10, decimal_places=2, default=0.00
    )
    exchange_rate = models.DecimalField(
        verbose_name="Taxa de Câmbio",
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
    )
    processed_at = models.DateTimeField(
        verbose_name="Processado em", null=True, blank=True
    )
    confirmation_code = models.CharField(
        max_length=50, verbose_name="Código de Confirmação", null=True, blank=True
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)
    receipt = models.FileField(
        upload_to="transfers/receipts/",
        verbose_name="Comprovante",
        null=True,
        blank=True,
    )
    member = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        verbose_name="Membro Responsável",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "Transferência"
        verbose_name_plural = "Transferências"

    def clean(self):
        """
        Valida os dados da transferência antes de salvar.

        Raises
        ------
        ValidationError
            Se origin_account for igual a destiny_account
        """
        from django.core.exceptions import ValidationError

        # Validar que conta de origem é diferente da conta de destino
        if self.origin_account and self.destiny_account:
            if self.origin_account == self.destiny_account:
                raise ValidationError(
                    {
                        "destiny_account": (
                            "A conta de destino deve ser diferente"
                            " da conta de origem."
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
            },{
                self.category
            } - {
                self.date
            },{
                self.horary
            }: [{
                self.origin_account
            } -> {
                self.destiny_account
            }]
        """
