from calendar import monthrange
from datetime import datetime

from django.utils import timezone

from transfers.models import (
    FixedTransfer,
    FixedTransferGenerationLog,
    Transfer,
)


def bulk_generate_fixed_transfers(month, user):
    """Generate fixed transfers for a given month.

    Returns a dict with keys: success, created_count, month, transfers.
    """
    year, month_num = month.split("-")
    year_int, month_int = int(year), int(month_num)
    created_transfers = []
    fixed_transfer_ids = []

    last_day = monthrange(year_int, month_int)[1]
    month_start = datetime(year_int, month_int, 1).date()
    month_end = datetime(year_int, month_int, last_day).date()

    fixed_transfers = FixedTransfer.objects.filter(
        is_active=True, is_deleted=False
    ).select_related("origin_account", "destiny_account")

    for ft in fixed_transfers:
        fixed_transfer_ids.append(ft.id)

        try:
            transfer_date = datetime(year_int, month_int, ft.due_day).date()
        except ValueError:
            transfer_date = datetime(
                year_int, month_int, min(ft.due_day, last_day)
            ).date()

        if Transfer.objects.filter(
            description=ft.description,
            origin_account=ft.origin_account,
            destiny_account=ft.destiny_account,
            date__gte=month_start,
            date__lte=month_end,
            is_deleted=False,
        ).exists():
            continue

        transfer = Transfer.objects.create(
            description=ft.description,
            value=ft.value,
            date=transfer_date,
            horary=timezone.now().time(),
            category=ft.category,
            origin_account=ft.origin_account,
            destiny_account=ft.destiny_account,
            transfered=False,
            status="pending",
            fee=ft.fee,
            notes=ft.notes,
            created_by=user,
            updated_by=user,
        )
        created_transfers.append(transfer)

        ft.last_generated_month = month
        ft.save()

    existing_log = FixedTransferGenerationLog.objects.filter(
        month=month
    ).first()
    if existing_log:
        updated_ids = list(
            set((existing_log.fixed_transfer_ids or []) + fixed_transfer_ids)
        )
        existing_log.fixed_transfer_ids = updated_ids
        existing_log.total_generated = len(updated_ids)
        existing_log.updated_by = user
        existing_log.save()
    else:
        FixedTransferGenerationLog.objects.create(
            month=month,
            generated_by=user,
            total_generated=len(fixed_transfer_ids),
            fixed_transfer_ids=fixed_transfer_ids,
            created_by=user,
            updated_by=user,
        )

    return {
        "success": True,
        "created_count": len(created_transfers),
        "month": month,
        "transfers": created_transfers,
    }
