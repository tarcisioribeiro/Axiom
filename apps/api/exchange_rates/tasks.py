"""
Task Celery para buscar cotações PTAX do Banco Central do Brasil.

API BCB PTAX: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/
CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='USD'&@dataCotacao='MM-DD-YYYY'
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal

from celery import shared_task

logger = logging.getLogger(__name__)

SUPPORTED_CURRENCIES = [
    "USD",
    "EUR",
    "GBP",
    "ARS",
    "JPY",
    "CAD",
    "AUD",
    "MXN",
    "CHF",
]

BCB_BASE = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata"


def _fetch_ptax_for_currency(currency: str, ref_date: date) -> dict | None:
    """Busca cotação PTAX de uma moeda para uma data específica."""
    import requests

    date_str = ref_date.strftime("%m-%d-%Y")
    url = (
        f"{BCB_BASE}/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)"
        f"?@moeda='{currency}'&@dataCotacao='{date_str}'"
        f"&$top=1&$orderby=dataHoraCotacao desc"
        f"&$format=json&$select=cotacaoCompra,cotacaoVenda"
    )

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json().get("value", [])
        if not data:
            return None
        row = data[0]
        return {
            "rate_buy": Decimal(str(row["cotacaoCompra"])),
            "rate_sell": Decimal(str(row["cotacaoVenda"])),
        }
    except Exception as exc:
        logger.warning(
            "PTAX fetch failed for %s on %s: %s", currency, ref_date, exc
        )
        return None


@shared_task(name="exchange_rates.fetch_ptax_rates")
def fetch_ptax_rates(target_date: str | None = None) -> dict:
    """
    Busca cotações PTAX do BCB para todas as moedas suportadas.
    target_date: 'YYYY-MM-DD' (default: ontem, pois PTAX fecha às 13h).
    """
    from django.utils import timezone

    from exchange_rates.models import ExchangeRate

    if target_date:
        ref_date = date.fromisoformat(target_date)
    else:
        ref_date = timezone.now().date() - timedelta(days=1)

    # Fim de semana não tem PTAX — usa sexta-feira
    while ref_date.weekday() >= 5:
        ref_date -= timedelta(days=1)

    saved = 0
    skipped = 0
    failed = 0

    for currency in SUPPORTED_CURRENCIES:
        existing = ExchangeRate.objects.filter(
            currency_from=currency, reference_date=ref_date
        ).exists()
        if existing:
            skipped += 1
            continue

        rates = _fetch_ptax_for_currency(currency, ref_date)
        if rates is None:
            failed += 1
            continue

        ExchangeRate.objects.update_or_create(
            currency_from=currency,
            reference_date=ref_date,
            defaults={
                "rate_buy": rates["rate_buy"],
                "rate_sell": rates["rate_sell"],
                "source": "BCB_PTAX",
            },
        )
        saved += 1

    results: dict[str, str | int] = {
        "date": str(ref_date),
        "saved": saved,
        "skipped": skipped,
        "failed": failed,
    }
    logger.info("PTAX fetch result: %s", results)
    return results
