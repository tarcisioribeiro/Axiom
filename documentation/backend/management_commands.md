# Comandos de Management Django

## Visão Geral

Django permite criar comandos customizados de gerenciamento que podem ser executados via `python manage.py <comando>`. O Axiom possui vários comandos úteis para manutenção, setup e operações administrativas.

## Estrutura de um Comando

### Localização

Comandos devem estar em:
```
<app>/management/commands/<comando>.py
```

Exemplo:
```
accounts/
└── management/
    ├── __init__.py
    └── commands/
        ├── __init__.py
        └── update_balances.py
```

### Template Básico

```python
from django.core.management.base import BaseCommand, CommandError

class Command(BaseCommand):
    help = 'Descrição curta do que o comando faz'

    def add_arguments(self, parser):
        """Adiciona argumentos opcionais ao comando."""
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Executa sem fazer alterações no banco',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limita número de registros processados',
        )

    def handle(self, *args, **options):
        """Lógica principal do comando."""
        dry_run = options['dry_run']
        limit = options['limit']

        # Mensagens formatadas
        self.stdout.write(self.style.SUCCESS('Comando iniciado'))
        self.stdout.write(self.style.WARNING('Atenção!'))
        self.stdout.write(self.style.ERROR('Erro!'))
        self.stdout.write(self.style.NOTICE('Informação'))

        # Lógica do comando aqui
        try:
            # ... código
            self.stdout.write(self.style.SUCCESS('Comando concluído'))
        except Exception as e:
            raise CommandError(f'Erro ao executar: {e}')
```

## Comandos do Axiom

### 1. update_balances

**Arquivo**: `accounts/management/commands/update_balances.py`

**Objetivo**: Recalcula os saldos de todas as contas baseado em receitas e despesas.

**Uso**:
```bash
python manage.py update_balances
```

**Código**:
```python
from django.core.management.base import BaseCommand
from accounts.models import Account
from accounts.signals import update_account_balance


class Command(BaseCommand):
    help = 'Recalcula os saldos de todas as contas com base em receitas e despesas'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING('Iniciando recálculo de saldos...')
        )

        accounts = Account.objects.all()
        total_accounts = accounts.count()

        self.stdout.write(
            self.style.NOTICE(f'Total de contas a processar: {total_accounts}')
        )

        updated_count = 0
        error_count = 0

        for account in accounts:
            try:
                old_balance = account.current_balance
                update_account_balance(account)
                account.refresh_from_db()
                new_balance = account.current_balance

                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Conta "{account.account_name}": '
                        f'R$ {old_balance} → R$ {new_balance}'
                    )
                )
                updated_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Erro ao atualizar conta "{account.account_name}": {e}'
                    )
                )
                error_count += 1

        # Resumo final
        self.stdout.write(
            self.style.SUCCESS(
                f'\n{"="*60}'
                f'\nRecálculo concluído!'
                f'\n{"="*60}'
                f'\nTotal de contas processadas: {total_accounts}'
                f'\nContas atualizadas com sucesso: {updated_count}'
                f'\nErros: {error_count}'
            )
        )

        if error_count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    '\n✓ Todos os saldos foram atualizados com sucesso!'
                )
            )
```

**Quando usar**:
- Após migração de dados
- Se suspeitar de inconsistências nos saldos
- Após correção manual de receitas/despesas
- Como manutenção periódica

### 2. setup_permissions

**Arquivo**: `app/management/commands/setup_permissions.py`

**Objetivo**: Configura permissões padrão para o grupo "members", garantindo que todos os usuários tenham acesso às funcionalidades.

**Uso**:
```bash
python manage.py setup_permissions
```

**Código**:
```python
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType


class Command(BaseCommand):
    help = 'Setup default permissions for the members group'

    def handle(self, *args, **options):
        # Criar ou obter grupo members
        members_group, created = Group.objects.get_or_create(name='members')

        if created:
            self.stdout.write(
                self.style.SUCCESS('Created "members" group')
            )
        else:
            self.stdout.write(
                self.style.WARNING('Group "members" already exists')
            )

        # Definir modelos com acesso completo
        app_models = {
            'accounts': ['account'],
            'expenses': ['expense', 'fixedexpense', 'fixedexpensegenerationlog'],
            'revenues': ['revenue'],
            'credit_cards': ['creditcard', 'creditcardbill', 'creditcardexpense'],
            'transfers': ['transfer'],
            'loans': ['loan'],
            'members': ['member'],
            'library': ['author', 'publisher', 'book', 'summary', 'reading'],
            'security': ['password', 'storedcreditcard', 'storedbankaccount', 'archive'],
            'personal_planning': ['routinetask', 'dailytaskrecord', 'goal', 'dailyreflection'],
        }

        # Permissões: view, add, change, delete (CRUD completo)
        permission_types = ['view', 'add', 'change', 'delete']

        total_permissions = 0

        for app_label, models in app_models.items():
            for model_name in models:
                try:
                    content_type = ContentType.objects.get(
                        app_label=app_label,
                        model=model_name
                    )

                    for perm_type in permission_types:
                        codename = f'{perm_type}_{model_name}'

                        try:
                            permission = Permission.objects.get(
                                codename=codename,
                                content_type=content_type
                            )

                            # Adicionar permissão ao grupo
                            if not members_group.permissions.filter(
                                id=permission.id
                            ).exists():
                                members_group.permissions.add(permission)
                                total_permissions += 1
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'✓ Added: {app_label}.{codename}'
                                    )
                                )

                        except Permission.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'✗ Permission not found: '
                                    f'{app_label}.{codename}'
                                )
                            )

                except ContentType.DoesNotExist:
                    self.stdout.write(
                        self.style.ERROR(
                            f'✗ ContentType not found: '
                            f'{app_label}.{model_name}'
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Setup complete! Added {total_permissions} permissions '
                f'to the "members" group'
            )
        )

        # Mostrar total de permissões
        current_perms = members_group.permissions.count()
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Group "members" now has {current_perms} total permissions'
            )
        )

        # Auto-adicionar usuários ao grupo
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users_added = 0

        for user in User.objects.all():
            if not user.groups.filter(id=members_group.id).exists():
                user.groups.add(members_group)
                users_added += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Added user "{user.username}" to "members" group'
                    )
                )

        if users_added == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    '✓ All users are already in the "members" group'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Added {users_added} user(s) to the "members" group'
                )
            )
```

**Quando usar**:
- Após criar novos usuários
- Após adicionar novos modelos
- Após fresh install
- Se usuários não têm permissões corretas

### 3. process_existing_transfers

**Arquivo**: `transfers/management/commands/process_existing_transfers.py`

**Objetivo**: Processa transferências existentes criando despesas e receitas relacionadas.

**Uso**:
```bash
# Executar normalmente
python manage.py process_existing_transfers

# Modo dry-run (não faz alterações)
python manage.py process_existing_transfers --dry-run
```

**Código**:
```python
from django.core.management.base import BaseCommand
from transfers.models import Transfer
from expenses.models import Expense
from revenues.models import Revenue


class Command(BaseCommand):
    help = 'Processa transferências existentes criando despesas e receitas relacionadas'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Executa sem fazer alterações no banco de dados',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(
                self.style.WARNING('MODO DRY-RUN: Nenhuma alteração será feita')
            )

        self.stdout.write(
            self.style.WARNING('Iniciando processamento de transferências...')
        )

        # Buscar apenas transferências efetivadas
        transfers = Transfer.objects.filter(transfered=True)
        total_transfers = transfers.count()

        self.stdout.write(
            self.style.NOTICE(
                f'Total de transferências efetivadas: {total_transfers}'
            )
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
                    value=transfer.value + transfer.fee
                ).exists()

                # Verificar se já existe receita relacionada
                revenue_exists = Revenue.objects.filter(
                    description=f"Transferência: {transfer.description}",
                    account=transfer.destiny_account,
                    date=transfer.date,
                    horary=transfer.horary,
                    value=transfer.value
                ).exists()

                if expense_exists and revenue_exists:
                    already_processed += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Transferência "{transfer.description}" '
                            f'já processada'
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
                            category='others',
                            account=transfer.origin_account,
                            payed=transfer.transfered,
                            merchant=f"Transferência para {transfer.destiny_account.account_name}",
                            payment_method='transfer',
                            member=transfer.member,
                            notes=f"Transferência ID: {transfer.transaction_id or transfer.uuid}",
                            created_by=transfer.created_by,
                            updated_by=transfer.updated_by
                        )
                    created_expenses += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Despesa criada para transferência "{transfer.description}"'
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
                            category='transfer',
                            account=transfer.destiny_account,
                            received=transfer.transfered,
                            source=f"Transferência de {transfer.origin_account.account_name}",
                            member=transfer.member,
                            related_transfer=transfer,
                            notes=f"Transferência ID: {transfer.transaction_id or transfer.uuid}",
                            created_by=transfer.created_by,
                            updated_by=transfer.updated_by
                        )
                    created_revenues += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Receita criada para transferência "{transfer.description}"'
                        )
                    )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Erro ao processar transferência "{transfer.description}": {e}'
                    )
                )
                errors += 1

        # Resumo final
        self.stdout.write(
            self.style.SUCCESS(
                f'\n{"="*70}'
                f'\nProcessamento concluído!'
                f'\n{"="*70}'
                f'\nTotal de transferências: {total_transfers}'
                f'\nJá processadas: {already_processed}'
                f'\nDespesas criadas: {created_expenses}'
                f'\nReceitas criadas: {created_revenues}'
                f'\nErros: {errors}'
            )
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\n⚠ MODO DRY-RUN: Nenhuma alteração foi feita no banco de dados'
                )
            )
        elif errors == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    '\n✓ Todas as transferências foram processadas com sucesso!'
                    '\n\nExecute "python manage.py update_balances" para atualizar os saldos das contas.'
                )
            )
```

**Quando usar**:
- Após migração de dados legados
- Se transferências antigas não têm despesas/receitas vinculadas
- Como verificação de integridade

### 4. vectorize_existing / index_library

**Arquivos**: `agents/management/commands/vectorize_existing.py`, `agents/management/commands/index_library.py`

**Objetivo**: gerar embeddings (pgvector) para registros já existentes, permitindo busca semântica pelos agentes.

```bash
# Embeddings de AgentEmbedding por domínio (finance, budget, planning, library, all)
python manage.py vectorize_existing --domain=all [--reset] [--batch-size=50] [--user=<username>] [--force]

# Resumos, notas de leitura e destaques da biblioteca (chunks)
python manage.py index_library [--user=<username>] [--force] [--dry-run] [--chunk-size=500]
```

### 5. Demais comandos

| Comando | App | Objetivo | Argumentos |
|---|---|---|---|
| `check_backup_health` | app | Sai com erro se não houver backup bem-sucedido nas últimas N horas | `--max-age-hours` (26), `--backup-dir` |
| `purge_deleted_records` | app | LGPD: hard-delete de registros soft-deleted com mais de N dias | `--days` (90), `--dry-run` |
| `rotate_encryption_key` | app | Re-criptografa campos com a nova `ENCRYPTION_KEY` (transação única) | `--old-key`, `--new-key`, `--dry-run` |
| `vault_recovery` | app | Diagnostica, reseta ou restaura o cofre de senhas de um usuário | `--username`, `--test-password`, `--reset --confirm`, `--restore-snapshot`, `--force-restore` |
| `issue_theme_sync_token` | authentication | Gera/regenera o token de sync de tema (impresso uma vez) | `username` |
| `close_overdue_bills` | credit_cards | Fecha faturas com vencimento passado | `--dry-run` |
| `fix_installments_paid_status` | credit_cards | Corrige status das parcelas pelas faturas pagas e reseta `credit_limit` | `--dry-run` |
| `send_due_notifications` | notifications | Gera e envia notificações de vencimento/atraso | `--dry-run`, `--member-id` |
| `import_exercise_dataset` | personal_planning | Importação única do catálogo de exercícios (mídia no MinIO); idempotente | `--dry-run`, `--limit` |
| `seed_wellness_interventions` | personal_planning | Popula o catálogo de intervenções de bem-estar | — |
| `fix_storage_config_for_local` | storage | Sobrescreve as chaves MinIO do `SystemConfig` com as do ambiente (após restaurar dump de outro ambiente) | `--dry-run` |
| `migrate_media_to_minio` | storage | Migra mídia do filesystem local para MinIO/S3 | `--dry-run` |
| `check_vault_yield_health` | vaults | Sai com erro se `accumulated_yield` divergir de Σ receitas de rendimento | `--tolerance` |
| `generate_vault_contributions` | vaults | Processa contribuições recorrentes agendadas do mês | `--month`, `--dry-run` |
| `reconcile_vault_yield` | vaults | Reconcilia `accumulated_yield` e recalcula o saldo da conta associada | `--vault`, `--dry-run` |

## Criando Novos Comandos

### Passo a Passo

1. **Criar estrutura de diretórios**:
```bash
mkdir -p myapp/management/commands
touch myapp/management/__init__.py
touch myapp/management/commands/__init__.py
```

2. **Criar arquivo do comando**:
```python
# myapp/management/commands/my_command.py
from django.core.management.base import BaseCommand, CommandError

class Command(BaseCommand):
    help = 'Descrição do meu comando'

    def add_arguments(self, parser):
        # Argumentos opcionais
        parser.add_argument(
            '--option',
            type=str,
            default='default_value',
            help='Descrição da opção'
        )

    def handle(self, *args, **options):
        option = options['option']

        # Lógica aqui
        self.stdout.write(self.style.SUCCESS('Comando executado!'))
```

3. **Executar**:
```bash
python manage.py my_command --option=value
```

### Exemplo: Comando de Limpeza de Logs

```python
# app/management/commands/clean_old_logs.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from security.activity_logs.models import ActivityLog


class Command(BaseCommand):
    help = 'Remove logs de atividade antigos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Remover logs mais antigos que N dias (padrão: 90)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Mostra quantos logs seriam removidos sem remover'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']

        # Calcular data limite
        cutoff_date = timezone.now() - timedelta(days=days)

        # Buscar logs antigos
        old_logs = ActivityLog.objects.filter(created_at__lt=cutoff_date)
        count = old_logs.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'MODO DRY-RUN: {count} logs seriam removidos '
                    f'(mais antigos que {cutoff_date.date()})'
                )
            )
        else:
            # Deletar logs
            old_logs.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ {count} logs removidos (mais antigos que {cutoff_date.date()})'
                )
            )
```

**Uso**:
```bash
# Ver quantos logs seriam removidos
python manage.py clean_old_logs --days=90 --dry-run

# Remover logs
python manage.py clean_old_logs --days=90
```

## Argumentos Comuns

### Tipos de Argumentos

```python
def add_arguments(self, parser):
    # String
    parser.add_argument('--name', type=str)

    # Inteiro
    parser.add_argument('--count', type=int, default=10)

    # Float
    parser.add_argument('--ratio', type=float, default=0.5)

    # Boolean (flag)
    parser.add_argument('--verbose', action='store_true')

    # Choices (opções limitadas)
    parser.add_argument(
        '--level',
        type=str,
        choices=['low', 'medium', 'high'],
        default='medium'
    )

    # Argumento posicional (obrigatório)
    parser.add_argument('file_path', type=str)

    # Lista de valores
    parser.add_argument(
        '--ids',
        nargs='+',  # Um ou mais
        type=int,
        help='Lista de IDs'
    )
```

### Uso de Argumentos

```bash
# String
python manage.py cmd --name="João"

# Inteiro
python manage.py cmd --count=50

# Boolean (flag)
python manage.py cmd --verbose

# Choices
python manage.py cmd --level=high

# Posicional
python manage.py cmd /path/to/file

# Lista
python manage.py cmd --ids 1 2 3 4 5
```

## Estilização de Output

```python
# Cores disponíveis
self.stdout.write(self.style.SUCCESS('Sucesso'))  # Verde
self.stdout.write(self.style.WARNING('Aviso'))    # Amarelo
self.stdout.write(self.style.ERROR('Erro'))       # Vermelho
self.stdout.write(self.style.NOTICE('Info'))      # Azul

# Tabelas
self.stdout.write('┌─────────────┬─────────┐')
self.stdout.write('│ Nome        │ Valor   │')
self.stdout.write('├─────────────┼─────────┤')
self.stdout.write('│ Item 1      │ 100.00  │')
self.stdout.write('└─────────────┴─────────┘')

# Progress bars (usando tqdm)
from tqdm import tqdm

for item in tqdm(queryset, desc="Processing"):
    # processar item
    pass
```

## Tratamento de Erros

```python
from django.core.management.base import CommandError

def handle(self, *args, **options):
    try:
        # Lógica do comando
        pass
    except ValueError as e:
        raise CommandError(f'Valor inválido: {e}')
    except Exception as e:
        self.stdout.write(self.style.ERROR(f'Erro inesperado: {e}'))
        raise CommandError('Comando falhou')
```

## Boas Práticas

1. **Sempre adicione `--dry-run`** para comandos que modificam dados
2. **Use `--verbose`** para output detalhado opcional
3. **Mostre progresso** para operações longas
4. **Resumo final** com estatísticas
5. **Validações** antes de executar ações destrutivas
6. **Transactions** para operações atômicas
7. **Logs** para auditoria
8. **Help text** claro e detalhado

## Agendamento de Comandos

### Cron (Linux/Mac)

```bash
# Editar crontab
crontab -e

# Executar todo dia às 2h da manhã
0 2 * * * cd /path/to/project && python manage.py clean_old_logs --days=90

# Executar toda segunda-feira às 3h
0 3 * * 1 cd /path/to/project && python manage.py update_balances
```

### Celery Beat (Recomendado)

```python
# app/celery.py
from celery import Celery
from celery.schedules import crontab

app = Celery('axiom')

app.conf.beat_schedule = {
    'clean-old-logs-daily': {
        'task': 'app.tasks.clean_old_logs',
        'schedule': crontab(hour=2, minute=0),  # 2h da manhã
    },
    'update-balances-weekly': {
        'task': 'app.tasks.update_balances',
        'schedule': crontab(day_of_week=1, hour=3, minute=0),  # Segunda 3h
    },
}
```

## Testando Comandos

```python
# tests/test_commands.py
from django.core.management import call_command
from django.test import TestCase
from io import StringIO

class UpdateBalancesCommandTestCase(TestCase):
    def test_command_output(self):
        """Testa output do comando."""
        out = StringIO()
        call_command('update_balances', stdout=out)
        self.assertIn('Recálculo concluído', out.getvalue())

    def test_command_dry_run(self):
        """Testa que dry-run não altera banco."""
        # Setup inicial
        account = Account.objects.create(account_name="Test", current_balance=100)
        initial_balance = account.current_balance

        # Executar comando em dry-run
        call_command('process_existing_transfers', '--dry-run')

        # Verificar que nada mudou
        account.refresh_from_db()
        self.assertEqual(account.current_balance, initial_balance)
```

## Conclusão

Comandos de management são ferramentas poderosas para:
- Manutenção automatizada
- Operações em massa
- Setup inicial
- Migrações de dados
- Tarefas administrativas

Sempre documente seus comandos e adicione opções `--dry-run` e `--verbose` para maior segurança e transparência.
