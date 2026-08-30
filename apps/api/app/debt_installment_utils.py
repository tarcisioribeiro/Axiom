"""
Helper puro para gerar cronogramas de parcelas de dívida (Loan/Payable).

Usado pelo fluxo de plano de pagamento (parcelamento explícito, opcional,
diferente do parcelamento automático de Loan feito em loans/signals.py) e
pelo serviço de recálculo de parcelas em payables/services.py.
"""

from calendar import monthrange
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

FREQUENCY_DAYS = {
    "daily": 1,
    "weekly": 7,
}

FREQUENCY_MONTHS = {
    "monthly": 1,
    "quarterly": 3,
    "semiannual": 6,
    "annual": 12,
}


def _add_months(start: date, months: int) -> date:
    """Soma `months` meses a `start`, ajustando o dia para o fim do mês
    quando necessário (ex: 31/01 + 1 mês = 28/02 ou 29/02)."""
    m = start.month - 1 + months
    y = start.year + m // 12
    m = m % 12 + 1
    d = min(start.day, monthrange(y, m)[1])
    return date(y, m, d)


def _due_date_for(start: date, index: int, frequency: str) -> date:
    """Data de vencimento da parcela `index` (1-based) a partir de `start`,
    na cadência `frequency`."""
    if frequency in FREQUENCY_DAYS:
        return start + timedelta(days=FREQUENCY_DAYS[frequency] * index)
    step = FREQUENCY_MONTHS.get(frequency, 1)
    return _add_months(start, step * index)


def default_first_due_date(
    reference_day: int,
    frequency: str = "monthly",
    today: date | None = None,
) -> date:
    """Primeira data de vencimento "no futuro" para um plano de pagamento
    novo: a próxima ocorrência do dia `reference_day` em/depois de `today`.

    Evita que planos de pagamento criados hoje gerem parcelas em meses
    passados (bug quando o cronograma começava na data de registro da
    dívida).
    """
    today = today or date.today()

    if frequency in FREQUENCY_DAYS:
        return today + timedelta(days=FREQUENCY_DAYS[frequency])

    day = min(max(reference_day, 1), monthrange(today.year, today.month)[1])
    candidate = date(today.year, today.month, day)
    if candidate >= today:
        return candidate
    step = FREQUENCY_MONTHS.get(frequency, 1)
    return _add_months(candidate, step)


def split_equal_values(remaining_value: Decimal, count: int) -> list[Decimal]:
    """
    Divide `remaining_value` em `count` valores iguais (centavos), com o
    resto do arredondamento reconciliado inteiramente no ÚLTIMO valor, para
    que a soma seja sempre exatamente igual a `remaining_value`.
    """
    if count <= 0:
        return []

    value_per = (remaining_value / Decimal(count)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    values = []
    running_total = Decimal("0.00")
    for i in range(1, count + 1):
        if i < count:
            value = value_per
        else:
            value = remaining_value - running_total
        running_total += value
        values.append(value)
    return values


def build_equal_installment_schedule(
    remaining_value: Decimal,
    count: int,
    start_date: date,
    frequency: str = "monthly",
    first_due_date: date | None = None,
) -> list[dict]:
    """
    Divide `remaining_value` em `count` parcelas iguais, com vencimentos a
    partir de `start_date` na cadência `frequency`.

    O resto de centavos da divisão é reconciliado inteiramente na ÚLTIMA
    parcela, garantindo que a soma das parcelas seja sempre exatamente
    igual a `remaining_value` (loans/signals.py:36 não faz essa
    reconciliação hoje — este helper corrige isso sem alterar o
    comportamento de criação já existente do Loan).

    Se `first_due_date` for informado, a parcela 1 vence exatamente nessa
    data e as seguintes são escalonadas a partir dela na cadência
    `frequency`. Caso contrário, mantém o comportamento antigo (parcela 1
    vence uma cadência depois de `start_date`).

    Returns
    -------
    list[dict]
        Uma lista de {"number": int, "value": Decimal, "due_date": date},
        1-indexed.
    """
    values = split_equal_values(remaining_value, count)
    if first_due_date is not None:
        due_dates = [
            _due_date_for(first_due_date, i - 1, frequency)
            for i in range(1, len(values) + 1)
        ]
    else:
        due_dates = [
            _due_date_for(start_date, i, frequency)
            for i in range(1, len(values) + 1)
        ]
    return [
        {"number": i, "value": value, "due_date": due_date}
        for i, (value, due_date) in enumerate(zip(values, due_dates), start=1)
    ]
