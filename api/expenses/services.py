from datetime import datetime
from calendar import monthrange

from django.db.models import Count, Sum
from django.utils import timezone

from expenses.models import Expense, FixedExpense, FixedExpenseGenerationLog
from credit_cards.models import CreditCardBill, CreditCardPurchase, CreditCardInstallment


_MONTH_MAP = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}


def get_or_create_bill(credit_card, year, month_num, user):
    """Return (bill, created) for the given credit card, year and month."""
    month_code = _MONTH_MAP[month_num]

    bill = CreditCardBill.objects.filter(
        credit_card=credit_card,
        year=year,
        month=month_code,
        status='open',
        is_deleted=False,
    ).first()

    if bill:
        return bill, False

    closing_day = credit_card.closing_day or 1
    due_day = credit_card.due_day or 10
    year_int = int(year)
    month_int = int(month_num)
    last_day = monthrange(year_int, month_int)[1]

    invoice_beginning_date = datetime(year_int, month_int, 1).date()
    invoice_ending_date = datetime(year_int, month_int, min(closing_day, last_day)).date()

    if due_day > closing_day:
        try:
            due_date = datetime(year_int, month_int, due_day).date()
        except ValueError:
            due_date = datetime(year_int, month_int, last_day).date()
    else:
        next_month = month_int + 1
        next_year = year_int
        if next_month > 12:
            next_month = 1
            next_year += 1
        next_last_day = monthrange(next_year, next_month)[1]
        try:
            due_date = datetime(next_year, next_month, due_day).date()
        except ValueError:
            due_date = datetime(next_year, next_month, next_last_day).date()

    bill = CreditCardBill.objects.create(
        credit_card=credit_card,
        year=year,
        month=month_code,
        invoice_beginning_date=invoice_beginning_date,
        invoice_ending_date=invoice_ending_date,
        due_date=due_date,
        total_amount=0,
        minimum_payment=0,
        paid_amount=0,
        status='open',
        closed=False,
        created_by=user,
        updated_by=user,
    )
    return bill, True


def bulk_generate_fixed_expenses(month, expense_values, user):
    """Generate fixed expenses for a given month.

    Returns a dict with keys: success, created_count, month, expenses.
    Raises FixedExpense.DoesNotExist if any fixed expense id is invalid.
    """
    year, month_num = month.split('-')
    year_int, month_int = int(year), int(month_num)
    created_expenses = []
    fixed_expense_ids = []

    for item in expense_values:
        fixed_exp = FixedExpense.objects.get(
            id=item['fixed_expense_id'],
            is_deleted=False,
            is_active=True,
        )
        fixed_expense_ids.append(fixed_exp.id)

        last_day = monthrange(year_int, month_int)[1]
        try:
            expense_date = datetime(year_int, month_int, fixed_exp.due_day).date()
        except ValueError:
            expense_date = datetime(year_int, month_int, min(fixed_exp.due_day, last_day)).date()

        if fixed_exp.credit_card:
            bill, _ = get_or_create_bill(fixed_exp.credit_card, year, month_num, user)

            already_exists = CreditCardInstallment.objects.filter(
                purchase__description=fixed_exp.description,
                purchase__card=fixed_exp.credit_card,
                bill=bill,
                is_deleted=False,
                purchase__is_deleted=False,
            ).exists()

            if already_exists:
                continue

            purchase = CreditCardPurchase.objects.create(
                description=fixed_exp.description,
                total_value=item['value'],
                purchase_date=expense_date,
                purchase_time=timezone.now().time(),
                category=fixed_exp.category,
                card=fixed_exp.credit_card,
                total_installments=1,
                merchant=fixed_exp.merchant or '',
                member=fixed_exp.member,
                notes=fixed_exp.notes or '',
                created_by=user,
                updated_by=user,
            )
            CreditCardInstallment.objects.create(
                purchase=purchase,
                installment_number=1,
                value=item['value'],
                due_date=expense_date,
                bill=bill,
                payed=False,
                created_by=user,
                updated_by=user,
            )
        else:
            month_start = datetime(year_int, month_int, 1).date()
            month_end = datetime(year_int, month_int, last_day).date()

            if Expense.objects.filter(
                fixed_expense_template=fixed_exp,
                date__gte=month_start,
                date__lte=month_end,
                is_deleted=False,
            ).exists():
                continue

            expense = Expense.objects.create(
                description=fixed_exp.description,
                value=item['value'],
                date=expense_date,
                horary=timezone.now().time(),
                category=fixed_exp.category,
                account=fixed_exp.account,
                payed=False,
                merchant=fixed_exp.merchant,
                payment_method=fixed_exp.payment_method,
                notes=fixed_exp.notes,
                member=fixed_exp.member,
                fixed_expense_template=fixed_exp,
                created_by=user,
                updated_by=user,
            )
            created_expenses.append(expense)

        fixed_exp.last_generated_month = month
        fixed_exp.save()

    # Update or create generation log
    existing_log = FixedExpenseGenerationLog.objects.filter(month=month).first()
    if existing_log:
        updated_ids = list(set((existing_log.fixed_expense_ids or []) + fixed_expense_ids))
        existing_log.fixed_expense_ids = updated_ids
        existing_log.total_generated = len(updated_ids)
        existing_log.updated_by = user
        existing_log.save()
    else:
        FixedExpenseGenerationLog.objects.create(
            month=month,
            generated_by=user,
            total_generated=len(fixed_expense_ids),
            fixed_expense_ids=fixed_expense_ids,
            created_by=user,
            updated_by=user,
        )

    return {
        'success': True,
        'created_count': len(created_expenses),
        'month': month,
        'expenses': created_expenses,
    }


def get_fixed_expenses_stats():
    """Return consolidated statistics for fixed expenses."""
    now = timezone.now()
    current_month = now.strftime('%Y-%m')
    previous_month = (now - timezone.timedelta(days=30)).strftime('%Y-%m')

    active_templates = FixedExpense.objects.filter(is_active=True, is_deleted=False).count()

    def month_range_dates(ym):
        y, m = int(ym[:4]), int(ym[5:])
        start = datetime(y, m, 1).date()
        end = datetime(y, m, monthrange(y, m)[1]).date()
        return start, end

    cur_start, cur_end = month_range_dates(current_month)
    current_expenses = Expense.objects.filter(
        fixed_expense_template__isnull=False,
        date__gte=cur_start,
        date__lte=cur_end,
        is_deleted=False,
    )
    current_total = current_expenses.aggregate(Sum('value'))['value__sum'] or 0
    current_paid = current_expenses.filter(payed=True).count()
    current_pending = current_expenses.filter(payed=False).count()

    prev_start, prev_end = month_range_dates(previous_month)
    previous_total = Expense.objects.filter(
        fixed_expense_template__isnull=False,
        date__gte=prev_start,
        date__lte=prev_end,
        is_deleted=False,
    ).aggregate(Sum('value'))['value__sum'] or 0

    category_breakdown = list(
        current_expenses.values('category').annotate(
            total=Sum('value'), count=Count('id')
        ).order_by('-total')
    )

    difference = float(current_total) - float(previous_total)
    percentage_change = round((difference / float(previous_total)) * 100, 2) if previous_total else 0

    return {
        'active_templates': active_templates,
        'current_month': {
            'month': current_month,
            'total_value': float(current_total),
            'paid_count': current_paid,
            'pending_count': current_pending,
            'total_count': current_paid + current_pending,
        },
        'previous_month': {
            'month': previous_month,
            'total_value': float(previous_total),
        },
        'comparison': {
            'difference': difference,
            'percentage_change': percentage_change,
        },
        'category_breakdown': category_breakdown,
    }
