from django.core.management.base import BaseCommand
from django.utils import timezone

from credit_cards.models import CreditCardBill


class Command(BaseCommand):
    help = (
        "Fecha automaticamente faturas cujas datas de vencimento já passaram"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Executa sem fazer mudanças, apenas mostra o que seria feito",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        today = timezone.now().date()

        # Busca faturas abertas com data de vencimento passada
        overdue_bills = CreditCardBill.objects.filter(
            status="open", due_date__lt=today, is_deleted=False
        )

        count = overdue_bills.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS("Nenhuma fatura vencida encontrada.")
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] {count} fatura(s) seriam fechadas:"
                )
            )
            for bill in overdue_bills:
                self.stdout.write(
                    f"  - Fatura {bill.id}: {bill.credit_card.name} "
                    f"{bill.month}/{bill.year} (vencimento: {bill.due_date})"
                )
        else:
            # Atualiza o status para 'closed' (fechada)
            updated = overdue_bills.update(status="closed", closed=True)

            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ {updated} fatura(s) fechada(s) com sucesso."
                )
            )

            for bill in overdue_bills:
                self.stdout.write(
                    f"  - Fatura {bill.id}: {bill.credit_card.name} "
                    f"{bill.month}/{bill.year}"
                )

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "Dica: Configure este comando para executar diariamente"
                " usando cron ou celery beat."
            )
        )
        self.stdout.write("Exemplo de cron (execução diária às 00:00):")
        self.stdout.write(
            "0 0 * * * cd /path/to/project"
            " && python manage.py close_overdue_bills"
        )
