# CLAUDE.md

## Project Overview

Full-stack monorepo: Django REST Framework backend (port 39100) + React/TypeScript frontend (port 39101). UI in Brazilian Portuguese; API keys translated via `apps/frontend/src/config/constants.ts`.

## Architecture

### Monorepo Structure
```
Axiom/
├── apps/
│   ├── api/       # Django backend (port 39100)
│   ├── frontend/  # React frontend (port 39101)
│   └── mobile/    # Flutter app
├── infra/
│   ├── k8s/       # Kubernetes manifests (kustomize)
│   ├── docker/    # docker-compose.yml
│   └── scripts/   # Backup/restore helpers
├── documentation/
└── .env
```

### Backend (Django)

**Apps**: accounts, credit_cards, expenses, revenues, loans, transfers, payables, receivables, vaults, dashboard, authentication, members, app (core), security, library, personal_planning, notifications, budgets, bank_reconciliation, monthly_planning, agents, exchange_rates, webhooks, admin_panel

**Large flat apps** — `library`, `security`, `personal_planning` are each a **single flat app** (one `models.py`/`views.py`), not sub-packages. Don't create sub-directories.
- `library`: books/authors/readings, Intellect extension (courses, skills, flashcards SM-2, knowledge graph, `IntellectBadge`)
- `security`: password vault (passwords, cards, accounts, archives), vault config/session keys, credential-sharing tokens
- `personal_planning`: habits/goals (`TaskInstance` lazily generated from `RoutineTask`), gamification (XP/badges — unrelated to `library`'s `IntellectBadge`), wellness center, workout/nutrition tracking. Exercise images come only from `ExerciseDatasetEntry` (via `Exercise.dataset_entry` FK); no free-form upload.

**Base Model** (`app/models.py`): uuid PK, timestamps, audit fields (`created_by`, `updated_by`, `deleted_by`, `deleted_at`), `is_deleted`. All models extend this. Also defines shared choices: `PAYMENT_FREQUENCY_CHOICES`, `PAYMENT_METHOD_CHOICES`, `LOAN_STATUS_CHOICES`, `BILL_STATUS_CHOICES`.

**View Pattern**: DRF generic views (not ViewSets). Extend `BaseListCreateView` / `BaseRetrieveUpdateDestroyView` (`app/base_views.py`) — `IsAuthenticated` + `GlobalDefaultPermission` already included.

**Permissions**: `GlobalDefaultPermission` (`app/permissions.py`) auto-derives model perms from HTTP method (GET→view, POST→add, PUT/PATCH→change, DELETE→delete).

**Soft Delete**: filter `is_deleted=False` in querysets.

**Signals**: accounts, credit_cards, loans, payables, receivables, personal_planning, transfers — registered via `apps.py:ready()`.

**Encryption** (`app/encryption.py:FieldEncryption`, Fernet): encrypted fields use `_` prefix. Decryption cache per-request via `DecryptionCacheMiddleware`. Use `defer('_field')` in list querysets.

**Authentication**: JWT in HttpOnly cookies. `JWTCookieMiddleware` extracts cookies → Authorization header. Access: 15min, refresh: 1h. 2FA: TOTP via `pyotp` (`TOTPDevice` per user; backup codes as SHA-256 hashes).

**Desktop theme sync**: `ThemePreference` (one per user) updated via `PUT /api/v1/theme-sync/` (`Authorization: ThemeSync <token>`, no JWT). Token issued with `manage.py issue_theme_sync_token`. Web app reads via `GET /api/v1/me/theme/` in `hooks/use-desktop-theme-sync.ts` (applies when different from `localStorage.desktopThemeSynced`).

**Agents / LLM** (`apps/api/agents/`): Six domain agents selected by `core/router.py`. Endpoints: `/api/v1/agents/` (ask/, stream/, history/, sessions/, status/). **Rule**: `providers/` is the **only** place in `agents/` allowed to import models from other apps — tools, domain agents, and views consume data through it. See `documentation/architecture/agents-llm-boundary.md`.

**Async Tasks**: Worker `axiom-worker`, beat `axiom-queue` (`DatabaseScheduler`). Tests: `CELERY_TASK_ALWAYS_EAGER=True`.

**Webhooks**: `dispatch_event(event, payload, user=user)` from `webhooks.dispatch`. Signed with HMAC-SHA256 (`X-Axiom-Signature`).

**Misc**: All endpoints `/api/v1/`. `PageNumberPagination` PAGE_SIZE=50. `DjangoFilterBackend`. Timezone `America/Sao_Paulo` — always `timezone.now()`. PostgreSQL 16; tests use SQLite in-memory. Redis cache prefix `axiom`. TTLs: `CACHE_TTL_DASHBOARD_STATS` 60s, `CACHE_TTL_ACCOUNT_BALANCES` 30s, `CACHE_TTL_CATEGORY_BREAKDOWN` 300s, `CACHE_TTL_BALANCE_FORECAST` 120s.

**Key models**:
- `Receivable`: mirror of `payables`; recording receipt (`received_value`) triggers revenue, not creation. Statuses: `active`, `received`, `overdue`, `cancelled`.
- `ExchangeRate.convert(amount, from_currency, to_currency)`: cross-rate via BRL, refreshed by Celery.
- `MonthlyPlan`: per-user overrides (`extra_revenues`, `budget_overrides`, etc.) via `monthly-plan/summary/` and `apply/`.
- `SystemConfig` (`admin_panel`): encrypted system config (LLM keys, email, MinIO) via Django Admin at `/admin/`.

### Frontend (React + TypeScript)

**Stack**: React 19, Vite 7, TypeScript 5.9, TailwindCSS 3, Radix UI, Zustand, React Router v7, Recharts, Framer Motion, React Hook Form + Zod, TanStack Query v5

**Data fetching**: use `useQuery` + `useMutation` (TanStack Query) — not the older `use-crud-page.ts`. Client in `src/lib/query-client.ts`.

**Service Pattern**: extend `BaseService<T, CreateData, UpdateData>` (`services/base-service.ts`). Endpoints in `config/api-config.ts:API_CONFIG.ENDPOINTS`. Export as singleton: `const fooService = new FooService()`.

**API Client** (`services/api-client.ts`): axios, `withCredentials: true`. Base URL from `window.location.hostname`, fallback `VITE_API_BASE_URL`. Auto-refresh on 401. Error classes: `AuthenticationError`, `ValidationError` (`.errors` field map), `NotFoundError`, `PermissionError`.

**State**: Zustand: `auth-store.ts` (user, `hasPermission()`, `hasSystemAccess()`), `notifications-store.ts`, `command-palette-store.ts`.

**Translation**: two layers:
- `config/translations.ts`: `translate(section, key)`, `autoTranslate()`. `lib/helpers.ts`: `translateCategory(cat, type)`. `config/categories.ts`: `EXPENSE_CATEGORIES_CANONICAL` / `REVENUE_CATEGORIES_CANONICAL` for dropdowns. Import from `@/config/constants`.
- `i18n/locales/pt-BR.json` + `en-US.json` via react-i18next. Use `LanguageSelector` component to switch.

**Design tokens**: prefer semantic spacing (`p-md`, `gap-lg`) over numeric Tailwind (`p-4`). Defined in `index.css`, mapped in `tailwind.config.js`.

**Common Components** (`components/common/`) — use before creating new ones: `PageContainer`, `EmptyState`, `LoadingState`, `DataTable`, `PageHeader`, `SearchInput`, `StatCard`, `ExportModal`, `StatementExportModal`, `AnimatedPage`, `IconButton`, `ErrorBoundary`, `LanguageSelector`, `ThemeToggle`.

**UI Primitives** (`components/ui/`): `button`, `input`, `select`, `checkbox`, `dialog`, `alert-dialog`, `form-field`, `date-picker`, `dropdown-menu`, `popover`, `badge`, `card`, `progress`, `radio-group`, `star-rating`, `textarea`, `toast`, `toaster`, `tooltip`, `skeleton`, `skeleton-variants`, `scroll-area`, `table`, `label`, `visually-hidden`, `file-input`, `icon-picker`, `circular-progress`, `success-animation`, `currency-input` (BRL, `accentColor` variants), `form-section`, `status-toggle`.

**Routing**: `ProtectedRoute` HOC; all protected pages lazy-loaded. Public routes redirect home if authenticated.

**Import alias**: `@/` → `apps/frontend/src/`

**Pre-commit**: `pre-commit` runs black/isort/flake8/mypy (backend); `husky` + `lint-staged` runs ESLint + Prettier (frontend).

### Mobile (Flutter)

**Stack**: Flutter 3.27.x / Dart 3.6.x, Material 3. Auth via `dio` + `PersistCookieJar` (same httpOnly-cookie model as web). State via `flutter_riverpod`. Navigation via `go_router` (4 bottom-nav tabs). Portuguese enum labels in `utils/choice_labels.dart`.

**Scope**: daily-use subset (finance, planning, library, wellness, vault, AI chat). Reports/config/admin stay web-only. LLM source is always `agents/` — mobile calls existing endpoints only.

**Dependencies**: pinned exact versions in `pubspec.yaml`; `pubspec.lock` committed.

## Development Commands

### Docker (primary)
```bash
DC="docker compose -f infra/docker/docker-compose.yml --project-directory ."
$DC up -d                                 # Start all
$DC logs -f api                           # API logs
$DC exec api python manage.py <command>   # Management commands
$DC up -d --build                         # Rebuild after dep changes
```

> **IMPORTANT**: API container does NOT mount source — code is baked in. After editing host files: `docker cp <file> axiom-api:/app/<path>` for a quick test, or rebuild.

### Backend
```bash
$DC exec api python -m pytest tests/                         # All tests
$DC exec api python -m pytest tests/test_views.py -k name    # Single test
$DC exec api python -m pytest tests/ --cov
source .venv/bin/activate && cd apps/api && black . && isort . && flake8 .

# Migrations — run locally and commit before pushing:
$DC exec api python manage.py makemigrations
$DC exec api python manage.py migrate

# Management commands
$DC exec api python manage.py update_balances
$DC exec api python manage.py setup_permissions
$DC exec api python manage.py close_overdue_bills
$DC exec api python manage.py purge_deleted_records        # LGPD: hard-delete >90 days
$DC exec api python manage.py vault_recovery
$DC exec api python manage.py rotate_encryption_key        # --old-key X --new-key Y --dry-run
$DC exec api python manage.py import_exercise_dataset      # one-time per env
```

### Frontend
```bash
cd apps/frontend
npm run dev / build / lint / lint:fix / format / format:check / typecheck
npm run test -- --run                  # All tests
npm run test -- --run -t "test name"   # Single test
npm run test:coverage
npm run storybook
```

**Testing stack**: Vitest 4 + @testing-library/react v16 + happy-dom. `globals: false` — import `{ describe, it, expect, vi }` explicitly. Pre-push hook runs `test:coverage` automatically.

### Mobile
```bash
cd apps/mobile
flutter pub get && flutter run
flutter analyze && flutter test --coverage
dart format --set-exit-if-changed .
```

### CI/CD Validation
```bash
source .venv/bin/activate && ./ci-check.sh
```
Simulates MR lint checks (black/isort/flake8, migrations, bandit, pip-audit, eslint/prettier, npm-audit). GitLab pipelines only trigger on MR or push to `develop`/`main`.

### Local (without Docker)
```bash
source .venv/bin/activate
cd apps/api && python manage.py migrate && python manage.py runserver 0.0.0.0:39100
cd apps/frontend && npm install && npm run dev
```

### Database
```bash
$DC exec db pg_dump -U $DB_USER axiom_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql
$DC exec -T db psql -U $DB_USER axiom_db < backups/your_backup.sql
$DC exec db psql -U $DB_USER -d axiom_db
```

### Git Hooks (one-time)
```bash
pre-commit install
pre-commit install --hook-type commit-msg  # REQUIRED — enforced in CI
```

## Key Patterns

### New Backend Resource
1. Model extends `BaseModel` from `app/models.py`
2. Serializer: explicit `fields` list — `fields = "__all__"` rejected by flake8 rule `DRF001`; encrypted fields `write_only=True`
3. Views extend `BaseListCreateView` / `BaseRetrieveUpdateDestroyView`
4. `urls.py` under `api/v1/`
5. Register in `app/urls.py` + `INSTALLED_APPS`

### New Frontend Service
1. Types in `types/index.ts`
2. Extend `BaseService<T, CreateData>` from `services/base-service.ts`
3. Endpoint in `config/api-config.ts:API_CONFIG.ENDPOINTS`
4. Export singleton
5. Add translations to `config/translations.ts`

### Encrypted Fields
```python
from app.encryption import FieldEncryption
self._account_number = FieldEncryption.encrypt_data(value)   # in save()
return FieldEncryption.decrypt_data(self._account_number)    # in property
# In list querysets:
Model.objects.filter(is_deleted=False).defer('_encrypted_field')
```

### Backend Tests
```python
class BaseAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(...)
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
```
- List responses: `response.data["results"]` / `response.data["count"]`
- Use `is_superuser=True` to bypass `GlobalDefaultPermission`
- `/api/v1/user/permissions/` blocks superusers — tests need a non-superuser

### TanStack Query
Cache TTLs (aligned with backend Redis):
| Constant | TTL |
|---|---|
| `STALE_TIMES.DASHBOARD_STATS` | 60s |
| `STALE_TIMES.ACCOUNT_BALANCES` | 30s |
| `STALE_TIMES.CATEGORY_BREAKDOWN` | 300s |
| `STALE_TIMES.BALANCE_FORECAST` | 120s |
| `STALE_TIMES.DEFAULT_LIST` | 60s |

Query key conventions: `['resource']` for lists, `['dashboard', 'endpoint']` for dashboard, `['resource', 'action', ...params]` for parameterized.

After mutations: `queryClient.invalidateQueries({ queryKey: ['resource'] })`.

`QueryCache.onError` in `query-client.ts` shows a toast (debounced 2s) — no per-query error state needed. JWT refresh is handled transparently by the Axios interceptor.

### Frontend Tests
```tsx
// Wrap with QueryClientProvider; reset between tests:
queryClient.clear();  // beforeEach
queryClient.setDefaultOptions({ queries: { retry: false } });
```

## Environment Variables

```
SECRET_KEY
ENCRYPTION_KEY              # 44-char Fernet base64 — rotate with rotate_encryption_key
BACKUP_ENCRYPTION_KEY_PREVIOUS  # keep 24h after rotation, then clear

DB_USER, DB_PASSWORD, DB_NAME
DB_HOST                     # db (Docker) | localhost
REDIS_URL                   # default redis://localhost:6379/0
REDIS_PASSWORD

VITE_API_BASE_URL           # default http://localhost:39100
VITE_SENTRY_DSN             # optional; Sentry disabled if unset

EMAIL_BACKEND               # smtp | django.core.mail.backends.console.EmailBackend
EMAIL_HOST, EMAIL_PORT, EMAIL_USE_TLS, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, DEFAULT_FROM_EMAIL

MINIO_ENDPOINT              # hostname:port; enables S3 storage when set
MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
MINIO_BUCKET_NAME           # default axiom
MINIO_USE_SSL               # true|false
MINIO_CA_BUNDLE             # path to CA cert for self-signed TLS

LLM_PROVIDER                # ollama (default) | groq | anthropic | openai
LLM_FALLBACK_PROVIDERS      # comma-separated fallback order, e.g. groq,anthropic
OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_EMBED_MODEL
GROQ_API_KEY, GROQ_MODEL
ANTHROPIC_API_KEY, ANTHROPIC_MODEL
OPENAI_API_KEY, OPENAI_MODEL
LLM_TIMEOUT_CHAT            # default 120s
LLM_TIMEOUT_EMBED           # default 30s
```

## Key Rotation

`ENCRYPTION_KEY` protects `Account._account_number`, `CreditCard._security_code/_card_number`, `Member._document`, `CredentialShareToken._encrypted_password`, and `Member.document_hash`. Vault data uses per-user key — not affected.

Rotate: `manage.py rotate_encryption_key --old-key X --new-key Y` (supports `--dry-run`). Back up DB first; keep old key in `BACKUP_ENCRYPTION_KEY_PREVIOUS` for 24h, then clear.

## Accessing the Application

| Service | URL |
|---|---|
| Frontend | http://localhost:39101 |
| Backend API | http://localhost:39100 |
| Swagger | http://localhost:39100/api/docs/ |
| ReDoc | http://localhost:39100/api/redoc/ |
| Django Admin | http://localhost:39100/admin |
| Database | localhost:39102 |
| Redis | localhost:39103 |
| MinIO API | localhost:39105 |
| MinIO Console | localhost:39106 |

## Commit Convention

Format: `<type>(<optional scope>): <description>`

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`, `perf`, `revert`, `style`

Config: `apps/frontend/commitlint.config.cjs`.

## Dependencies

All deps pinned to exact versions (no `^`, `~`). Files: `requirements.txt`, `requirements-dev.txt`, `requirements-lint.txt`, `package.json` + `package-lock.json`. Dependabot opens monthly PRs. Dep updates go in a dedicated PR with commit type `chore(deps):`.

## Tool Configuration

Backend (`apps/api/pyproject.toml`): Black (line-length 88, excludes migrations), isort (black profile), pytest (`DJANGO_SETTINGS_MODULE=app.settings`), mypy, flake8.

Frontend: ESLint (`eslint.config.js`), Prettier (`.prettierrc` with tailwindcss plugin).

---

Always report changes to the user in Brazilian Portuguese.
