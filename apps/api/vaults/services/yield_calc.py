"""
Funções puras para cálculo de rendimento de cofres.

Isoladas de ``vaults.models`` para poderem ser reutilizadas por migrações de
dados sem depender de métodos de modelo (que operam sobre modelos "congelados"
durante a migração).
"""

import datetime
from decimal import Decimal


def count_business_days(
    start_date: datetime.date, end_date: datetime.date
) -> int:
    """
    Conta dias úteis (seg-sex) entre start_date (exclusivo)
    e end_date (inclusivo).
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


def daily_rate_from(
    annual_yield_rate: Decimal, legacy_yield_rate: Decimal
) -> Decimal:
    """
    Calcula a taxa diária a partir da taxa anual (base 252 dias úteis).

    Se ``annual_yield_rate`` > 0, usa ela; caso contrário usa a taxa diária
    legada ``legacy_yield_rate``.
    """
    if annual_yield_rate and annual_yield_rate > 0:
        return (annual_yield_rate / Decimal("252")).quantize(
            Decimal("0.000001")
        )
    return legacy_yield_rate or Decimal("0.000000")


def compound_yield(
    principal: Decimal, daily_rate: Decimal, business_days: int
) -> Decimal:
    """
    Rendimento composto: ``P * (1 + r)^n - P``, arredondado a 2 casas.

    Retorna ``0.00`` se não houver principal, taxa ou dias positivos.
    """
    if principal <= 0 or daily_rate <= 0 or business_days <= 0:
        return Decimal("0.00")

    rate = Decimal(str(daily_rate))
    total_value = principal * ((1 + rate) ** business_days)
    return (total_value - principal).quantize(Decimal("0.01"))
