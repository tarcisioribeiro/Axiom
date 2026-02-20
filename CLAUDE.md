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

**Apps**: accounts, credit_cards, expenses, revenues, loans, transfers, payables, vaults, dashboard, authentication, members, app (core config), security, library, personal_planning, notifications, ai_assistant (Ollama-powered)

**View Pattern**: Uses DRF generic views (not ViewSets). Each resource has two views:
- `ResourceCreateListView(generics.ListCreateAPIView)` — GET list + POST create
- `ResourceRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView)` — GET/PUT/PATCH/DELETE

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

**Service Pattern**: Services extend `BaseService<T, CreateData, UpdateData>` from `services/base-service.ts` for CRUD. Endpoints defined in `config/constants.ts:API_CONFIG.ENDPOINTS`. All services are class singletons exported as `const fooService = new FooService()`.

**API Client**: `services/api-client.ts` wraps axios. Cookies sent automatically (`withCredentials: true`). Auto-refresh on 401 except auth endpoints. Custom error classes: `AuthenticationError`, `ValidationError`, `NotFoundError`, `PermissionError`.

**State**: Zustand for auth (`stores/auth-store.ts`). React Hook Form + Zod for forms. Local state for component data.

**Translation System**: `config/constants.ts` contains `TRANSLATIONS` (EN→PT-BR) and `REVERSE_TRANSLATIONS` for all domain terms. `autoTranslate()` searches all sections. Use these translations for UI display.

**CRUD Hook**: `hooks/use-crud-page.ts` encapsulates load/create/update/delete with loading states and toast notifications.

**Import alias**: `@/` → `frontend/src/`

**Pre-commit**: Husky + lint-staged runs ESLint + Prettier on staged files.

## Development Commands

### Docker Workflow (primary)
```bash
docker-compose up -d                                    # Start all services
docker-compose logs -f api                              # View API logs
docker-compose exec api python manage.py <command>      # Run management commands
docker-compose up -d --build                            # Rebuild after dependency changes
```

### Backend
```bash
# Testing
docker-compose exec api python manage.py test                 # All tests (SQLite in-memory)
docker-compose exec api python manage.py test accounts        # Single app
docker-compose exec api pytest                                # With pytest
docker-compose exec api pytest --cov                          # With coverage
docker-compose exec api pytest api/accounts/tests/test_views.py -k test_name  # Single test

# Code quality
cd api && black . && isort . && flake8 .                      # Format + lint

# Migrations
docker-compose exec api python manage.py makemigrations
docker-compose exec api python manage.py migrate

# Custom management commands
docker-compose exec api python manage.py update_balances
docker-compose exec api python manage.py setup_permissions
docker-compose exec api python manage.py fix_installments_paid_status
docker-compose exec api python manage.py close_overdue_bills
docker-compose exec api python manage.py process_existing_transfers
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
```

### Local Development (without Docker)
```bash
# Backend
cd api && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate && python manage.py runserver 0.0.0.0:8002

# Frontend
cd frontend && npm install && npm run dev
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
1. Create `models.py` with `is_deleted` field for soft delete
2. Create `serializers.py` using `ModelSerializer`; encrypted fields should be `write_only=True`
3. Create `views.py` with `CreateListView` + `RetrieveUpdateDestroyView` using `(IsAuthenticated, GlobalDefaultPermission)`
4. Create `urls.py` under `api/v1/` prefix
5. Register in `app/urls.py` and `INSTALLED_APPS` in `app/settings.py`
6. For encrypted fields: use `FieldEncryption.encrypt_data()` in `save()` and property for decryption

### Adding a New Frontend Service
1. Define types in the service or types file
2. Extend `BaseService<T, CreateData>` from `services/base-service.ts`
3. Add endpoint to `config/constants.ts:API_CONFIG.ENDPOINTS`
4. Export singleton instance
5. Add translations to `TRANSLATIONS` in `config/constants.ts`

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
- **Ollama**: localhost:39104
- **MinIO API**: localhost:39105
- **MinIO Console**: localhost:39106

## Tool Configuration

Backend tools configured in `api/pyproject.toml`: Black (line-length 88, excludes migrations), isort (black profile), pytest (DJANGO_SETTINGS_MODULE=app.settings), coverage, mypy, flake8.

Frontend: ESLint flat config (`eslint.config.js`), Prettier (`.prettierrc` with tailwindcss plugin).
