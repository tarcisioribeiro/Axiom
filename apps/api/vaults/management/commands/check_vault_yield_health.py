"""
Django management command — check the vault yield ledger for drift.

Exits non-zero if any active vault has Σ(Revenue income ativas) !=
accumulated_yield beyond a small rounding tolerance — the invariant behind
the vault yield leak (see [[vault-yield-model]]). Read-only: never writes.
Fix drift found here with ``manage.py reconcile_vault_yield``.

Usage:
    python manage.py check_vault_yield_health
    python manage.py check_vault_yield_health --tolerance 0.01

Integrate with external monitoring (Prometheus, UptimeRobot, cron alert):
    docker compose exec api python manage.py check_vault_yield_health || alert
"""

import sys
from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db.models import Sum

from revenues.models import Revenue
from vaults.models import Vault


class Command(BaseCommand):
    help = (
        "Exit non-zero if any vault's accumulated_yield diverges from"
        " Σ(Revenue income ativas) beyond the tolerance."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--tolerance",
            type=Decimal,
            default=Decimal("0.00"),
            help="Divergência máxima aceita, em reais (default: 0.00).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        tolerance = options["tolerance"]

        divergent = []
        for vault in Vault.objects.filter(is_deleted=False):
            total_income = Revenue.objects.filter(
                related_vault=vault,
                account=vault.account,
                category="income",
                is_deleted=False,
            ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")

            diff = vault.accumulated_yield - total_income
            if abs(diff) > tolerance:
                divergent.append((vault, diff))

        if divergent:
            self.stderr.write(
                self.style.ERROR(
                    f"VAULT YIELD DRIFT: {len(divergent)} cofre(s) com"
                    f" accumulated_yield != Σ(Revenue income).\n"
                    "Corrigir com: manage.py reconcile_vault_yield"
                    " [--vault <uuid>]"
                )
            )
            for vault, diff in divergent:
                self.stderr.write(
                    f"  {vault.uuid} ({vault.description}):"
                    f" accumulated_yield={vault.accumulated_yield}"
                    f" diff={diff}"
                )
            sys.exit(1)

        self.stdout.write(
            self.style.SUCCESS(
                "Vault yield OK — nenhuma divergência acima da tolerância."
            )
        )
