from decimal import Decimal, InvalidOperation

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from exchange_rates.models import CURRENCY_CHOICES, ExchangeRate


class LatestRatesView(APIView):
    """GET /api/v1/exchange-rates/ — cotações mais recentes de todas as
    moedas."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        currencies = [c[0] for c in CURRENCY_CHOICES]
        rates = {}
        for currency in currencies:
            rate = ExchangeRate.latest_rate(currency)
            if rate:
                rates[currency] = {
                    "rate_buy": str(rate.rate_buy),
                    "rate_sell": str(rate.rate_sell),
                    "mid_rate": str(rate.mid_rate),
                    "reference_date": str(rate.reference_date),
                    "source": rate.source,
                }
        return Response(rates)


class ConvertCurrencyView(APIView):
    """
    POST /api/v1/exchange-rates/convert/
    Body: {"amount": 100.00, "from": "USD", "to": "BRL"}
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        amount_raw = request.data.get("amount")
        from_currency = (request.data.get("from") or "").upper()
        to_currency = (request.data.get("to") or "BRL").upper()

        if not amount_raw or not from_currency:
            return Response(
                {"detail": "Campos obrigatórios: amount, from"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = Decimal(str(amount_raw))
        except InvalidOperation:
            return Response(
                {"detail": "amount inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        converted = ExchangeRate.convert(amount, from_currency, to_currency)
        if converted is None:
            return Response(
                {
                    "detail": (
                        f"Taxa de câmbio não disponível para "
                        f"{from_currency}/{to_currency}."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        rate = ExchangeRate.latest_rate(
            from_currency if to_currency == "BRL" else to_currency
        )
        return Response(
            {
                "amount": str(amount),
                "from": from_currency,
                "to": to_currency,
                "converted": str(converted),
                "mid_rate": str(rate.mid_rate) if rate else None,
                "reference_date": str(rate.reference_date) if rate else None,
            }
        )
