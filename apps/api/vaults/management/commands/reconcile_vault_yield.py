"""
Reconcilia o ledger de rendimento de cofres com as receitas que ele gera.

Invariante: Σ(Revenue income ativas de um cofre) == vault.accumulated_yield.
Uso: manage.py reconcile_vault_yield [--vault <uuid>] [--dry-run]
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.services import recalculate_account_balance
from vaults.models import Vault


class Command(BaseCommand):
    help = (
        "Reconcilia Σ(Revenue income ativas) com vault.accumulated_yield "
        "para cada cofre e recalcula o saldo da conta associada."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--vault",
            dest="vault_uuid",
            default=None,
            help="UUID de um único cofre. Sem isso, varre todos os cofres.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas reporta divergências, sem gravar nada.",
        )

    def handle(self, *args, **options):
        vaults = Vault.objects.filter(is_deleted=False)
        if options["vault_uuid"]:
            vaults = vaults.filter(uuid=options["vault_uuid"])

        dry_run = options["dry_run"]
        found = 0

        for vault in vaults:
            with transaction.atomic():
                diff = vault._reconcile_yield_invariant()
                if diff == 0:
                    continue

                found += 1
                self.stdout.write(
                    f"{vault.uuid} ({vault.description}): "
                    f"accumulated_yield={vault.accumulated_yield} diff={diff}"
                )

                if dry_run:
                    transaction.set_rollback(True)
                    continue

                recalculate_account_balance(vault.account_id)

        verb = "encontrado(s)" if dry_run else "corrigido(s)"
        self.stdout.write(
            self.style.SUCCESS(f"{found} cofre(s) divergente(s) {verb}.")
        )
