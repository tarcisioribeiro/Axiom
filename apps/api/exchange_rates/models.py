from decimal import Decimal

from django.db import models

from app.models import BaseModel

CURRENCY_CHOICES = (
    ("USD", "Dólar americano"),
    ("EUR", "Euro"),
    ("GBP", "Libra esterlina"),
    ("ARS", "Peso argentino"),
    ("CLP", "Peso chileno"),
    ("UYU", "Peso uruguaio"),
    ("JPY", "Iene japonês"),
    ("CHF", "Franco suíço"),
    ("CAD", "Dólar canadense"),
    ("AUD", "Dólar australiano"),
    ("MXN", "Peso mexicano"),
    ("CNY", "Yuan chinês"),
    ("BTC", "Bitcoin"),
    ("ETH", "Ethereum"),
)


class ExchangeRate(BaseModel):
    """
    Taxa de câmbio diária entre uma moeda estrangeira e BRL (Real brasileiro).

    Fonte: API PTAX do Banco Central do Brasil (dados oficiais).
    Parity: 1 unidade da moeda_from = rate BRL.
    """

    currency_from = models.CharField(
        max_length=3,
        verbose_name="Moeda de origem",
        help_text="Código ISO 4217 (ex: USD, EUR)",
    )
    rate_buy = models.DecimalField(
        max_digits=20,
        decimal_places=8,
        verbose_name="Taxa de compra (BRL)",
        help_text=(
            "Quanto 1 unidade da moeda custa em BRL (taxa de compra PTAX)"
        ),
    )
    rate_sell = models.DecimalField(
        max_digits=20,
        decimal_places=8,
        verbose_name="Taxa de venda (BRL)",
        help_text=(
            "Quanto 1 unidade da moeda custa em BRL (taxa de venda PTAX)"
        ),
    )
    reference_date = models.DateField(
        verbose_name="Data de referência",
        help_text="Data para a qual esta taxa é válida",
        db_index=True,
    )
    source = models.CharField(
        max_length=50,
        default="BCB_PTAX",
        verbose_name="Fonte",
        help_text="Fonte da cotação (BCB_PTAX, awesomeapi, manual)",
    )

    class Meta:
        verbose_name = "Taxa de Câmbio"
        verbose_name_plural = "Taxas de Câmbio"
        ordering = ["-reference_date", "currency_from"]
        unique_together = [["currency_from", "reference_date"]]
        indexes = [
            models.Index(fields=["currency_from", "-reference_date"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.currency_from}/BRL {self.rate_sell}"
            f" ({self.reference_date})"
        )

    @property
    def mid_rate(self) -> Decimal:
        """Taxa média entre compra e venda."""
        return ((self.rate_buy + self.rate_sell) / 2).quantize(
            Decimal("0.00000001")
        )

    @classmethod
    def latest_rate(cls, currency_from: str) -> "ExchangeRate | None":
        """Retorna a taxa mais recente disponível para a moeda."""
        return (
            cls.objects.filter(
                currency_from=currency_from.upper(), is_deleted=False
            )
            .order_by("-reference_date")
            .first()
        )

    @classmethod
    def convert(
        cls, amount: Decimal, from_currency: str, to_currency: str = "BRL"
    ) -> Decimal | None:
        """
        Converte amount de from_currency para to_currency.
        Atualmente suporta apenas conversões envolvendo BRL.
        Retorna None se a taxa não estiver disponível.
        """
        if from_currency == to_currency:
            return amount

        if to_currency == "BRL":
            rate = cls.latest_rate(from_currency)
            if rate is None:
                return None
            return (amount * rate.mid_rate).quantize(Decimal("0.01"))

        if from_currency == "BRL":
            rate = cls.latest_rate(to_currency)
            if rate is None:
                return None
            return (amount / rate.mid_rate).quantize(Decimal("0.00000001"))

        # Cross-rate via BRL
        rate_from = cls.latest_rate(from_currency)
        rate_to = cls.latest_rate(to_currency)
        if rate_from is None or rate_to is None:
            return None
        brl_amount = amount * rate_from.mid_rate
        return (brl_amount / rate_to.mid_rate).quantize(Decimal("0.00000001"))
