"""
Reconcilia o rendimento dos cofres com o novo modelo em que o rendimento é
lançado como receita (categoria ``income``) na conta associada **enquanto**
está no cofre, e deixa de existir quando é sacado.

1. Refaz o "replay" do ledger de cada cofre com as regras corrigidas:
   - ``accumulated_yield`` volta a zero quando o cofre é esvaziado;
   - ``accumulated_yield`` nunca excede ``current_balance`` (o principal é
     sacado antes do rendimento);
   - o rendimento consumido em saques deixa de existir.
   Isso elimina rendimentos-fantasma remanescentes de ciclos já encerrados.

2. Recria as ``Revenue`` consolidadas por cofre/mês de modo que a soma delas
   seja exatamente o ``accumulated_yield`` final de cada cofre.

3. Recalcula o saldo de todas as contas pela fórmula canônica.
"""

import datetime
from decimal import Decimal

from django.db import migrations
from django.utils import timezone

from vaults.services.yield_calc import (
    compound_yield,
    count_business_days,
    daily_rate_from,
)


def _month_bounds(year, month):
    start = datetime.date(year, month, 1)
    if month == 12:
        end = datetime.date(year + 1, 1, 1)
    else:
        end = datetime.date(year, month + 1, 1)
    return start, end


def _drain_months(by_month, amount):
    """Abate ``amount`` do dicionário {(ano, mês): valor}, meses mais
    recentes primeiro."""
    remaining = amount
    for key in sorted(by_month, reverse=True):
        if remaining <= 0:
            break
        take = min(by_month[key], remaining)
        by_month[key] -= take
        remaining -= take
        if by_month[key] <= 0:
            del by_month[key]


def _replay_vault_ledger(vault, VaultTransaction):
    txs = list(
        vault.transactions.filter(is_deleted=False).order_by(
            "transaction_date", "created_at", "id"
        )
    )
    daily_rate = daily_rate_from(vault.annual_yield_rate, vault.yield_rate)

    running = Decimal("0.00")
    clock = None
    acc_yield = Decimal("0.00")
    now = timezone.now()
    by_month = {}

    for tx in txs:
        if tx.transaction_type == "deposit":
            if running <= 0:
                clock = tx.transaction_date
            running += tx.amount
        elif tx.transaction_type == "withdrawal":
            running -= tx.amount
            if running <= 0:
                running = Decimal("0.00")
                clock = None
                acc_yield = Decimal("0.00")
                by_month.clear()
            elif acc_yield > running:
                _drain_months(by_month, acc_yield - running)
                acc_yield = running
        elif tx.transaction_type == "yield":
            if clock is not None and running > 0:
                days = count_business_days(clock, tx.transaction_date)
                correct = compound_yield(running, daily_rate, days)
            else:
                correct = Decimal("0.00")

            if correct <= 0:
                tx.is_deleted = True
                tx.deleted_at = now
                tx.save(update_fields=["is_deleted", "deleted_at"])
                continue

            running += correct
            acc_yield += correct
            key = (tx.transaction_date.year, tx.transaction_date.month)
            by_month[key] = by_month.get(key, Decimal("0.00")) + correct
            changed = []
            if tx.amount != correct:
                tx.amount = correct
                changed.append("amount")
            if tx.balance_after != running:
                tx.balance_after = running
                changed.append("balance_after")
            if changed:
                tx.save(update_fields=changed)
            clock = tx.transaction_date

    fields = []
    if vault.current_balance != running:
        vault.current_balance = running
        fields.append("current_balance")
    if vault.accumulated_yield != acc_yield:
        vault.accumulated_yield = acc_yield
        fields.append("accumulated_yield")
    if vault.last_yield_date != clock:
        vault.last_yield_date = clock
        fields.append("last_yield_date")
    if fields:
        vault.save(update_fields=fields)

    return by_month


def _rebuild_yield_revenues(vault, by_month, Revenue):
    """Remove as receitas de rendimento antigas do cofre e recria uma por mês
    conforme o estado final do replay."""
    Revenue.objects.filter(related_vault=vault, category="income").delete()

    now = timezone.now()
    for (year, month), amount in by_month.items():
        if amount <= 0:
            continue
        start, _ = _month_bounds(year, month)
        Revenue.objects.create(
            description=(
                f"Rendimento — {vault.description} "
                f"({start.strftime('%m/%Y')})"
            ),
            value=amount,
            date=start,
            horary=now.time(),
            category="income",
            account_id=vault.account_id,
            received=True,
            related_vault=vault,
            member_id=vault.account.owner_id,
            created_by_id=vault.created_by_id,
            updated_by_id=vault.created_by_id,
            notes=(
                "Receita gerada automaticamente pelo rendimento do cofre"
                " (reconciliação)."
            ),
        )


def _recalculate_account_balance(account, Revenue, Expense):
    from django.db.models import Sum

    total_rev = Revenue.objects.filter(
        account=account, received=True, is_deleted=False
    ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")
    total_exp = Expense.objects.filter(
        account=account, payed=True, is_deleted=False
    ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

    new_balance = total_rev - total_exp
    if account.current_balance != new_balance:
        account.current_balance = new_balance
        account.save(update_fields=["current_balance"])


def forwards(apps, schema_editor):
    Vault = apps.get_model("vaults", "Vault")
    VaultTransaction = apps.get_model("vaults", "VaultTransaction")
    Account = apps.get_model("accounts", "Account")
    Revenue = apps.get_model("revenues", "Revenue")
    Expense = apps.get_model("expenses", "Expense")

    for vault in Vault.objects.select_related("account").all():
        by_month = _replay_vault_ledger(vault, VaultTransaction)
        _rebuild_yield_revenues(vault, by_month, Revenue)

    for account in Account.objects.all():
        _recalculate_account_balance(account, Revenue, Expense)


class Migration(migrations.Migration):

    dependencies = [
        ("vaults", "0009_fix_vault_yield_and_account_balances"),
        ("revenues", "0012_revenue_related_vault_and_more"),
        ("accounts", "0005_alter_account_deleted_by"),
        ("expenses", "0020_fixedexpense_related_loan_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
