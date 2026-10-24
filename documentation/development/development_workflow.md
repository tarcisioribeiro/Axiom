# Workflow de Desenvolvimento

Este guia detalha os comandos e práticas do dia a dia no desenvolvimento do Axiom.

> Todos os comandos abaixo assumem a raiz do monorepo como diretório de trabalho e usam
> `docker compose` (plugin v2), não o binário legado `docker-compose`.

```bash
DC="docker compose -f infra/docker/docker-compose.yml --project-directory ."
```

## Índice

- [Comandos Diários](#comandos-diários)
- [Hot Reload e Desenvolvimento Iterativo](#hot-reload-e-desenvolvimento-iterativo)
- [Debugging e Logs](#debugging-e-logs)
- [Testes Automatizados](#testes-automatizados)
- [Operações de Banco de Dados](#operações-de-banco-de-dados)
- [Comandos Personalizados do Django](#comandos-personalizados-do-django)
- [Qualidade de Código](#qualidade-de-código)
- [Gerenciamento de Dependências](#gerenciamento-de-dependências)

## Comandos Diários

### Iniciando o Ambiente

```bash
$DC up -d

# Verificar status dos containers
$DC ps

# Aguardar todos os serviços ficarem healthy
$DC logs -f | grep healthy
```

Serviços do compose: `db` (PostgreSQL + pgvector), `redis`, `minio` + `minio-init`,
`api`, `worker` (Celery worker, container `axiom-worker`), `queue` (Celery beat,
container `axiom-queue`), `frontend`, `db-backup`, `ollama` + `ollama-init`.

### Parando o Ambiente

```bash
# Parar todos os containers (mantém volumes)
$DC down

# Parar e remover volumes (⚠️ apaga dados!)
$DC down -v

# Parar apenas um serviço
$DC stop api
```

### Reiniciando Serviços

```bash
# Reiniciar todos os serviços
$DC restart

# Reiniciar apenas o backend
$DC restart api

# Rebuild completo (comando oficial do projeto — ver CLAUDE.md)
docker compose -f infra/docker/docker-compose.yml --project-directory . up --build -d && docker system prune -af
```

### Acessando Shells

```bash
# Shell Bash do container API
$DC exec api bash

# Shell Python (Django)
$DC exec api python manage.py shell

# Shell do PostgreSQL
$DC exec db psql -U $DB_USER -d axiom_db

# Shell do Redis
$DC exec redis redis-cli
```

### Comandos Rápidos

```bash
# Ver logs em tempo real
$DC logs -f

# Ver logs de um serviço específico
$DC logs -f api
$DC logs -f worker
$DC logs -f queue
$DC logs -f frontend
$DC logs -f db

# Ver apenas últimas N linhas
$DC logs --tail=50 api

# Verificar uso de recursos
docker stats axiom-api axiom-db axiom-cache axiom-worker axiom-queue
```

## Hot Reload e Desenvolvimento Iterativo

**O container `api` roda a imagem de produção e não monta o código-fonte** (ver
CLAUDE.md, seção Docker) — não há hot reload dentro do Docker para o backend. Para
iterar rapidamente em um arquivo sem rebuild completo:

```bash
docker cp apps/api/<app>/<arquivo>.py axiom-api:/app/<app>/<arquivo>.py
$DC restart api
```

Para hot reload real do backend, rode o Django localmente (fora do Docker):

```bash
source .venv/bin/activate
cd apps/api && python manage.py runserver 0.0.0.0:39100
```

### Frontend (React + Vite)

Em desenvolvimento local (fora do Docker), o Vite oferece Hot Module Replacement
(HMR) automático:

```bash
cd apps/web
npm install
npm run dev
# ➜  Local:   http://localhost:3000/ (porta fixada em vite.config.ts)
```

O container `frontend` do compose serve o build de produção via nginx (sem HMR) —
useful apenas para validar o build final, não para iterar.

## Debugging e Logs

### Logs do Backend (Django)

```bash
# Logs gerais
$DC logs -f api

# Filtrar por nível de log (LOG_FORMAT=json por padrão — ver docker-compose.yml)
$DC logs api | grep ERROR
$DC logs api | grep WARNING

# Logs dos workers Celery (notificações, rendimentos de cofre, etc.)
$DC logs -f worker
$DC logs -f queue
```

### Debugging com `logger`

```python
import logging

logger = logging.getLogger(__name__)

def minha_funcao():
    logger.debug("Valor da variável: %s", variavel)
    logger.info("Operação concluída com sucesso")
    logger.warning("Atenção: valor incomum")
    logger.error("Erro ao processar", exc_info=True)
```

### Debugging Interativo com `pdb`

```python
import pdb; pdb.set_trace()
# ou
breakpoint()
```

```bash
# Inicie o container em modo interativo para interagir com o pdb
$DC stop api
$DC run --rm --service-ports api
```

### Logs do Frontend (React)

```bash
$DC logs -f frontend
# Console do navegador (F12) para logs do runtime
```

### Monitoramento de Performance

```bash
docker stats axiom-api axiom-db axiom-cache

# Queries lentas no PostgreSQL
$DC exec db psql -U $DB_USER -d axiom_db -c "
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY total_time DESC
  LIMIT 10;
"
```

## Testes Automatizados

### Backend (Django/pytest)

```bash
# Todos os testes
$DC exec api python -m pytest tests/

# Um app/arquivo específico
$DC exec api python -m pytest tests/test_views.py -k nome_do_teste

# Com cobertura
$DC exec api python -m pytest tests/ --cov
```

`DJANGO_SETTINGS_MODULE=app.settings`, SQLite em memória nos testes,
`CELERY_TASK_ALWAYS_EAGER=True` (ver `apps/api/pyproject.toml`).

### Frontend (Vitest)

```bash
cd apps/web
npm run test -- --run                  # todos os testes
npm run test -- --run -t "test name"   # um teste específico
npm run test:coverage
```

Stack: Vitest 4 + `@testing-library/react` v16 + happy-dom, `globals: false`
(importe `describe`/`it`/`expect`/`vi` explicitamente). O hook de pre-push roda
`test:coverage` automaticamente.

### Escrevendo Testes

**Backend — teste de API (padrão real do projeto):**

```python
class BaseAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(...)
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
```

- Respostas de listagem: `response.data["results"]` / `response.data["count"]`
- `is_superuser=True` contorna `GlobalDefaultPermission`
- `/api/v1/user/permissions/` bloqueia superusers — para testar permissões use um
  usuário comum

**Frontend — teste de componente:**

```tsx
// Envolva com QueryClientProvider; resete entre testes:
queryClient.clear();  // beforeEach
queryClient.setDefaultOptions({ queries: { retry: false } });
```

## Operações de Banco de Dados

### Migrations

```bash
# Criar migrations após mudanças em models.py (sempre localmente, commitar antes do push)
$DC exec api python manage.py makemigrations

# Aplicar migrations
$DC exec api python manage.py migrate

# Ver status das migrations
$DC exec api python manage.py showmigrations

# Ver SQL que será executado (sem executar)
$DC exec api python manage.py sqlmigrate accounts 0001

# Reverter migrations (⚠️ cuidado!)
$DC exec api python manage.py migrate accounts 0001
```

### Backup e Restore

```bash
# Backup manual (pg_dump cru — para o backup diário automatizado criptografado, ver
# documentation/observability/backup-strategy.md)
$DC exec db pg_dump -U $DB_USER axiom_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
$DC exec -T db psql -U $DB_USER axiom_db < backups/your_backup.sql
```

### Queries Diretas

```bash
$DC exec db psql -U $DB_USER -d axiom_db

\dt                           # Listar tabelas
\d accounts_account           # Descrever tabela
\dx                           # Listar extensões (pgvector)

SELECT * FROM accounts_account LIMIT 10;
SELECT COUNT(*) FROM expenses_expense;
```

## Comandos Personalizados do Django

O Axiom possui diversos comandos personalizados em `apps/api/*/management/commands/`.
Os mais usados no dia a dia:

```bash
$DC exec api python manage.py update_balances          # recalcula saldos de contas
$DC exec api python manage.py setup_permissions         # configura permissões de grupos
$DC exec api python manage.py close_overdue_bills       # fecha faturas/contas vencidas
$DC exec api python manage.py purge_deleted_records      # LGPD: hard-delete de soft-deleted > 90 dias
$DC exec api python manage.py send_due_notifications     # dispara notificações de vencimento
$DC exec api python manage.py vault_recovery
$DC exec api python manage.py rotate_encryption_key      # --old-key X --new-key Y --dry-run
$DC exec api python manage.py check_backup_health
$DC exec api python manage.py reconcile_vault_yield
$DC exec api python manage.py import_exercise_dataset    # one-time por ambiente
```

Veja a lista completa em cada app (`management/commands/`) — inclui também
`check_vault_yield_health`, `generate_vault_contributions`, `index_library`,
`issue_theme_sync_token`, `migrate_media_to_minio`, `seed_wellness_interventions`,
`vectorize_existing`, entre outros.

**Criar seu próprio comando:**

```python
# <app>/management/commands/meu_comando.py
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Descrição do meu comando'

    def add_arguments(self, parser):
        parser.add_argument('--param', type=str, help='Parâmetro opcional')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Comando executado!'))
```

```bash
$DC exec api python manage.py meu_comando --param=valor
```

## Qualidade de Código

### Backend (Python)

```bash
source .venv/bin/activate
cd apps/api && black . && isort . && flake8 .
```

**Configuração real** (`apps/api/pyproject.toml` e `.flake8`):

- Black: `line-length = 79`, `target-version = ['py312']`, exclui migrations.
- isort: `profile = "black"`, `line_length = 79`.
- flake8: `max-line-length = 79`, `extend-ignore = E203, W503`, regra customizada
  `DRF001` proíbe `fields = "__all__"` em serializers
  (`apps/api/flake8_no_serializer_all.py`).

### Frontend (TypeScript)

```bash
cd apps/web
npm run lint          # ESLint
npm run lint:fix
npm run typecheck      # tsc -p tsconfig.app.json --noEmit
npm run format         # Prettier
npm run format:check
```

Config real: `apps/web/eslint.config.js` e `.prettierrc` (com plugin `tailwindcss`).

### Git Hooks

```bash
pre-commit install
pre-commit install --hook-type commit-msg  # obrigatório — validado em CI
```

`pre-commit` roda black/isort/flake8/mypy no backend; `husky` + `lint-staged` roda
ESLint + Prettier no frontend a cada commit. O hook de pre-push do frontend roda
`npm run test:coverage`.

### CI/CD local

```bash
source .venv/bin/activate && ./ci-check.sh
```

Simula interativamente os jobs do stage `lint` do `.gitlab-ci.yml` (black/isort/
flake8, migrations, bandit, pip-audit, eslint/prettier, npm-audit, kubeconform,
commitlint, gitleaks) — os únicos jobs executáveis localmente. Os pipelines do
GitLab só disparam em Merge Request ou push para `develop`/`main`; os jobs de
build/scan/deploy/smoke/backup/cleanup exigem cluster e credenciais reais e por
isso não são simulados.

## Gerenciamento de Dependências

Todas as dependências são fixadas em versão exata (sem `^`/`~`).

### Backend (Python)

```bash
# Adicionar ao arquivo correto (requirements.txt, requirements-dev.txt ou
# requirements-lint.txt) com a versão exata, depois rebuild:
$DC up -d --build api
```

### Frontend (npm)

```bash
cd apps/web
npm install nome-do-pacote --save-exact
npm outdated
```

Dependabot abre PRs mensais; atualizações de dependência vão em PR dedicada com
commit type `chore(deps):`.

## Fluxo de Trabalho Típico

### Adicionando uma Nova Feature

1. **Criar branch**
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. **Desenvolver** (ver seção de hot reload acima — backend local para iterar rápido)

3. **Testar**
   ```bash
   $DC exec api python -m pytest tests/
   cd apps/web && npm run lint && npm run test -- --run
   ```

4. **Code quality**
   ```bash
   cd apps/api && black . && isort . && flake8 .
   ```

5. **Commit** (formato `<tipo>(<escopo opcional>): <descrição>` — ver
   [Convenção de Commits](./commit_convention.md))
   ```bash
   git commit -m "feat: adiciona nova feature X"
   ```

6. **Push e Merge Request**
   ```bash
   git push origin feature/nome-da-feature
   # Abrir Merge Request no GitLab (develop como branch de destino)
   ```

## Próximos Passos

- Leia o [Guia de Contribuição](./contribution_guide.md) para padrões de código
- Consulte [Troubleshooting](./troubleshooting.md) para resolver problemas
- Veja [Configuração](./configuration.md) para ajustes avançados
