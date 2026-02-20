"""
Management command para processar transferências existentes.

Este comando cria despesas e receitas para transferências já cadastradas
que não possuem as transações relacionadas.

Execute com:
python manage.py process_existing_transfers
"""

from django.core.management.base import BaseCommand

from expenses.models import Expense
from revenues.models import Revenue
from transfers.models import Transfer


class Command(BaseCommand):
    help = (
        "Processa transferências existentes criando despesas" " e receitas relacionadas"
    )

    def add_arguments(self, parser):
        """
        Adiciona argumentos opcionais ao comando.

        Parameters
        ----------
        parser : ArgumentParser
            Parser de argumentos do Django
        """
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Executa sem fazer alterações no banco de dados",
        )

    def handle(self, *args, **options):
        """
        Executa o comando de processamento de transferências.

        Itera sobre todas as transferências efetivadas e cria
        as despesas e receitas relacionadas se ainda não existirem.
        """
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("MODO DRY-RUN: Nenhuma alteração será feita")
            )

        self.stdout.write(
            self.style.WARNING("Iniciando processamento de transferências...")
        )

        # Buscar apenas transferências efetivadas
        transfers = Transfer.objects.filter(transfered=True)
        total_transfers = transfers.count()

        self.stdout.write(
            self.style.NOTICE(f"Total de transferências efetivadas: {total_transfers}")
        )

        created_expenses = 0
        created_revenues = 0
        already_processed = 0
        errors = 0

        for transfer in transfers:
            try:
                # Verificar se já existe despesa relacionada
                expense_exists = Expense.objects.filter(
                    description=f"Transferência: {transfer.description}",
                    account=transfer.origin_account,
                    date=transfer.date,
                    horary=transfer.horary,
                    value=transfer.value + transfer.fee,
                ).exists()

                # Verificar se já existe receita relacionada
                revenue_exists = Revenue.objects.filter(
                    description=f"Transferência: {transfer.description}",
                    account=transfer.destiny_account,
                    date=transfer.date,
                    horary=transfer.horary,
                    value=transfer.value,
                ).exists()

                if expense_exists and revenue_exists:
                    already_processed += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Transferência "{transfer.description}" '
                            f"já processada"
                        )
                    )
                    continue

                # Criar despesa se não existir
                if not expense_exists:
                    if not dry_run:
                        Expense.objects.create(
                            description=f"Transferência: {transfer.description}",
                            value=transfer.value + transfer.fee,
                            date=transfer.date,
                            horary=transfer.horary,
                            category="others",
                            account=transfer.origin_account,
                            payed=transfer.transfered,
                            merchant=(
                                "Transferência para"
                                f" {transfer.destiny_account.account_name}"
                            ),
                            payment_method="transfer",
                            member=transfer.member,
                            notes=(
                                "Transferência ID:"
                                f" {transfer.transaction_id or transfer.uuid}\n"
                                f"Tipo: {transfer.get_category_display()}\n"
                                f"Taxa: R$ {transfer.fee}\n"
                                f"{transfer.notes or ''}"
                            ),
                            created_by=transfer.created_by,
                            updated_by=transfer.updated_by,
                        )
                    created_expenses += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            "✓ Despesa criada para transferência"
                            f' "{transfer.description}"'
                        )
                    )

                # Criar receita se não existir
                if not revenue_exists:
                    if not dry_run:
                        Revenue.objects.create(
                            description=f"Transferência: {transfer.description}",
                            value=transfer.value,
                            date=transfer.date,
                            horary=transfer.horary,
                            category="transfer",
                            account=transfer.destiny_account,
                            received=transfer.transfered,
                            source=(
                                "Transferência de"
                                f" {transfer.origin_account.account_name}"
                            ),
                            member=transfer.member,
                            notes=(
                                "Transferência ID:"
                                f" {transfer.transaction_id or transfer.uuid}\n"
                                f"Tipo: {transfer.get_category_display()}\n"
                                f"{transfer.notes or ''}"
                            ),
                            created_by=transfer.created_by,
                            updated_by=transfer.updated_by,
                        )
                    created_revenues += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            "✓ Receita criada para transferência"
                            f' "{transfer.description}"'
                        )
                    )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Erro ao processar transferência"
                        f' "{transfer.description}": {e}'
                    )
                )
                errors += 1

        # Resumo final
        self.stdout.write(
            self.style.SUCCESS(
                f'\n{"="*70}'
                f"\nProcessamento concluído!"
                f'\n{"="*70}'
                f"\nTotal de transferências: {total_transfers}"
                f"\nJá processadas: {already_processed}"
                f"\nDespesas criadas: {created_expenses}"
                f"\nReceitas criadas: {created_revenues}"
                f"\nErros: {errors}"
            )
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\n⚠ MODO DRY-RUN: Nenhuma alteração foi feita" " no banco de dados"
                )
            )
        elif errors == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    "\n✓ Todas as transferências foram processadas com sucesso!"
                    '\n\nExecute "python manage.py update_balances"'
                    " para atualizar os saldos das contas."
                )
            )
