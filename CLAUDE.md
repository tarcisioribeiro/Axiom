# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MindLedger is a full-stack personal management system (Django REST Framework + React/TypeScript) for finances, security (password vault), library (book tracking), and personal planning. The UI is in Brazilian Portuguese; API data uses English keys translated via `frontend/src/config/constants.ts`.

## Architecture

### Monorepo Structure
```
MindLedger/
├── api/              # Django backend (port 39100)
├── frontend/         # React frontend (port 39101)
├── docker-compose.yml
└── .env              # Root environment variables
```

### Backend (Django)

**Apps**: accounts, credit_cards, expenses, revenues, loans, transfers, payables, vaults, dashboard, authentication, members, app (core config), security, library, personal_planning, notifications, budgets

**Multi-module apps**: `library` is split into sub-packages: `books`, `authors`, `publishers`, `readings`, `summaries`. `security` is split into: `passwords`, `stored_cards`, `stored_accounts`, `archives`, `activity_logs`. `personal_planning` has a `services/instance_generator.py` that lazily generates task instances from `RoutineTask` templates — it does not modify already-generated instances.

**Base Model**: All models should extend `BaseModel` from `app/models.py`, which provides `uuid` PK, `created_at`/`updated_at`, audit fields (`created_by`, `updated_by`, `deleted_by`, `deleted_at`), and `is_deleted`.

**View Pattern**: Uses DRF generic views (not ViewSets). Base mixins `BaseListCreateView` / `BaseRetrieveUpdateDestroyView` in `app/base_views.py` already include `IsAuthenticated` + `GlobalDefaultPermission`. Each resource has two views:
- `ResourceCreateListView(BaseListCreateView)` — GET list + POST create
- `ResourceRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView)` — GET/PUT/PATCH/DELETE

**Permissions**: All views use `permission_classes = (IsAuthenticated, GlobalDefaultPermission)`. `GlobalDefaultPermission` (`app/permissions.py`) auto-derives Django model permissions from HTTP method (GET→view, POST→add, PUT/PATCH→change, DELETE→delete).

**Soft Delete**: Models use `is_deleted=False` filtering in querysets rather than actual deletion.

**Signals**: accounts, credit_cards, loans, payables, personal_planning, transfers apps use Django signals (registered via `apps.py:ready()`).

**Encryption**: `app/encryption.py:FieldEncryption` (Fernet). Encrypted fields use `_` prefix convention (e.g., `_account_number`, `_card_number`). Decryption cache per-request via `DecryptionCacheMiddleware`. Use `defer('_field')` in list querysets to skip encrypted fields for performance.

**Middleware order** (settings.py): DecryptionCacheMiddleware → SecurityMiddleware → CorsMiddleware → SessionMiddleware → CommonMiddleware → CsrfViewMiddleware → AuthenticationMiddleware → JWTCookieMiddleware → AuditLoggingMiddleware → MessageMiddleware → XFrameOptionsMiddleware → SecurityHeadersMiddleware

**Authentication**: JWT tokens stored in HttpOnly cookies. `authentication/middleware.py:JWTCookieMiddleware` extracts cookies → Authorization header. Access token: 15min, refresh: 1h.

**API Versioning**: All endpoints under `/api/v1/`. API docs at `/api/docs/` (Swagger) and `/api/redoc/`.

**Pagination**: `PageNumberPagination` with `PAGE_SIZE=50`.

**Filtering**: `django-filters` (`DjangoFilterBackend`) is the default filter backend.

**Timezone**: `America/Sao_Paulo`. Always use `django.utils.timezone.now()`, never `datetime.now()`.

**Database**: PostgreSQL 16. Tests use SQLite in-memory automatically (`'test' in sys.argv`).

**Caching**: Redis (django-redis) with key prefix `mindledger`. Specific TTLs defined in settings: `CACHE_TTL_DASHBOARD_STATS` (60s), `CACHE_TTL_ACCOUNT_BALANCES` (30s), `CACHE_TTL_CATEGORY_BREAKDOWN` (300s), `CACHE_TTL_BALANCE_FORECAST` (120s).

### Frontend (React + TypeScript)

**Stack**: React 19, Vite 7, TypeScript 5.9, TailwindCSS 3, Radix UI, Zustand, React Router v7, Recharts, Framer Motion, React Hook Form + Zod

**Service Pattern**: Services extend `BaseService<T, CreateData, UpdateData>` from `services/base-service.ts` for CRUD. Methods: `getAll()`, `getAllPaginated()`, `getById()`, `create()`, `update()`, `patch()`, `delete()`. All return `PaginatedResponse<T>` (with `results` and `count`) for list endpoints. Endpoints defined in `config/api-config.ts:API_CONFIG.ENDPOINTS`. All services are class singletons exported as `const fooService = new FooService()`.

**API Client**: `services/api-client.ts` wraps axios. Cookies sent automatically (`withCredentials: true`). Base URL resolved dynamically at runtime from `window.location.hostname` (matching browser host to avoid SameSite cookie issues), falling back to `VITE_API_BASE_URL`. Auto-refresh on 401 except auth endpoints. Custom error classes: `AuthenticationError`, `ValidationError` (exposes `.errors` field map), `NotFoundError`, `PermissionError`.

**State**: Zustand for auth (`stores/auth-store.ts` — manages user, permissions, `hasPermission()`, `hasSystemAccess()`) and toast notifications (via `hooks/use-toast.ts`). React Hook Form + Zod for forms. Local state for component data.

**Translation System**: `config/translations.ts` contains `TRANSLATIONS` (EN→PT-BR) and `REVERSE_TRANSLATIONS` for all domain terms. `autoTranslate()` searches all sections. `config/constants.ts` re-exports from `api-config.ts`, `translations.ts`, `categories.ts`, and `commands.ts` — import from `@/config/constants` as before.

**CRUD Hook**: `hooks/use-crud-page.ts` encapsulates load/create/update/delete with loading states and toast notifications.

**Other Key Hooks**: `use-theme.ts` (dark/light Dracula/Alucard themes with localStorage), `use-toast.ts` (max 3 visible, 5s auto-dismiss), `use-alert-dialog.tsx` (confirmation dialogs), `use-vault-status.ts` (vault lock/unlock state), `use-sidebar.ts`, `use-breadcrumb.ts`, `use-command-palette.ts`.

**Utility Library** (`lib/`): `utils.ts` — `cn()` (Tailwind merge), date/timezone helpers; `formatters.ts` — `formatCurrency()` (BRL), `formatDate()`, percentage/number formatting; `validations.ts` — shared Zod schemas; `logger.ts` — dev-only console logger (silent in production); `chart-colors.ts` / `chart-formatters.ts` — theme-aware chart utilities.

**Routing**: `ProtectedRoute` HOC wraps authenticated pages. All protected pages are lazy-loaded (`React.lazy()` + `Suspense`). Public routes (/login, /register) redirect to home if already authenticated.

**Common Components** (`components/common/`): Always use these before creating new ones — `PageContainer` (root page wrapper), `EmptyState` (empty/no-results UI), `LoadingState` (skeleton loader), `DataTable` (paginated table with `emptyState` prop), `PageHeader`, `SearchInput`, `StatCard`.

**Import alias**: `@/` → `frontend/src/`

**Pre-commit**: Two hook systems: `pre-commit` (Python) runs black/isort/flake8/mypy on backend staged files; `husky` + `lint-staged` runs ESLint + Prettier on frontend staged files. Commitlint enforces conventional commits at the commit-msg stage (see [Commit Convention](#commit-convention)).

## Development Commands

### Docker Workflow (primary)
```bash
docker-compose up -d                                    # Start all services
docker-compose logs -f api                              # View API logs
docker-compose exec api python manage.py <command>      # Run management commands
docker-compose up -d --build                            # Rebuild after dependency changes
```

> **IMPORTANT**: The API container does NOT mount source code as a volume — code is baked in at build time. After editing host files, either copy them into the container (`docker cp <file> mindledger-api:/app/<path>`) for a quick test, or rebuild with `docker-compose up -d --build` to make changes permanent.

### Backend
```bash
# Testing (tests live in api/tests/) — pytest is a dev dep; install in container first if missing:
# docker exec mindledger-api pip install --user pytest pytest-django pytest-cov
docker-compose exec api python -m pytest tests/                               # All tests (SQLite in-memory)
docker-compose exec api python -m pytest tests/test_views.py                  # Single file
docker-compose exec api python -m pytest tests/test_views.py -k test_name     # Single test
docker-compose exec api python -m pytest tests/ --cov                         # With coverage

# Code quality (uses root .venv)
source .venv/bin/activate && cd api && black . && isort . && flake8 .   # Format + lint

# Migrations
# IMPORTANT: always run makemigrations locally and commit the generated files
# before pushing. The container entrypoint runs --check --dry-run and will
# refuse to start if there are uncommitted schema changes.
docker-compose exec api python manage.py makemigrations
docker-compose exec api python manage.py migrate

# Custom management commands
docker-compose exec api python manage.py update_balances             # Recalculate account balances from transactions
docker-compose exec api python manage.py setup_permissions           # Create Members group with full CRUD on all user-facing apps
docker-compose exec api python manage.py fix_installments_paid_status
docker-compose exec api python manage.py close_overdue_bills         # Mark overdue credit card bills
docker-compose exec api python manage.py process_existing_transfers
docker-compose exec api python manage.py purge_deleted_records       # Hard-delete soft-deleted records >90 days (LGPD compliance)
docker-compose exec api python manage.py vault_recovery              # Vault diagnostics, snapshot, and restore
docker-compose exec api python manage.py migrate_media_to_minio      # Move local media files to MinIO (supports --dry-run)
```

### Frontend
```bash
cd frontend
npm run dev              # Dev server
npm run build            # Production build (TypeScript + Vite)
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run typecheck        # TypeScript type check only (no build)

# Testing (run on host machine — frontend container is nginx-only)
npm run test -- --run                  # All tests (single run)
npm run test:coverage                  # With coverage report
```

**Testing stack**: Vitest 4 + @testing-library/react v16 + happy-dom. Config in `vitest.config.ts`. Setup file: `src/test/setup.ts`. `globals: false` — test files must explicitly import `{ describe, it, expect, vi }` from `'vitest'`. Pre-push hook runs `npm run test:coverage` automatically.

### CI/CD Validation (run before every push)

A `ci-check.sh` script at the repo root simulates the full GitLab pipeline locally. **Run this after any change.**

```bash
# Setup (one-time): create root .venv with dev dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r api/requirements-dev.txt pip-audit

# Run full pipeline simulation (lint → typecheck → test → secret-detection)
source .venv/bin/activate && ./ci-check.sh

# Scope options
./ci-check.sh --backend-only
./ci-check.sh --frontend-only
```

The script requires:
- Docker Compose running with the `api` service up
- Node.js 20+ on the host with `frontend/node_modules` present
- `.venv` at the repo root (auto-created if missing)

Stages covered: `lint:backend` (black/isort/flake8), `lint:migrations`, `lint:bandit`, `lint:pip-audit`, `lint:frontend` (eslint/prettier), `lint:npm-audit`, `typecheck:backend` (mypy via Docker), `typecheck:frontend` (tsc), `test:backend` (pytest via Docker), `test:frontend` (vitest).

After any change, also verify the Docker build passes:
```bash
docker compose up --build -d
```

### Local Development (without Docker)
```bash
# Backend — uses the root .venv (same as ci-check.sh)
source .venv/bin/activate
cd api && python manage.py migrate && python manage.py runserver 0.0.0.0:39100

# Frontend
cd frontend && npm install && npm run dev
```

### Git Hooks (one-time setup, run from repo root)
```bash
# Requires .venv active or pre-commit installed globally
pre-commit install                        # pre-commit hook (black/isort/flake8/mypy)
pre-commit install --hook-type commit-msg # commitlint hook
```

### Database
```bash
docker-compose exec db pg_dump -U $DB_USER mindledger_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql
docker-compose exec -T db psql -U $DB_USER mindledger_db < backups/your_backup.sql
docker-compose exec db psql -U $DB_USER -d mindledger_db    # PostgreSQL shell
```

## Design Token System

Typography, spacing, and weight values are managed through CSS variables defined in `frontend/src/index.css` and mapped into Tailwind via `frontend/tailwind.config.js`. This allows global visual changes by editing a single variable.

### Font Size Scale (`--text-*`)
| CSS Variable     | Value       | Tailwind utility |
|-----------------|-------------|-----------------|
| `--text-xs`     | `0.75rem`   | `text-xs`       |
| `--text-sm`     | `0.875rem`  | `text-sm`       |
| `--text-base`   | `1rem`      | `text-base`     |
| `--text-lg`     | `1.125rem`  | `text-lg`       |
| `--text-xl`     | `1.25rem`   | `text-xl`       |
| `--text-2xl`    | `1.5rem`    | `text-2xl`      |

Each `fontSize` entry includes a companion `lineHeight` via `--leading-{size}`.

### Font Weight Scale (`--font-*`)
| CSS Variable       | Value | Tailwind utility   |
|-------------------|-------|--------------------|
| `--font-normal`   | `400` | `font-normal`      |
| `--font-medium`   | `500` | `font-medium`      |
| `--font-semibold` | `600` | `font-semibold`    |
| `--font-bold`     | `700` | `font-bold`        |

### Semantic Spacing (`--spacing-*`)
| CSS Variable      | Value      | Tailwind utilities              |
|------------------|------------|---------------------------------|
| `--spacing-xs`   | `0.25rem`  | `p-xs`, `m-xs`, `gap-xs`, …    |
| `--spacing-sm`   | `0.5rem`   | `p-sm`, `m-sm`, `gap-sm`, …    |
| `--spacing-md`   | `1rem`     | `p-md`, `m-md`, `gap-md`, …    |
| `--spacing-lg`   | `1.5rem`   | `p-lg`, `m-lg`, `gap-lg`, …    |
| `--spacing-xl`   | `2rem`     | `p-xl`, `m-xl`, `gap-xl`, …    |

**Rule**: Prefer semantic spacing tokens (`p-md`, `gap-lg`) over numeric Tailwind defaults (`p-4`, `gap-6`) for layout and component padding. Numeric values are still acceptable for small adjustments (borders, icon sizes, etc.).

## Key Patterns and Conventions

### Adding a New Backend Resource
1. Create `models.py` extending `BaseModel` from `app/models.py` (provides uuid PK, timestamps, audit fields, `is_deleted`)
2. Create `serializers.py` using `ModelSerializer`; encrypted fields should be `write_only=True`
3. Create `views.py` extending `BaseListCreateView` / `BaseRetrieveUpdateDestroyView` from `app/base_views.py` (permissions already included)
4. Create `urls.py` under `api/v1/` prefix
5. Register in `app/urls.py` and `INSTALLED_APPS` in `app/settings.py`
6. For encrypted fields: use `FieldEncryption.encrypt_data()` in `save()` and property for decryption

### Adding a New Frontend Service
1. Define types in `types/index.ts` or the service file
2. Extend `BaseService<T, CreateData>` from `services/base-service.ts`
3. Add endpoint to `config/api-config.ts:API_CONFIG.ENDPOINTS`
4. Export singleton instance
5. Add translations to `TRANSLATIONS` in `config/translations.ts`

### Encrypted Fields Pattern
```python
from app.encryption import FieldEncryption

# Model: store in _field_name, expose via property
self._account_number = FieldEncryption.encrypt_data(value)  # in save/setter
return FieldEncryption.decrypt_data(self._account_number)   # in property

# View: defer encrypted fields in list queries
def get_queryset(self):
    return Model.objects.filter(is_deleted=False).defer('_encrypted_field')
```

### Backend Testing Patterns

Tests live in `api/tests/`. All test classes extend `BaseAPITestCase(APITestCase)` which creates a superuser and JWT-authenticated client in `setUp()`.

```python
class BaseAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(...)
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
```

Key testing conventions:
- **List responses are paginated**: always use `response.data["results"]` (list) and `response.data["count"]` (total)
- **Permissions**: use `is_superuser=True` to bypass `GlobalDefaultPermission`, or explicitly assign model permissions for non-superuser tests
- **Encrypted field models** (CreditCard, Transfer, Loan): set all required fields before calling `save()` since `full_clean()` runs in `save()`
- **`/api/v1/user/permissions/` endpoint** blocks superusers — tests for it need a non-superuser

## Environment Variables (Critical)

- `SECRET_KEY`: Django secret key
- `ENCRYPTION_KEY`: Fernet key (44 chars base64) — **NEVER change after encrypting data**
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`: PostgreSQL credentials
- `VITE_API_BASE_URL`: Backend URL (default: `http://localhost:39100`)
- `DB_HOST`: `db` for Docker, `localhost` for local

## Accessing the Application

- **Frontend**: http://localhost:39101
- **Backend API**: http://localhost:39100
- **Swagger Docs**: http://localhost:39100/api/docs/
- **ReDoc**: http://localhost:39100/api/redoc/
- **Django Admin**: http://localhost:39100/admin
- **Database**: localhost:39102 (PostgreSQL)
- **Redis**: localhost:39103
- **MinIO API**: localhost:39105
- **MinIO Console**: localhost:39106

## Commit Convention

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via [commitlint](https://commitlint.js.org/).

**Format**: `<type>(<optional scope>): <short description>`

**Allowed types**:
| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance (deps, config, tooling) |
| `refactor` | Code restructuring with no feature or bug-fix change |
| `docs` | Documentation only |
| `test` | Test additions or corrections |
| `ci` | CI/CD configuration |
| `perf` | Performance improvement |
| `revert` | Revert a previous commit |
| `style` | Code style / formatting (no logic change) |

**Examples**:
```
feat(auth): add JWT refresh token support
fix(dashboard): correct balance calculation for credit cards
chore(deps): update React to v19
docs: add commit convention to CLAUDE.md
test(expenses): add missing edge-case coverage
```

**Setup** (first time): Run the following to activate the commit-msg hook via `pre-commit`:
```bash
pre-commit install --hook-type commit-msg
```

Config is at `commitlint.config.js` (project root). Packages are in `frontend/devDependencies`.

## Dependency Management

All dependencies are pinned to **exact versions** (no `^`, `~`, or `>=` ranges) to prevent unexpected breaking changes and supply-chain attacks via minor/patch updates.

### Files
| File | Purpose |
|------|---------|
| `api/requirements.txt` | Production Python deps — pinned to exact versions |
| `api/requirements-dev.txt` | Dev/test Python deps — also pinned exactly |
| `frontend/package.json` | npm deps — exact versions, enforced by `package-lock.json` |

### Updating dependencies
1. Create a dedicated PR for dependency updates (do not bundle with feature work).
2. Review the changelog/release notes for each package being upgraded.
3. **Backend**: run `pip install -r requirements.txt` in a clean virtualenv, verify tests pass (`docker compose exec api python -m pytest tests/`), then update the pin in the file.
4. **Frontend**: run `npm install <pkg>@<version>` to update `package-lock.json` as well, verify tests pass (`npm run test -- --run`), then commit both files.
5. Use commit type `chore(deps):` per the commit convention.

### Automated updates (Dependabot)
`.github/dependabot.yml` is configured to open monthly PRs for pip, npm, and GitHub Actions dependencies. Each PR must pass CI and receive a manual changelog review before merging.

### Monthly maintenance checklist
When processing Dependabot PRs or doing routine maintenance, also run:
```bash
pre-commit autoupdate   # bump hook revs in .pre-commit-config.yaml
```
Commit the result with `chore(ci): pre-commit autoupdate` and verify all hooks still pass before merging.

## Tool Configuration

Backend tools configured in `api/pyproject.toml`: Black (line-length 88, excludes migrations), isort (black profile), pytest (DJANGO_SETTINGS_MODULE=app.settings), coverage, mypy, flake8.

Frontend: ESLint flat config (`eslint.config.js`), Prettier (`.prettierrc` with tailwindcss plugin).

## Development Checklist

After any change:
1. Run `source .venv/bin/activate && ./ci-check.sh` (see [CI/CD Validation](#cicd-validation-run-before-every-push))
2. Verify the Docker build still passes: `docker compose up --build -d`
