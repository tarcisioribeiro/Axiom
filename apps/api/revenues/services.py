from calendar import monthrange
from datetime import datetime

from django.db.models import Sum
from django.utils import timezone

from revenues.models import FixedRevenue, FixedRevenueGenerationLog, Revenue


def bulk_generate_fixed_revenues(month, revenue_values, user, upsert=False):
    """Generate fixed revenues for a given month.

    Returns a dict with keys: success, created_count, month, revenues.
    """
    year, month_num = month.split("-")
    year_int, month_int = int(year), int(month_num)
    created_revenues = []
    fixed_revenue_ids = []

    ids = [item["fixed_revenue_id"] for item in revenue_values]
    fixed_revs_map = {
        fr.id: fr
        for fr in FixedRevenue.objects.filter(
            id__in=ids,
            is_deleted=False,
            is_active=True,
        ).select_related("account", "member")
    }

    last_day = monthrange(year_int, month_int)[1]
    month_start = datetime(year_int, month_int, 1).date()
    month_end = datetime(year_int, month_int, last_day).date()

    for item in revenue_values:
        fixed_rev = fixed_revs_map.get(item["fixed_revenue_id"])
        if fixed_rev is None:
            raise FixedRevenue.DoesNotExist()
        fixed_revenue_ids.append(fixed_rev.id)

        try:
            revenue_date = datetime(
                year_int, month_int, fixed_rev.due_day
            ).date()
        except ValueError:
            revenue_date = datetime(
                year_int, month_int, min(fixed_rev.due_day, last_day)
            ).date()

        # Data explícita informada pelo usuário no diálogo de lançamento
        # (apenas se cair dentro do mês selecionado).
        override_date = item.get("date")
        if (
            override_date is not None
            and override_date.year == year_int
            and override_date.month == month_int
        ):
            revenue_date = override_date

        existing = Revenue.objects.filter(
            fixed_revenue_template=fixed_rev,
            date__gte=month_start,
            date__lte=month_end,
            is_deleted=False,
        ).first()
        if existing:
            if upsert:
                existing.value = item["value"]
                existing.updated_by = user
                existing.save(
                    update_fields=["value", "updated_by", "updated_at"]
                )
            continue

        revenue = Revenue.objects.create(
            description=fixed_rev.description,
            value=item["value"],
            date=revenue_date,
            horary=timezone.now().time(),
            category=fixed_rev.category,
            account=fixed_rev.account,
            received=False,
            notes=fixed_rev.notes,
            member=fixed_rev.member,
            fixed_revenue_template=fixed_rev,
            created_by=user,
            updated_by=user,
        )
        created_revenues.append(revenue)

        fixed_rev.last_generated_month = month
        fixed_rev.save()

    existing_log = FixedRevenueGenerationLog.objects.filter(
        month=month
    ).first()
    if existing_log:
        updated_ids = list(
            set((existing_log.fixed_revenue_ids or []) + fixed_revenue_ids)
        )
        existing_log.fixed_revenue_ids = updated_ids
        existing_log.total_generated = len(updated_ids)
        existing_log.updated_by = user
        existing_log.save()
    else:
        FixedRevenueGenerationLog.objects.create(
            month=month,
            generated_by=user,
            total_generated=len(fixed_revenue_ids),
            fixed_revenue_ids=fixed_revenue_ids,
            created_by=user,
            updated_by=user,
        )

    return {
        "success": True,
        "created_count": len(created_revenues),
        "month": month,
        "revenues": created_revenues,
    }


def get_fixed_revenues_stats():
    """Return consolidated statistics for fixed revenues."""
    now = timezone.now()
    current_month = now.strftime("%Y-%m")
    previous_month = (now - timezone.timedelta(days=30)).strftime("%Y-%m")

    active_templates = FixedRevenue.objects.filter(
        is_active=True, is_deleted=False
    ).count()

    def month_range_dates(ym):
        y, m = int(ym[:4]), int(ym[5:])
        start = datetime(y, m, 1).date()
        end = datetime(y, m, monthrange(y, m)[1]).date()
        return start, end

    cur_start, cur_end = month_range_dates(current_month)
    prev_start, prev_end = month_range_dates(previous_month)

    current_revenues = Revenue.objects.filter(
        fixed_revenue_template__isnull=False,
        date__gte=cur_start,
        date__lte=cur_end,
        is_deleted=False,
    )
    current_total = current_revenues.aggregate(Sum("value"))["value__sum"] or 0
    current_received = current_revenues.filter(received=True).count()

    previous_revenues = Revenue.objects.filter(
        fixed_revenue_template__isnull=False,
        date__gte=prev_start,
        date__lte=prev_end,
        is_deleted=False,
    )
    previous_total = (
        previous_revenues.aggregate(Sum("value"))["value__sum"] or 0
    )

    generated_current = FixedRevenue.objects.filter(
        last_generated_month=current_month, is_deleted=False
    ).count()

    pending_current = active_templates - generated_current

    return {
        "active_templates": active_templates,
        "current_month": {
            "month": current_month,
            "total_amount": float(current_total),
            "received_count": current_received,
            "generated_count": generated_current,
            "pending_count": max(pending_current, 0),
        },
        "previous_month": {
            "month": previous_month,
            "total_amount": float(previous_total),
        },
    }


def get_fully_generated_months(months_ahead=6):
    """Meses (``YYYY-MM``) em que TODOS os templates de receita fixa ativos
    já têm lançamento gerado. Usado pelo diálogo de lançamento para remover
    da lista os meses já totalmente lançados."""
    from collections import defaultdict

    months_ahead = max(0, min(int(months_ahead), 24))
    today = timezone.now().date()
    start = today.replace(day=1)
    end_year = start.year + (start.month - 1 + months_ahead) // 12
    end_month = (start.month - 1 + months_ahead) % 12 + 1
    end = datetime(
        end_year, end_month, monthrange(end_year, end_month)[1]
    ).date()

    active_ids = set(
        FixedRevenue.objects.filter(
            is_deleted=False, is_active=True
        ).values_list("id", flat=True)
    )
    if not active_ids:
        return []

    covered = defaultdict(set)
    for template_id, gen_date in Revenue.objects.filter(
        fixed_revenue_template_id__in=active_ids,
        is_deleted=False,
        date__gte=start,
        date__lte=end,
    ).values_list("fixed_revenue_template_id", "date"):
        covered[f"{gen_date.year}-{gen_date.month:02d}"].add(template_id)

    return sorted(month for month, ids in covered.items() if ids >= active_ids)
