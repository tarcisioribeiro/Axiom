import re
from datetime import date, timedelta


def parse_temporal_intent(query: str, now: date) -> tuple[date, date] | None:
    """
    Return (start, end) date range inferred from temporal phrases in the query.
    Returns None when no expression is found — callers fall back to their
    default.
    """
    q = query.lower()
    month_start = now.replace(day=1)

    if any(
        p in q
        for p in ["mês passado", "mes passado", "último mês", "ultimo mes"]
    ):
        last_month_end = month_start - timedelta(days=1)
        return last_month_end.replace(day=1), last_month_end

    if any(
        p in q for p in ["semana passada", "última semana", "ultima semana"]
    ):
        # Monday–Sunday of last week
        last_week_sun = now - timedelta(days=now.weekday() + 1)
        return last_week_sun - timedelta(days=6), last_week_sun

    if any(p in q for p in ["esta semana", "essa semana", "semana atual"]):
        return now - timedelta(days=now.weekday()), now

    if "ontem" in q:
        yesterday = now - timedelta(days=1)
        return yesterday, yesterday

    if "hoje" in q:
        return now, now

    m = re.search(r"últimos?\s+(\d+)\s+dias?", q)
    if m:
        days = int(m.group(1))
        return now - timedelta(days=days), now

    return None
