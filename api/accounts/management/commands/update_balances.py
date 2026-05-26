"""
Management command para recalcular saldos de todas as contas.

Este comando pode ser executado com:
python manage.py update_balances
"""

from typing import Any

from django.core.management.base import BaseCommand

from accounts.models import Account
from accounts.services import recalculate_account_balance


class Command(BaseCommand):
    help = (
        "Recalcula os saldos de todas as contas"
        " com base em receitas e despesas"
    )

    def handle(self, *args: Any, **options: Any) -> None:
        """
        Executa o comando de recálculo de saldos.

        Itera sobre todas as contas e recalcula seus saldos
        com base nas receitas recebidas e despesas pagas.
        """
        self.stdout.write(
            self.style.WARNING("Iniciando recálculo de saldos...")
        )

        accounts = Account.objects.all()
        total_accounts = accounts.count()

        self.stdout.write(
            self.style.NOTICE(f"Total de contas a processar: {total_accounts}")
        )

        updated_count = 0
        error_count = 0

        for account in accounts:
            try:
                old_balance = account.current_balance
                new_balance = recalculate_account_balance(account.pk)

                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Conta "{account.account_name}": '
                        f"R$ {old_balance} → R$ {new_balance}"
                    )
                )
                updated_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Erro ao atualizar conta"
                        f' "{account.account_name}": {e}'
                    )
                )
                error_count += 1

        # Resumo final
        self.stdout.write(
            self.style.SUCCESS(
                f'\n{"="*60}'
                f"\nRecálculo concluído!"
                f'\n{"="*60}'
                f"\nTotal de contas processadas: {total_accounts}"
                f"\nContas atualizadas com sucesso: {updated_count}"
                f"\nErros: {error_count}"
            )
        )

        if error_count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    "\n✓ Todos os saldos foram atualizados com sucesso!"
                )
            )
