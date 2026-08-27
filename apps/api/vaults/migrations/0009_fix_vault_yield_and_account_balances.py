"""
Corrige dados afetados por dois bugs históricos:

1. ``Vault.deposit()``/``withdraw()`` alteravam ``Account.current_balance``
   diretamente, mas esse valor é recomputado como (receitas recebidas -
   despesas pagas) em qualquer escrita posterior, o que apagava o ajuste do
   cofre. -> Recalcula o saldo de todas as contas pela fórmula canônica.

2. ``last_yield_date`` não era reiniciado quando o cofre era zerado, gerando
   rendimento retroativo sobre períodos sem saldo. -> Refaz o "replay" do
   ledger de cada cofre, estornando rendimentos indevidos e reajustando
   ``current_balance`` / ``accumulated_yield`` / ``last_yield_date``.
"""

from decimal import Decimal

from django.db import migrations
from django.utils import timezone

from vaults.services.yield_calc import (
    compound_yield,
    count_business_days,
    daily_rate_from,
)


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
        elif tx.transaction_type == "yield":
            if clock is not None and running > 0:
                days = count_business_days(clock, tx.transaction_date)
                correct = compound_yield(running, daily_rate, days)
            else:
                correct = Decimal("0.00")

            if correct <= 0:
                # Rendimento indevido: estorna a transação.
                tx.is_deleted = True
                tx.deleted_at = now
                tx.save(update_fields=["is_deleted", "deleted_at"])
                continue

            running += correct
            acc_yield += correct
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

    for vault in Vault.objects.all():
        _replay_vault_ledger(vault, VaultTransaction)

    for account in Account.objects.all():
        _recalculate_account_balance(account, Revenue, Expense)


class Migration(migrations.Migration):

    dependencies = [
        ("vaults", "0008_vault_currency_code"),
        ("accounts", "0005_alter_account_deleted_by"),
        ("expenses", "0020_fixedexpense_related_loan_and_more"),
        ("revenues", "0011_revenue_fixed_revenue_template"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
