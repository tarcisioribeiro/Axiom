"""
Consulta índices de rendimento reais (CDI/SELIC) na API pública do Banco
Central (SGS), mesmo padrão de integração usado em
``exchange_rates/tasks.py`` para o PTAX.

Série SGS: https://api.bcb.gov.br/dados/serie/bcdata.sgs.<codigo>/dados
    12 = CDI (taxa diária, % a.d.)
    11 = SELIC (taxa diária, % a.d.)
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)

BCB_SGS_URL = (
    "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados/ultimos/{n}"
    "?formato=json"
)

INDEX_SERIES_CODES = {
    "cdi": 12,
    "selic": 11,
}

BUSINESS_DAYS_PER_YEAR = 252


def fetch_latest_daily_rate(
    index_type: str,
) -> tuple[Decimal | None, date | None]:
    """
    Busca a taxa diária mais recente (CDI ou SELIC) na API SGS do BCB.

    Retorna ``(taxa_diaria_decimal, data_referencia)`` ou ``(None, None)``
    se o índice for desconhecido ou a consulta falhar.
    """
    import requests

    code = INDEX_SERIES_CODES.get(index_type)
    if code is None:
        return None, None

    url = BCB_SGS_URL.format(code=code, n=5)
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None

        last = data[-1]
        daily_rate = Decimal(str(last["valor"])) / Decimal("100")
        day, month, year = (int(p) for p in last["data"].split("/"))
        ref_date = date(year, month, day)
        return daily_rate, ref_date
    except (
        requests.RequestException,
        KeyError,
        InvalidOperation,
        ValueError,
    ) as exc:
        logger.warning("Falha ao buscar índice %s: %s", index_type, exc)
        return None, None


def annualize_daily_rate(daily_rate: Decimal | None) -> Decimal:
    """Anualiza uma taxa diária pela convenção de 252 dias úteis."""
    if not daily_rate or daily_rate <= 0:
        return Decimal("0.0000")
    return ((1 + daily_rate) ** BUSINESS_DAYS_PER_YEAR - 1).quantize(
        Decimal("0.0001")
    )


def compute_index_annual_rate(
    index_type: str, percentage: Decimal
) -> tuple[Decimal | None, date | None]:
    """
    Retorna ``(taxa_anual, data_referencia)`` para ``index_type``
    (``cdi``/``selic``) aplicando ``percentage`` (ex.: ``120`` = 120% do
    índice) sobre a taxa DIÁRIA do índice, antes de anualizar — convenção de
    mercado para "X% do CDI" (escala o fator diário e compõe o ano a partir
    dele; escalar a taxa já anualizada no final produziria um resultado
    diferente por causa dos juros compostos). Retorna ``(None, None)`` se a
    API estiver indisponível.
    """
    daily_rate, ref_date = fetch_latest_daily_rate(index_type)
    if daily_rate is None:
        return None, None

    pct = (percentage if percentage is not None else Decimal("100")) / Decimal(
        "100"
    )
    annual_rate = annualize_daily_rate(daily_rate * pct)
    return annual_rate, ref_date
