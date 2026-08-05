# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monorepo: Django REST Framework backend (port 39100) + React/TypeScript frontend (port 39101). The UI is in Brazilian Portuguese; API data uses English keys translated via `apps/frontend/src/config/constants.ts`.

## Architecture

### Monorepo Structure
```
Axiom/
├── apps/
│   ├── api/          # Django backend (port 39100)
│   ├── frontend/     # React frontend (port 39101)
│   └── mobile/       # Flutter mobile app (scaffolding — see documentation/mobile/README.md)
├── infra/
│   ├── k8s/          # Kubernetes manifests (kustomize base + overlays)
│   ├── docker/       # docker-compose.yml + auxiliary Dockerfiles (e.g. db-backup)
│   └── scripts/      # Backup/restore and migration helper scripts
├── documentation/    # Project documentation
└── .env              # Root environment variables
```

### Backend (Django)

**Apps**: accounts, credit_cards, expenses, revenues, loans, transfers, payables, receivables, vaults, dashboard, authentication, members, app (core config), security, library, personal_planning, notifications, budgets, bank_reconciliation, monthly_planning, agents, exchange_rates, webhooks, admin_panel

**Multi-module apps**: `library` is split into sub-packages: `books`, `authors`, `publishers`, `readings`, `summaries`. `security` is split into: `passwords`, `stored_cards`, `stored_accounts`, `archives`, `activity_logs`. `personal_planning` has a `services/instance_generator.py` that lazily generates task instances from `RoutineTask` templates — it does not modify already-generated instances. `personal_planning` also includes workout tracking (exercises, workout plans, days, sessions, sets) and nutrition tracking (foods, meal types, menu options, meal logs) under the same app.

**Receivables** (`apps/api/receivables/`): Mirror of `payables` for the revenue side — tracks money owed to the user (fees, reimbursements, services rendered). Creating a `Receivable` does NOT auto-create a revenue record; only recording receipt (`received_value`) triggers that. Statuses: `active`, `received`, `overdue`, `cancelled`.

**Exchange Rates** (`apps/api/exchange_rates/`): Stores daily BRL exchange rates fetched from BCB PTAX API (official Brazilian Central Bank). Use `ExchangeRate.convert(amount, from_currency, to_currency)` as a utility anywhere in the codebase. Cross-rate conversions go through BRL. Rates are refreshed via a Celery periodic task.

**Webhooks** (`apps/api/webhooks/`): Outbound webhook system. Users configure `Webhook` endpoints subscribed to specific events. Call `dispatch_event(event, payload, user=user)` from `webhooks.dispatch` to trigger deliveries. Payloads are signed with HMAC-SHA256 in the `X-Axiom-Signature` header. Deliveries are queued via Celery with retry logic. Event types include: `expense.created/updated/deleted`, `revenue.*`, `transfer.created`, `loan.*`, `budget.exceeded`, `vault.deposit/withdrawal`, `health_score.updated`.

**Admin Panel** (`apps/api/admin_panel/`): `SystemConfig` model stores encrypted system configuration (LLM keys, email, MinIO, backup settings) editable via Django Admin. Values marked `is_secret=True` are stored encrypted with `ENCRYPTION_KEY`. Access via Django Admin at `/admin/`, not the frontend `/admin/` route.

**Monthly Planning** (`apps/api/monthly_planning/`): `MonthlyPlan` model holds per-user, per-month/year overrides on top of the base financial data — `extra_revenues`/`extra_expenses` (JSON), `budget_overrides`, `fixed_revenue_overrides`, `fixed_expense_overrides`, `bill_overrides`, and `budget_disabled_categories`, plus an `applied_at` timestamp. Endpoints: `monthly-plan/summary/`, `monthly-plan/<pk>/`, `monthly-plan/<pk>/apply/`.

**Base Model**: All models should extend `BaseModel` from `app/models.py`, which provides `uuid` PK, `created_at`/`updated_at`, audit fields (`created_by`, `updated_by`, `deleted_by`, `deleted_at`), and `is_deleted`. The same file also defines shared choice tuples reused across apps: `PAYMENT_FREQUENCY_CHOICES`, `PAYMENT_METHOD_CHOICES`, `LOAN_STATUS_CHOICES`, `BILL_STATUS_CHOICES`.

**View Pattern**: Uses DRF generic views (not ViewSets). Base mixins `BaseListCreateView` / `BaseRetrieveUpdateDestroyView` in `app/base_views.py` already include `IsAuthenticated` + `GlobalDefaultPermission`. Each resource has two views:
- `ResourceCreateListView(BaseListCreateView)` — GET list + POST create
- `ResourceRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView)` — GET/PUT/PATCH/DELETE

**Permissions**: All views use `permission_classes = (IsAuthenticated, GlobalDefaultPermission)`. `GlobalDefaultPermission` (`app/permissions.py`) auto-derives Django model permissions from HTTP method (GET→view, POST→add, PUT/PATCH→change, DELETE→delete).

**Soft Delete**: Models use `is_deleted=False` filtering in querysets rather than actual deletion.

**Signals**: accounts, credit_cards, loans, payables, receivables, personal_planning, transfers apps use Django signals (registered via `apps.py:ready()`).

**Encryption**: `app/encryption.py:FieldEncryption` (Fernet). Encrypted fields use `_` prefix convention (e.g., `_account_number`, `_card_number`). Decryption cache per-request via `DecryptionCacheMiddleware`. Use `defer('_field')` in list querysets to skip encrypted fields for performance.

**Middleware order** (settings.py): PrometheusBeforeMiddleware → DecryptionCacheMiddleware → SecurityMiddleware → CorsMiddleware → SessionMiddleware → CommonMiddleware → CsrfViewMiddleware → AuthenticationMiddleware → JWTCookieMiddleware → AuditLoggingMiddleware → MessageMiddleware → XFrameOptionsMiddleware → SecurityHeadersMiddleware → PrometheusAfterMiddleware

**Authentication**: JWT tokens stored in HttpOnly cookies. `authentication/middleware.py:JWTCookieMiddleware` extracts cookies → Authorization header. Access token: 15min, refresh: 1h. **2FA**: TOTP-based via `pyotp`. `TOTPDevice` model (one per user) stores the HMAC secret; backup codes are stored as SHA-256 hashes (plaintext never saved). Setup flow: `setup/` → `activate/` → `verify/` on subsequent logins. Email verification and password reset also handled in `authentication/` via token-based flows.

**Async Tasks** (`Celery`): Worker container is `axiom-worker` (`celery -A app worker --concurrency=2`). Beat scheduler is `axiom-queue` using `DatabaseScheduler` (schedules stored in DB via `django_celery_beat`). In tests, `CELERY_TASK_ALWAYS_EAGER=True` so tasks run synchronously without Redis.

**API Versioning**: All endpoints under `/api/v1/`. API docs at `/api/docs/` (Swagger) and `/api/redoc/`.

**Pagination**: `PageNumberPagination` with `PAGE_SIZE=50`.

**Filtering**: `django-filters` (`DjangoFilterBackend`) is the default filter backend.

**Timezone**: `America/Sao_Paulo`. Always use `django.utils.timezone.now()`, never `datetime.now()`.

**Database**: PostgreSQL 16. Tests use SQLite in-memory automatically (`'test' in sys.argv`).

**Caching**: Redis (django-redis) with key prefix `axiom`. Specific TTLs defined in settings: `CACHE_TTL_DASHBOARD_STATS` (60s), `CACHE_TTL_ACCOUNT_BALANCES` (30s), `CACHE_TTL_CATEGORY_BREAKDOWN` (300s), `CACHE_TTL_BALANCE_FORECAST` (120s). `DATABASES`/`CACHES` use the `django_prometheus`-instrumented backend/engine (drop-in wrappers) so DB query and cache hit/miss metrics are exported at `/metrics`.

**Backups & Observability**: Daily encrypted `pg_dump` → MinIO via the `db-backup` container (Compose) / `axiom-db-backup` CronJob (K8s) — see `documentation/observability/backup-strategy.md` for RPO/RTO, key rotation, and health-check endpoints (`GET /api/v1/health/backup/`, `manage.py check_backup_health`). Prometheus metrics (`/metrics`) require `PROMETHEUS_MULTIPROC_DIR` (set by `apps/api/entrypoint.sh`, default `/tmp/prometheus-multiproc`) to aggregate correctly across Gunicorn's multiple workers — see `documentation/observability/monitoring.md` for the full metrics/dashboards/alerts reference.

**Agents / LLM Module** (`apps/api/agents/`): Django app providing AI-powered financial assistants. Six domain agents (`finance`, `budget`, `forecast`, `insight`, `library`, `planning`) are selected automatically by `core/router.py`. Endpoints are under `/api/v1/agents/` — `ask/` (sync), `stream/` (SSE), `history/`, `sessions/`, `status/`. Core infrastructure in `core/`: `llm_client.py` (Ollama/Groq/Anthropic/OpenAI providers with thread-safe singleton, circuit breaker for Ollama, Redis embedding cache), `memory.py` (conversation persistence in Redis + PostgreSQL), `context_compressor.py`, `summarizer.py`. RAG via pgvector in `tools/rag_tools.py`. Background thread writes persistence after response to reduce latency. `AgentRateThrottle` enforced on all views. Prompt injection patterns (EN + PT-BR) validated server-side. `providers/` (`financial_provider.py`, `personal_provider.py`, `library_provider.py`, `security_provider.py`) is the **only** place in `agents/` allowed to import models from other Django apps — tools, domain agents, and views all consume data through it. See `documentation/architecture/agents-llm-boundary.md` for the full boundary rationale and `documentation/llm/infrastructure.md` for the external Ollama host runbook.

### Frontend (React + TypeScript)

**Stack**: React 19, Vite 7, TypeScript 5.9, TailwindCSS 3, Radix UI, Zustand, React Router v7, Recharts, Framer Motion, React Hook Form + Zod

**Service Pattern**: Services extend `BaseService<T, CreateData, UpdateData>` from `services/base-service.ts` for CRUD. Methods: `getAll()`, `getAllPaginated()`, `getById()`, `create()`, `update()`, `patch()`, `delete()`. All return `PaginatedResponse<T>` (with `results` and `count`) for list endpoints. Endpoints defined in `config/api-config.ts:API_CONFIG.ENDPOINTS`. All services are class singletons exported as `const fooService = new FooService()`.

**API Client**: `services/api-client.ts` wraps axios. Cookies sent automatically (`withCredentials: true`). Base URL resolved dynamically at runtime from `window.location.hostname` (matching browser host to avoid SameSite cookie issues), falling back to `VITE_API_BASE_URL`. Auto-refresh on 401 except auth endpoints. Custom error classes: `AuthenticationError`, `ValidationError` (exposes `.errors` field map), `NotFoundError`, `PermissionError`.

**State**: Zustand stores: `auth-store.ts` (user, permissions, `hasPermission()`, `hasSystemAccess()`), `notifications-store.ts` (notification list/unread count), `command-palette-store.ts` (palette open state). Toast state lives in `hooks/use-toast.ts`. React Hook Form + Zod for forms. Local state for component data.

**Translation System**: Two separate layers:
- `config/translations.ts` — API data translation: `TRANSLATIONS` (EN→PT-BR) and `REVERSE_TRANSLATIONS` for domain enum values (expense categories, status labels, etc.). `autoTranslate()` searches all sections. `translate(section, key)` looks up a key within a specific section. `config/constants.ts` re-exports from `api-config.ts`, `translations.ts`, `categories.ts`, and `commands.ts` — import from `@/config/constants` as before. `lib/helpers.ts` provides `translateCategory(category, 'expense'|'revenue')` as a convenience wrapper around `translate()`, `getAccountBalanceInfo(account)` for balance/limit display data, plus `groupByProperty<T>(array, property)` for grouping arrays. `config/categories.ts` exports `EXPENSE_CATEGORIES_CANONICAL` and `REVENUE_CATEGORIES_CANONICAL` — typed arrays of `{ key, label, emoji }` that mirror backend choices exactly; use these for category dropdowns.
- `i18n/` — UI text localization via react-i18next. Locale files at `i18n/locales/pt-BR.json` (default) and `i18n/locales/en-US.json`. Language persisted in localStorage key `axiom-lang`. Use the `LanguageSelector` component (`components/common/LanguageSelector.tsx`) to switch languages.

**CRUD Hook**: `hooks/use-crud-page.ts` encapsulates load/create/update/delete with loading states and toast notifications.

**Other Key Hooks**: `use-theme.ts` (dark/light Dracula/Alucard themes with localStorage), `use-toast.ts` (max 3 visible, 5s auto-dismiss), `use-alert-dialog.tsx` (confirmation dialogs), `use-vault-status.ts` (vault lock/unlock state), `use-sidebar.ts`, `use-breadcrumb.ts`, `use-command-palette.ts`.

**Utility Library** (`lib/`): `utils.ts` — `cn()` (Tailwind merge), date/timezone helpers; `formatters.ts` — `formatCurrency()` (BRL), `formatDate()`, percentage/number formatting; `validations.ts` — shared Zod schemas; `logger.ts` — dev-only console logger (silent in production); `chart-colors.ts` / `chart-formatters.ts` — theme-aware chart utilities; `animations/` — Framer Motion variants (`cardVariants`, etc.), shared transitions, and animation hooks (`useCounter` for number counter animations) — import from `@/lib/animations`.

**Routing**: `ProtectedRoute` HOC wraps authenticated pages. All protected pages are lazy-loaded (`React.lazy()` + `Suspense`). Public routes (/login, /register) redirect to home if already authenticated.

**Common Components** (`components/common/`): Always use these before creating new ones — `PageContainer` (root page wrapper), `EmptyState` (empty/no-results UI), `LoadingState` (skeleton loader), `DataTable` (paginated table with `emptyState` prop), `PageHeader`, `SearchInput`, `StatCard`, `ExportModal` (date-range export dialog), `StatementExportModal` (statement-specific export), `AnimatedPage` (page-level Framer Motion wrapper), `IconButton` (icon + tooltip button), `ErrorBoundary` (React error boundary), `LanguageSelector`, `ThemeToggle`.

**UI Primitives** (`components/ui/`): Radix UI-based low-level components wrapped with project styling — `button`, `input`, `select`, `checkbox`, `dialog`, `alert-dialog`, `form-field`, `date-picker`, `dropdown-menu`, `popover`, `badge`, `card`, `progress`, `radio-group`, `star-rating`, `textarea`, `toast`, `toaster`, `tooltip`, `skeleton`, `skeleton-variants`, `scroll-area`, `table`, `label`, `visually-hidden`, `file-input`, `icon-picker`, `circular-progress`, `success-animation`. Form-specific: `currency-input` (BRL R$ prefix, `accentColor` variants: default/destructive/success), `form-section` (visual section divider with title + icon for grouping form fields), `status-toggle` (two-option pill toggle for binary status, `activeClass` per option). Use these for building feature components.

**Import alias**: `@/` → `apps/frontend/src/`

**Pre-commit**: Two hook systems: `pre-commit` (Python) runs black/isort/flake8/mypy on backend staged files; `husky` + `lint-staged` runs ESLint + Prettier on frontend staged files. Commitlint enforces conventional commits at the commit-msg stage (see [Commit Convention](#commit-convention)).

### Mobile (Flutter)

**Stack**: Flutter 3.27.x / Dart 3.6.x, Material 3, targeting Android and iOS. See `documentation/architecture/architectural_decisions.md` §16 for why Flutter was chosen over React Native/native.

**State**: `lib/main.dart` (`AxiomMobileApp`) wires up `ThemeController`, `ApiEnvironmentController` and `ApiClient`, then renders `lib/screens/login_screen.dart`. Login is wired to the real backend: `services/auth_service.dart` calls `authentication/token/` (with 2FA follow-up via `users/2fa/verify/`) through `services/api_client.dart`, a `dio` client with a `PersistCookieJar` — same httpOnly-cookie session model as the web app, since the backend never returns JWTs in the response body. `config/api_environment.dart` lets the user switch between the local Docker API and the production VPS (`https://axiom.tjtux.duckdns.org`) at runtime. `theme/` implements all 16 web theme variants (`app_themes.dart`, transcribed from `apps/frontend/src/index.css`) with a picker sheet on the login screen. Remaining future work: consuming the rest of the API beyond auth, and app distribution — see `documentation/mobile/README.md`.

**Dependencies**: Pinned to exact versions in `pubspec.yaml` (no `^` ranges), same policy as the rest of the repo; `pubspec.lock` is committed.

## Development Commands

### Docker Workflow (primary)
All `docker compose` commands are run from the repo root and point at the
compose file in `infra/docker/`, with `--project-directory .` so relative
paths (volumes, `.env`) resolve against the repo root:
```bash
DC="docker compose -f infra/docker/docker-compose.yml --project-directory ."

$DC up -d                                    # Start all services
$DC logs -f api                              # View API logs
$DC logs -f worker                           # View Celery worker logs
$DC exec api python manage.py <command>      # Run management commands
$DC up -d --build                            # Rebuild after dependency changes
```

> **IMPORTANT**: The API container does NOT mount source code as a volume — code is baked in at build time. After editing host files, either copy them into the container (`docker cp <file> axiom-api:/app/<path>`) for a quick test, or rebuild with `$DC up -d --build` to make changes permanent.

### Backend
```bash
# Testing (tests live in apps/api/tests/) — pytest is a dev dep; install in container first if missing:
# docker exec axiom-api pip install --user pytest pytest-django pytest-cov
$DC exec api python -m pytest tests/                               # All tests (SQLite in-memory)
$DC exec api python -m pytest tests/test_views.py                  # Single file
$DC exec api python -m pytest tests/test_views.py -k test_name     # Single test
$DC exec api python -m pytest tests/ --cov                         # With coverage

# Code quality (uses root .venv)
source .venv/bin/activate && cd apps/api && black . && isort . && flake8 .   # Format + lint

# Migrations
# IMPORTANT: always run makemigrations locally and commit the generated files
# before pushing. The container entrypoint runs --check --dry-run and will
# refuse to start if there are uncommitted schema changes.
$DC exec api python manage.py makemigrations
$DC exec api python manage.py migrate

# Custom management commands
$DC exec api python manage.py update_balances             # Recalculate account balances from transactions
$DC exec api python manage.py setup_permissions           # Create Members group with full CRUD on all user-facing apps
$DC exec api python manage.py fix_installments_paid_status
$DC exec api python manage.py close_overdue_bills         # Mark overdue credit card bills
$DC exec api python manage.py process_existing_transfers
$DC exec api python manage.py purge_deleted_records       # Hard-delete soft-deleted records >90 days (LGPD compliance)
$DC exec api python manage.py vault_recovery              # Vault diagnostics, snapshot, and restore
$DC exec api python manage.py migrate_media_to_minio      # Move local media files to MinIO (supports --dry-run)
```

### Frontend
```bash
cd apps/frontend
npm run dev              # Dev server
npm run build            # Production build (TypeScript + Vite)
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run typecheck        # TypeScript type check only (no build)

# Testing (run on host machine — frontend container is nginx-only)
npm run test -- --run                         # All tests (single run)
npm run test -- --run -t "test name"          # Single test by name
npm run test:coverage                         # With coverage report

# Storybook
npm run storybook                             # Dev server at port 6006
npm run build:storybook                       # Build static Storybook
```

**Testing stack**: Vitest 4 + @testing-library/react v16 + happy-dom. Config in `vitest.config.ts`. Setup file: `src/test/setup.ts`. `globals: false` — test files must explicitly import `{ describe, it, expect, vi }` from `'vitest'`. Pre-push hook runs `npm run test:coverage` automatically.

### Mobile
```bash
cd apps/mobile
flutter pub get                        # Install dependencies
flutter run                            # Run on a connected device/emulator
dart format --set-exit-if-changed .    # Format check
flutter analyze                        # Lint / static analysis
flutter test --coverage                # Tests with coverage
flutter build apk --debug              # Build verification (Android; iOS needs macOS/Xcode)
```

### CI/CD Validation (run before every push)

GitLab pipelines only trigger on an actual MR event or a push to `develop`/`main` (`workflow:` rules in `.gitlab-ci.yml`) — a plain `git push` on a feature branch with no MR open creates **no pipeline at all**. `ci-check.sh` at the repo root fills that gap: it interactively simulates the `lint` stage jobs that would run once you open the MR. **Run this after any change.** The mobile module has no CI jobs at all (removed — run the Flutter commands above directly for local lint/test/build).

```bash
# Setup (one-time): create root .venv with dev dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements-dev.txt pip-audit

# Run interactively — the script asks what to do:
#   1) Run MR checks (lint stage — choose all / backend-only / frontend-only)
#   2) Show the jobs that run on develop (informational only, not executed)
#   3) Show the jobs that run on main (informational only, not executed)
#   4) Run MR checks + show develop and main
#   0) Exit
source .venv/bin/activate && ./ci-check.sh
```

The only flag is `--help`/`-h`; every other choice (scope, category) is made through the menu. If stdin isn't a TTY (e.g. invoked from a non-interactive context), the script skips the menu and runs the MR checks directly.

The script requires:
- Docker Compose running with the `api` service up (only needed for `lint:migrations`)
- Node.js 20+ on the host with `apps/frontend/node_modules` present (only needed for the frontend checks)
- `.venv` at the repo root (auto-created if missing)

MR checks covered: `lint:backend` (black/isort/flake8), `lint:migrations`, `lint:bandit`, `lint:pip-audit`, `lint:frontend` (eslint/prettier), `lint:npm-audit`, `lint:k8s` (kubeconform, optional — skipped if not installed), `lint:commits` (commitlint, optional — approximated locally against the merge-base with `origin/develop`, since the exact MR diff range only exists inside a real MR pipeline), `lint:secrets` (gitleaks, optional locally, mandatory in GitLab CI). Note: `typecheck:backend`/`typecheck:frontend`/`test:backend`/`test:frontend` are **not** simulated because no job with those names currently exists in `.gitlab-ci.yml` — the pipeline does not run mypy/tsc/pytest/vitest today.

After any change, also verify the Docker build passes:
```bash
$DC up --build -d
```

### Local Development (without Docker)
```bash
# Backend — uses the root .venv (same as ci-check.sh)
source .venv/bin/activate
cd apps/api && python manage.py migrate && python manage.py runserver 0.0.0.0:39100

# Frontend
cd apps/frontend && npm install && npm run dev
```

### Database
```bash
$DC exec db pg_dump -U $DB_USER axiom_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql
$DC exec -T db psql -U $DB_USER axiom_db < backups/your_backup.sql
$DC exec db psql -U $DB_USER -d axiom_db    # PostgreSQL shell
```

### Git Hooks (one-time setup, run from repo root)

> **REQUIRED**: Both hooks below must be installed before your first commit. The `commit-msg` hook is enforced in CI via `lint:commits` on every MR — commits that bypass it will fail the pipeline.

```bash
# Requires .venv active or pre-commit installed globally
pre-commit install                        # pre-commit hook (black/isort/flake8/mypy)
pre-commit install --hook-type commit-msg # commitlint hook — REQUIRED
```

## Design Token System

Typography, spacing, and font weights are CSS variables defined in `apps/frontend/src/index.css` and mapped to Tailwind utilities via `apps/frontend/tailwind.config.js` (scales: `--text-*`, `--font-*`, `--spacing-*`).

**Rule**: Prefer semantic spacing tokens (`p-md`, `gap-lg`) over numeric Tailwind defaults (`p-4`, `gap-6`) for layout and component padding. Numeric values are still acceptable for small adjustments (borders, icon sizes, etc.).

## Frontend Data-Fetching & Caching

The frontend uses **TanStack Query v5** (`@tanstack/react-query`) for all server-state management. `QueryClientProvider` wraps the app in `App.tsx`; the shared client lives in `src/lib/query-client.ts`.

**Data fetching pattern for new pages**: use `useQuery` + `useMutation` (TanStack Query) rather than the older `hooks/use-crud-page.ts` hook. Both exist in the codebase; TanStack Query is the current standard.

### Cache TTLs
`staleTime` is aligned with the backend's Redis cache TTLs (`apps/api/app/settings.py`). Data within its stale window is served from cache; data beyond it triggers a background refetch.

| Constant | Value | Backend setting | Used for |
|---|---|---|---|
| `STALE_TIMES.DASHBOARD_STATS` | 60 s | `CACHE_TTL_DASHBOARD_STATS` | Dashboard aggregate stats |
| `STALE_TIMES.ACCOUNT_BALANCES` | 30 s | `CACHE_TTL_ACCOUNT_BALANCES` | Per-account balances |
| `STALE_TIMES.CATEGORY_BREAKDOWN` | 300 s | `CACHE_TTL_CATEGORY_BREAKDOWN` | CC expenses by category |
| `STALE_TIMES.BALANCE_FORECAST` | 120 s | `CACHE_TTL_BALANCE_FORECAST` | Balance & cash-flow forecasts |
| `STALE_TIMES.DEFAULT_LIST` | 60 s | — | All other list endpoints |

`gcTime` (inactive cache retention) is 5 minutes for all queries. `refetchOnWindowFocus: true` by default — no need to add manual `visibilitychange` listeners.

### Cache invalidation
After a mutation succeeds, call `queryClient.invalidateQueries({ queryKey: ['resource'] })` to mark the affected cache entry stale and trigger a background refetch. Example in `Accounts.tsx`:
```tsx
const queryClient = useQueryClient();
const deleteMutation = useMutation({
  mutationFn: (id: number) => accountsService.delete(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
});
```

### Query key conventions
| Scope | Key shape | Example |
|---|---|---|
| Resource list | `['resourceName']` | `['accounts']`, `['expenses']` |
| Dashboard endpoint | `['dashboard', 'endpointName']` | `['dashboard', 'stats']` |
| Parameterised | `['resource', 'action', ...params]` | `['dashboard', 'cashFlowForecast', 30]` |
| Filtered | `['resource', 'action', filterA, filterB]` | `['dashboard', 'ccExpensesByCategory', 'all', 'all']` |

### Global error handling
`QueryCache.onError` in `query-client.ts` shows a destructive toast for any query failure, debounced at 2 s to collapse simultaneous failures (e.g. network outage). Pages do **not** need per-query error state — the global handler covers it.

### Auth token refresh compatibility
The JWT refresh flow in `api-client.ts` is implemented as an Axios response interceptor. TanStack Query never sees 401 errors — the interceptor transparently refreshes the token and retries the request. No changes to `api-client.ts` were required.

### Testing
Wrap components that use queries with `<QueryClientProvider client={queryClient}>` in test render helpers. Call `queryClient.clear()` in `beforeEach` to reset cache between tests. Set `queryClient.setDefaultOptions({ queries: { retry: false } })` at the top of the test file to prevent retry delays.

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

Tests live in `apps/api/tests/`. All test classes extend `BaseAPITestCase(APITestCase)` which creates a superuser and JWT-authenticated client in `setUp()`.

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
- `ENCRYPTION_KEY`: Fernet key (44 chars base64) — rotate safely using the procedure below; do **not** change it manually without running `rotate_encryption_key` first
- `BACKUP_ENCRYPTION_KEY_PREVIOUS`: previous Fernet key kept after a rotation — set this so `vault_recovery` can report its presence as a fallback hint; clear it once you confirm all fields decrypted correctly with the new key
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`: PostgreSQL credentials
- `DB_HOST`: `db` for Docker, `localhost` for local
- `REDIS_URL`: Redis connection string (default: `redis://localhost:6379/0`); also used as Celery broker/result backend
- `REDIS_PASSWORD`: Redis auth password (required in Docker; set on `redis-server --requirepass`)
- `VITE_API_BASE_URL`: Backend URL (default: `http://localhost:39100`)
- `VITE_SENTRY_DSN`: Sentry DSN for frontend error tracking (optional — Sentry is silently disabled when unset)
- `EMAIL_BACKEND`: defaults to `smtp`; set to `django.core.mail.backends.console.EmailBackend` for local dev
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`: SMTP configuration
- `MINIO_ENDPOINT`: hostname:port of MinIO (e.g. `minio:9000`); when set, media files use S3/MinIO storage instead of local filesystem
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`: MinIO credentials (required when `MINIO_ENDPOINT` is set)
- `MINIO_BUCKET_NAME`: target bucket (default: `axiom`)
- `MINIO_USE_SSL`: `true`/`false` (default: `false`)
- `MINIO_CA_BUNDLE`: path to CA cert for self-signed MinIO TLS (e.g. `/etc/ssl/minio/ca.crt` in k8s)
- `LLM_PROVIDER`: `ollama` (default), `groq`, `anthropic`, or `openai`
- `LLM_FALLBACK_PROVIDERS`: comma-separated fallback providers tried in order if the primary fails (e.g. `groq,anthropic`)
- `OLLAMA_BASE_URL`: Ollama server URL (default: `http://ollama:11434` locally; points at a self-managed external host in staging/production — see `documentation/llm/infrastructure.md`)
- `OLLAMA_MODEL`: chat model (default: `mistral:7b-instruct`)
- `OLLAMA_EMBED_MODEL`: embedding model (default: `nomic-embed-text`)
- `GROQ_API_KEY` / `GROQ_MODEL`: required when `LLM_PROVIDER=groq`
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`: required when `LLM_PROVIDER=anthropic`
- `OPENAI_API_KEY` / `OPENAI_MODEL`: required when `LLM_PROVIDER=openai`
- `LLM_TIMEOUT_CHAT` / `LLM_TIMEOUT_EMBED`: timeouts in seconds (defaults: 120 / 30)

## Key Rotation

`ENCRYPTION_KEY` (Fernet) protects app-level encrypted fields (`Account._account_number`, `CreditCard._security_code/_card_number`, `Member._document`, `CredentialShareToken._encrypted_password`) and serves as an HMAC key for `Member.document_hash`. Vault data (`security.*`) is **not** affected — it uses per-user vault-key encryption.

To rotate: use the `rotate_encryption_key` management command (`--old-key`, `--new-key`, supports `--dry-run`). Always back up the DB first, keep the old key in `BACKUP_ENCRYPTION_KEY_PREVIOUS` for 24 h, then rebuild. To reverse a failed rotation, re-run the command with keys swapped. Use `vault_recovery --username <u>` for diagnostics.

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

Config is at `apps/frontend/commitlint.config.cjs` (alongside its packages). Packages are in `apps/frontend/devDependencies`.

## Dependency Management

All dependencies are pinned to **exact versions** (no `^`, `~`, or `>=` ranges) to prevent unexpected breaking changes and supply-chain attacks via minor/patch updates.

### Files
| File | Purpose |
|------|---------|
| `apps/api/requirements.txt` | Production Python deps — pinned to exact versions |
| `apps/api/requirements-dev.txt` | Dev/test Python deps — also pinned exactly |
| `apps/frontend/package.json` | npm deps — exact versions, enforced by `package-lock.json` |

### Updating dependencies
1. Create a dedicated PR for dependency updates (do not bundle with feature work).
2. Review the changelog/release notes for each package being upgraded.
3. **Backend**: run `pip install -r requirements.txt` in a clean virtualenv, verify tests pass (`docker compose -f infra/docker/docker-compose.yml --project-directory . exec api python -m pytest tests/`), then update the pin in the file.
4. **Frontend**: run `npm install <pkg>@<version>` to update `package-lock.json` as well, verify tests pass (`npm run test -- --run`), then commit both files.
5. Use commit type `chore(deps):` per the commit convention.

### Automated updates (Dependabot)
`.github/dependabot.yml` is configured to open monthly PRs for pip, npm, and GitHub Actions dependencies. Each PR must pass CI and receive a manual changelog review before merging.

## Tool Configuration

Backend tools configured in `apps/api/pyproject.toml`: Black (line-length 88, excludes migrations), isort (black profile), pytest (DJANGO_SETTINGS_MODULE=app.settings), coverage, mypy, flake8.

Frontend: ESLint flat config (`eslint.config.js`), Prettier (`.prettierrc` with tailwindcss plugin).

## Development Checklist

After any change:
1. Run `source .venv/bin/activate && ./ci-check.sh` (see [CI/CD Validation](#cicd-validation-run-before-every-push))
2. Verify the Docker build still passes: `docker compose -f infra/docker/docker-compose.yml --project-directory . up --build -d`
3. Tell the changes to user in brazilian portuguese
