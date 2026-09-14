"""
Corrige o vazamento de saldo causado por VaultTransactionUpdateView (edição/
exclusão manual de transações de rendimento no histórico do cofre): antes
desta correção, o endpoint ajustava ``Vault.current_balance`` e
``Vault.accumulated_yield`` diretamente pela diferença editada, sem tocar a
``Revenue`` de rendimento consolidada do mês — quebrando a invariante
Σ(Revenue income ativas do cofre) == accumulated_yield e vazando a diferença
para ``Account.available_balance`` (via ``deposited_in_vaults``, que reflete
``current_balance`` do cofre).

Reconstrói ``current_balance``/``accumulated_yield`` de cada cofre fazendo o
replay do ledger real (``VaultTransaction`` em ordem cronológica), igual à
migração 0010, mas **sem recalcular o valor das transações de rendimento**
pela fórmula — usa exatamente o ``amount`` gravado em cada transação, para
não descartar edições manuais do usuário (esse é o objetivo da correção).
Isso trata corretamente saques que consumiram rendimento acumulado
(``_drain_months``), o que uma simples soma de transações de rendimento não
faria.

Em seguida recria as ``Revenue`` consolidadas por cofre/mês a partir do
resultado do replay e recalcula o saldo das contas afetadas.
"""

import datetime
from decimal import Decimal

from django.db import migrations
from django.utils import timezone


def _month_bounds(year, month):
    start = datetime.date(year, month, 1)
    if month == 12:
        end = datetime.date(year + 1, 1, 1)
    else:
        end = datetime.date(year, month + 1, 1)
    return start, end


def _drain_months(by_month, amount):
    """Abate ``amount`` do dicionário {(ano, mês): valor}, meses mais
    recentes primeiro (mesma ordem usada em Vault.withdraw)."""
    remaining = amount
    for key in sorted(by_month, reverse=True):
        if remaining <= 0:
            break
        take = min(by_month[key], remaining)
        by_month[key] -= take
        remaining -= take
        if by_month[key] <= 0:
            del by_month[key]


def _replay_vault_ledger(vault):
    """
    Replay do ledger preservando o ``amount`` gravado em cada transação de
    rendimento (não recalcula pela taxa/fórmula — isso descartaria edições
    manuais do usuário, que é exatamente o bug sendo corrigido).
    """
    txs = vault.transactions.filter(is_deleted=False).order_by(
        "transaction_date", "created_at", "id"
    )

    running = Decimal("0.00")
    clock = None
    acc_yield = Decimal("0.00")
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
            amount = tx.amount
            if amount <= 0:
                continue
            running += amount
            acc_yield += amount
            key = (tx.transaction_date.year, tx.transaction_date.month)
            by_month[key] = by_month.get(key, Decimal("0.00")) + amount
            clock = tx.transaction_date

    return running, acc_yield, clock, by_month


def _rebuild_yield_revenues(vault, by_month, Revenue):
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
    Account = apps.get_model("accounts", "Account")
    Revenue = apps.get_model("revenues", "Revenue")
    Expense = apps.get_model("expenses", "Expense")

    touched_accounts = set()

    for vault in Vault.objects.select_related("account").all():
        running, acc_yield, clock, by_month = _replay_vault_ledger(vault)

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

        _rebuild_yield_revenues(vault, by_month, Revenue)
        touched_accounts.add(vault.account_id)

    for account_id in touched_accounts:
        account = Account.objects.get(pk=account_id)
        _recalculate_account_balance(account, Revenue, Expense)


def backwards(apps, schema_editor):
    # Irreversível: o drift corrigido era um estado inconsistente por
    # definição, não há para onde "voltar".
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("vaults", "0011_reformat_yield_transaction_descriptions"),
        ("revenues", "0012_revenue_related_vault_and_more"),
        ("accounts", "0005_alter_account_deleted_by"),
        ("expenses", "0020_fixedexpense_related_loan_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
