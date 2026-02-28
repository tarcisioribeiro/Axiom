from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from credit_cards.models import CreditCard, CreditCardBill, CreditCardInstallment


class Command(BaseCommand):
    help = (
        "Corrige o status de pagamento das parcelas baseado nas faturas pagas. "
        "Também reseta o credit_limit dos cartões para o max_limit."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Executa sem fazer mudanças, apenas mostra o que seria feito",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("=" * 60))
        self.stdout.write(
            self.style.HTTP_INFO("CORREÇÃO DE PARCELAS E LIMITES DE CARTÕES")
        )
        self.stdout.write(self.style.HTTP_INFO("=" * 60))
        self.stdout.write("")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("[MODO DRY-RUN] Nenhuma alteração será feita\n")
            )

        with transaction.atomic():
            # 1. Corrigir parcelas de faturas pagas
            self._fix_paid_bill_installments(dry_run)

            # 2. Resetar credit_limit dos cartões para max_limit
            self._reset_card_limits(dry_run)

            if dry_run:
                # Rollback em dry-run
                transaction.set_rollback(True)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("✓ Processo concluído!"))

    def _fix_paid_bill_installments(self, dry_run):
        """Marca como pagas as parcelas de faturas que já foram pagas."""
        self.stdout.write(self.style.HTTP_INFO("\n--- CORREÇÃO DE PARCELAS ---\n"))

        # Buscar faturas pagas
        paid_bills = CreditCardBill.objects.filter(
            status="paid", is_deleted=False
        ).select_related("credit_card")

        if not paid_bills.exists():
            self.stdout.write("Nenhuma fatura paga encontrada.")
            return

        total_installments_fixed = 0

        for bill in paid_bills:
            # Buscar parcelas não pagas desta fatura
            unpaid_installments = CreditCardInstallment.objects.filter(
                bill=bill, is_deleted=False, payed=False
            )

            count = unpaid_installments.count()
            if count > 0:
                self.stdout.write(
                    f"  Fatura {bill.credit_card.name} - {bill.month}/{bill.year}: "
                    f"{count} parcela(s) a corrigir"
                )

                if not dry_run:
                    unpaid_installments.update(payed=True)

                total_installments_fixed += count

        if total_installments_fixed > 0:
            self.stdout.write("")
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Total: {total_installments_fixed} parcela(s) "
                    f'{"seriam marcadas" if dry_run else "marcadas"} como pagas'
                )
            )
        else:
            self.stdout.write("  Nenhuma parcela precisava de correção.")

    def _reset_card_limits(self, dry_run):
        """Reseta o credit_limit dos cartões para o max_limit."""
        self.stdout.write(
            self.style.HTTP_INFO("\n--- RESET DE LIMITES DE CARTÕES ---\n")
        )

        cards = CreditCard.objects.filter(is_deleted=False)

        if not cards.exists():
            self.stdout.write("Nenhum cartão encontrado.")
            return

        cards_fixed = 0

        for card in cards:
            credit_limit = Decimal(str(card.credit_limit))
            max_limit = Decimal(str(card.max_limit))

            if credit_limit != max_limit:
                self.stdout.write(
                    f"  {card.name}: credit_limit {credit_limit} -> {max_limit}"
                )

                if not dry_run:
                    card.credit_limit = max_limit
                    card.save(update_fields=["credit_limit"])

                cards_fixed += 1

        if cards_fixed > 0:
            self.stdout.write("")
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Total: {cards_fixed} cartão(ões) "
                    f'{"seriam corrigidos" if dry_run else "corrigidos"}'
                )
            )
        else:
            self.stdout.write("  Todos os cartões já têm credit_limit = max_limit.")
