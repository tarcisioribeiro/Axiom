from datetime import timedelta
from typing import Union, cast

from expenses.models import Expense
from revenues.models import Revenue

from .models import BankStatementEntry, BankStatementImport


def run_matching(statement_import: BankStatementImport) -> int:
    """
    For each pending entry in the import, attempt to find a matching
    Expense (debit) or Revenue (credit) within a ±2 day window.

    Confidence levels:
    - high: exact date match
    - medium: ±1 day
    - low: ±2 days

    Returns the count of entries that received a match suggestion.
    """
    entries = list(
        BankStatementEntry.objects.filter(
            statement_import=statement_import,
            status="pending",
            is_deleted=False,
        )
    )
    matched = 0

    for entry in entries:
        abs_amount = abs(entry.amount)
        best_match = None
        best_confidence = None

        candidates: list[Union[Expense, Revenue]] = []
        for day_delta in range(3):  # 0, 1, 2
            window_start = entry.date - timedelta(days=day_delta)
            window_end = entry.date + timedelta(days=day_delta)

            if entry.transaction_type == "debit":
                candidates = list(
                    Expense.objects.filter(
                        is_deleted=False,
                        account=statement_import.account,
                        date__range=(window_start, window_end),
                        value=abs_amount,
                    ).order_by("date", "id")[:1]
                )
            else:
                candidates = list(
                    Revenue.objects.filter(
                        is_deleted=False,
                        account=statement_import.account,
                        date__range=(window_start, window_end),
                        value=abs_amount,
                    ).order_by("date", "id")[:1]
                )

            if candidates:
                if day_delta == 0:
                    confidence = "high"
                elif day_delta == 1:
                    confidence = "medium"
                else:
                    confidence = "low"
                best_match = candidates[0]
                best_confidence = confidence
                break

        if best_match is not None:
            if entry.transaction_type == "debit":
                entry.matched_expense = cast(Expense, best_match)
                entry.matched_revenue = None
            else:
                entry.matched_revenue = cast(Revenue, best_match)
                entry.matched_expense = None
            entry.match_confidence = best_confidence
            entry.save(
                update_fields=[
                    "matched_expense",
                    "matched_revenue",
                    "match_confidence",
                ]
            )
            matched += 1

    return matched


def recount_import_stats(statement_import: BankStatementImport) -> None:
    """
    Recalculate and persist entry counts for the given import.
    """
    from django.db.models import Count, Q

    qs = BankStatementEntry.objects.filter(
        statement_import=statement_import,
        is_deleted=False,
    )
    agg = qs.aggregate(
        total=Count("id"),
        matched=Count("id", filter=Q(status="matched")),
        unmatched=Count("id", filter=Q(status="unmatched")),
        ignored=Count("id", filter=Q(status="ignored")),
    )
    statement_import.total_entries = agg["total"] or 0
    statement_import.matched_count = agg["matched"] or 0
    statement_import.unmatched_count = agg["unmatched"] or 0
    statement_import.ignored_count = agg["ignored"] or 0
    statement_import.save(
        update_fields=[
            "total_entries",
            "matched_count",
            "unmatched_count",
            "ignored_count",
        ]
    )
