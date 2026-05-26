from calendar import monthrange
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Account
from vaults.models import Vault, VaultRecurringContribution


class Command(BaseCommand):
    help = (
        "Processa contribuições recorrentes agendadas"
        " de cofres para o mês especificado."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--month",
            type=str,
            default=None,
            help="Mês alvo no formato YYYY-MM (padrão: mês atual)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simula a geração sem persistir alterações",
        )

    def handle(self, *args, **options):
        month_str = options.get("month")
        dry_run = options.get("dry_run")

        if month_str:
            try:
                year_int, month_int = [int(x) for x in month_str.split("-")]
                if not (1 <= month_int <= 12):
                    raise ValueError
            except (ValueError, AttributeError):
                raise CommandError("Formato de mês inválido. Use YYYY-MM.")
        else:
            today = timezone.now().date()
            year_int, month_int = today.year, today.month
            month_str = f"{year_int:04d}-{month_int:02d}"

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] Simulando geração para {month_str}"
                )
            )
        else:
            self.stdout.write(f"Gerando contribuições para {month_str}...")

        contributions = VaultRecurringContribution.objects.filter(
            is_deleted=False, is_active=True
        ).select_related("vault", "vault__account")

        generated = 0
        skipped = 0
        errors = 0

        for contrib in contributions:
            if not contrib.is_in_scope_for_month(year_int, month_int):
                self.stdout.write(
                    f"  Ignorado [{contrib.id}] {contrib.description}:"
                    f" fora do período"
                )
                skipped += 1
                continue

            if contrib.last_generated_month == month_str:
                self.stdout.write(
                    f"  Ignorado [{contrib.id}] {contrib.description}:"
                    f" já gerado"
                )
                skipped += 1
                continue

            last_day = monthrange(year_int, month_int)[1]
            day = min(contrib.day_of_month, last_day)
            try:
                deposit_date = datetime(year_int, month_int, day).date()
            except ValueError:
                deposit_date = datetime(year_int, month_int, last_day).date()

            if dry_run:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [DRY RUN] Depositaria R$ {contrib.amount}"
                        f" no cofre '{contrib.vault.description}'"
                        f" em {deposit_date}"
                    )
                )
                generated += 1
                continue

            try:
                with transaction.atomic():
                    vault = Vault.objects.select_for_update().get(
                        pk=contrib.vault_id
                    )
                    account = Account.objects.select_for_update().get(
                        pk=vault.account_id
                    )
                    vault.account = account

                    vault_tx = vault.deposit(
                        amount=contrib.amount,
                        description=contrib.description,
                        user=contrib.created_by,
                    )
                    vault_tx.recurring_contribution = contrib
                    vault_tx.transaction_date = deposit_date
                    vault_tx.save(
                        update_fields=[
                            "recurring_contribution",
                            "transaction_date",
                        ]
                    )

                    contrib.last_generated_month = month_str
                    contrib.save(update_fields=["last_generated_month"])

                self.stdout.write(
                    self.style.SUCCESS(
                        f"  OK [{contrib.id}] {contrib.description}:"
                        f" R$ {contrib.amount}"
                        f" -> '{contrib.vault.description}'"
                    )
                )
                generated += 1
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"  ERRO [{contrib.id}] {contrib.description}: {e}"
                    )
                )
                errors += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nConcluído: {generated} gerado(s), {skipped} ignorado(s), "
                f"{errors} erro(s)"
            )
        )
