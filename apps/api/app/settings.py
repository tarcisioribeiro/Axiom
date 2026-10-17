import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path
from typing import Any

from django.core.exceptions import ImproperlyConfigured

from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

_TESTING = "test" in sys.argv or (
    len(sys.argv) > 0 and "pytest" in sys.argv[0]
)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY and not _TESTING:
    raise ImproperlyConfigured(
        "SECRET_KEY environment variable is not set. "
        "Copy .env.example to .env and set a unique value."
    )

DEBUG = os.getenv("DEBUG", "False") == "True"

# ============================================================================
# HTTPS / SSL / HSTS
# In production: SECURE_SSL_REDIRECT=True, SESSION_COOKIE_SECURE=True,
# CSRF_COOKIE_SECURE=True, SECURE_HSTS_SECONDS=31536000 (after HTTPS verified).
# ============================================================================
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "False") == "True"
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "False") == "True"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "False") == "True"
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SAMESITE = "Strict"

# HSTS — only active when SECURE_HSTS_SECONDS > 0.
# Start with a short value (e.g. 300) in staging before committing to 31536000.
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.getenv("SECURE_HSTS_INCLUDE_SUBDOMAINS", "False") == "True"
)
SECURE_HSTS_PRELOAD = os.getenv("SECURE_HSTS_PRELOAD", "False") == "True"

# Trust X-Forwarded-Proto from the TLS-terminating reverse proxy
# (e.g. nginx). Set SECURE_PROXY_SSL_HEADER=True (case-sensitive) when running
# behind an SSL-terminating proxy.
if os.getenv("SECURE_PROXY_SSL_HEADER", "False") == "True":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ALLOWED_HOSTS configurado via variavel de ambiente
# Em producao, definir explicitamente os dominios permitidos
# Exemplo: ALLOWED_HOSTS=axiom.com,api.axiom.com
ALLOWED_HOSTS = os.getenv(
    "ALLOWED_HOSTS", "localhost,127.0.0.1,axiom.localhost"
).split(",")

# Number of trusted reverse proxies in front of the application.
# Set to 0 for direct (no-proxy) connections; 1 for a single
# nginx/load-balancer. Controls how X-Forwarded-For is parsed to
# prevent IP spoofing in audit logs.
NUM_PROXIES = int(os.getenv("NUM_PROXIES", "1"))

INSTALLED_APPS = [
    "django_prometheus",
    "django_admin_dracula",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "app",
    "storage",
    "authentication",
    "accounts",
    "credit_cards",
    "expenses",
    "loans",
    "members",
    "revenues",
    "transfers",
    "dashboard",
    # Security Module
    "security",
    # Library Module
    "library",
    # Personal Planning Module
    "personal_planning",
    # Payables Module
    "payables",
    # Receivables Module
    "receivables",
    # Vaults Module (Cofres)
    "vaults",
    # Notifications Module
    "notifications",
    # Budgets Module
    "budgets",
    # Bank Reconciliation Module
    "bank_reconciliation",
    # Monthly Planning Module
    "monthly_planning",
    # Agents Module
    "agents",
    # Admin Panel Module
    "admin_panel",
    # Async task queue
    "django_celery_beat",
    # Webhooks outbound
    "webhooks",
    # Exchange Rates (multi-currency)
    "exchange_rates",
    # Revisão diária (pendências do dia anterior)
    "daily_review",
]

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "app.middleware.DecryptionCacheMiddleware",  # Limpa cache de decriptacao
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Bloqueia login/sessão Web (cookie) em smartphone/tablet; antes do JWT
    "authentication.device_policy.WebDevicePolicyMiddleware",
    "authentication.middleware.JWTCookieMiddleware",  # JWT via cookies
    "app.middleware.AuditLoggingMiddleware",
    "admin_panel.middleware.ScreenAccessMiddleware",  # acesso por tela
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "app.middleware.SecurityHeadersMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

# Versão Web só para PCs/notebooks (authentication/device_policy.py).
# Afeta só login e sessão por cookie; clientes com Authorization não.
WEB_BLOCK_MOBILE_DEVICES = (
    os.getenv("WEB_BLOCK_MOBILE_DEVICES", "True") == "True"
)

ROOT_URLCONF = "app.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "app.wsgi.application"

DATABASES: dict[str, dict[str, Any]] = {
    "default": {
        # django_prometheus's wrapper is a drop-in replacement for the plain
        # postgresql backend — it instruments query counts/latency/errors
        # (django_db_* metrics) without changing connection behavior. The
        # Grafana "Database Query Rate" panel depends on this.
        "ENGINE": "django_prometheus.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT", 5432),
    }
}

# Optional TLS mode for the external self-managed Postgres server. Only added
# when explicitly set, so local/docker-compose Postgres (no DB_SSLMODE env
# var) keeps today's implicit libpq default behavior unchanged.
_db_sslmode = os.getenv("DB_SSLMODE")
if _db_sslmode:
    DATABASES["default"]["OPTIONS"] = {"sslmode": _db_sslmode}

# Use SQLite for tests to avoid database connection issues
if _TESTING:
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
    # Disable MinIO storage during tests — use default local filesystem
    os.environ.pop("MINIO_ENDPOINT", None)

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation."
        + ("UserAttributeSimilarityValidator"),
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",  # noqa: E501
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",  # noqa: E501
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",  # noqa: E501
    },
]

LANGUAGE_CODE = "pt-BR"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

MEDIA_ROOT = os.path.join(BASE_DIR, "media")
MEDIA_URL = "/media/"
# Testes gravam uploads fora do projeto: não dependem da permissão da pasta
# media/ (criada pelo container como root) nem deixam arquivos nela.
if _TESTING:
    MEDIA_ROOT = os.path.join(tempfile.gettempdir(), "axiom-test-media")

# MinIO / S3 Object Storage
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "")

if MINIO_ENDPOINT:
    STORAGES = {
        "default": {
            "BACKEND": "storage.backends.MinIOStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    AWS_ACCESS_KEY_ID = os.getenv("MINIO_ROOT_USER")
    AWS_SECRET_ACCESS_KEY = os.getenv("MINIO_ROOT_PASSWORD")
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        raise ImproperlyConfigured(
            "MINIO_ROOT_USER and MINIO_ROOT_PASSWORD must be set."
        )
    AWS_STORAGE_BUCKET_NAME = os.getenv("MINIO_BUCKET_NAME", "axiom")
    _minio_use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    _minio_scheme = "https" if _minio_use_ssl else "http"
    # MINIO_ENDPOINT may already carry its own scheme (same convention as
    # infra/scripts/*/backup-cronjob.yaml) for setups where the internal
    # connection (this endpoint) and the external one (MINIO_EXTERNAL_ENDPOINT,
    # used for presigned URLs) don't share the same TLS posture — e.g. staging
    # talks to MinIO directly over plain HTTP while the public domain is
    # HTTPS-terminated by a reverse proxy. Falls back to MINIO_USE_SSL when no
    # scheme is present, so existing bare host:port values keep working.
    if MINIO_ENDPOINT.startswith("http://") or MINIO_ENDPOINT.startswith(
        "https://"
    ):
        AWS_S3_ENDPOINT_URL = MINIO_ENDPOINT
    else:
        AWS_S3_ENDPOINT_URL = f"{_minio_scheme}://{MINIO_ENDPOINT}"
    AWS_S3_REGION_NAME = "us-east-1"
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_ADDRESSING_STYLE = "path"
    # When TLS is enabled, verify using the internal CA cert mounted by the
    # k8s deployment (MINIO_CA_BUNDLE=/etc/ssl/minio/ca.crt). Falls back to
    # True (system CAs) when the env var is unset (e.g. local Docker Compose).
    if _minio_use_ssl:
        AWS_S3_VERIFY = os.getenv("MINIO_CA_BUNDLE", True)

# Health check configuration
DISK_SPACE_WARN_THRESHOLD = float(os.getenv("DISK_SPACE_WARN_THRESHOLD", "10"))

# REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "EXCEPTION_HANDLER": "app.exceptions.custom_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "app.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/minute",
        "user": "1000/minute",
        # raised: NUM_PROXIES=1 collapses CI traffic to ingress
        "login": "30/minute",
        "register": "3/minute",
        "share_token": "10/minute",
        "theme_sync": "30/minute",
        "export": "20/minute",
        "vault_unlock": "10/minute",
        "credit_card_delete": "5/minute",
        # LLM calls are expensive — conservative per-user cap
        "agent": "30/minute",
        "categorization_suggest": "20/minute",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# OpenAPI/Swagger Documentation (drf-spectacular)
SPECTACULAR_SETTINGS = {
    "TITLE": "Axiom API",
    "DESCRIPTION": "API para gerenciamento financeiro pessoal",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["app.permissions.IsSuperuser"],
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "TAGS": [
        {"name": "auth", "description": "Autenticacao e registro"},
        {"name": "accounts", "description": "Contas bancarias"},
        {"name": "credit_cards", "description": "Cartoes de credito"},
        {"name": "expenses", "description": "Despesas"},
        {"name": "revenues", "description": "Receitas"},
        {"name": "loans", "description": "Emprestimos"},
        {"name": "transfers", "description": "Transferencias"},
        {"name": "dashboard", "description": "Dashboard e estatisticas"},
        {"name": "security", "description": "Gerenciador de senhas"},
        {"name": "library", "description": "Biblioteca de livros"},
        {"name": "personal_planning", "description": "Planejamento pessoal"},
    ],
}

# Caching Configuration
# Usa Redis como cache padrao para compartilhamento entre processos
# Fallback para locmem se Redis nao estiver disponivel
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

CACHES = {
    "default": {
        # django_prometheus's wrapper subclasses django_redis's RedisCache —
        # drop-in compatible, adds django_cache_get_total/hits/misses metrics.
        # The Grafana "Cache Hit Ratio" panel depends on this.
        "BACKEND": "django_prometheus.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": True,  # Fallback gracioso se Redis falhar
        },
        "KEY_PREFIX": "axiom",
        "TIMEOUT": 300,  # 5 minutos default
    },
    "locmem": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-snowflake",
    },
}

# Use in-memory cache for tests — no Redis required in CI
if _TESTING:
    CACHES["default"] = {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "test-cache",
    }

# TTLs de cache especificos (em segundos)
CACHE_TTL_DASHBOARD_STATS = 60  # 1 minuto - dados mudam frequentemente
CACHE_TTL_ACCOUNT_BALANCES = 30  # 30 segundos - saldos sao criticos
CACHE_TTL_CATEGORY_BREAKDOWN = 300  # 5 minutos - agregacoes pesadas
CACHE_TTL_BALANCE_FORECAST = 120  # 2 minutos - previsoes
CACHE_TTL_CASH_FLOW_FORECAST = 300  # 5 minutos - projecao de fluxo de caixa
CACHE_TTL_DEBT_PAYOFF_PLAN = (
    300  # 5 minutos - planejador de quitacao de dividas
)

# Budget enforcement mode: 'soft' (201 + budget_warning), 'hard' (400 block)
BUDGET_ENFORCEMENT_MODE = os.getenv("BUDGET_ENFORCEMENT_MODE", "soft")

# Structured Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        },
        "verbose": {
            "format": (
                "{levelname} {asctime} {module} "
                "{process:d} {thread:d} {message}"
            ),
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": (
                "json" if os.getenv("LOG_FORMAT") == "json" else "verbose"
            ),
        },
        "audit_file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(BASE_DIR, "logs", "audit.log"),
            "maxBytes": 10 * 1024 * 1024,  # 10 MB
            "backupCount": 10,
            "formatter": "json",
        },
        "compliance_file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(BASE_DIR, "logs", "compliance.log"),
            "maxBytes": 10 * 1024 * 1024,  # 10 MB
            "backupCount": 10,
            "formatter": "json",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": True,
        },
        "axiom": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "axiom.audit": {
            "handlers": ["console", "audit_file"],
            "level": "INFO",
            "propagate": False,
        },
        "compliance": {
            "handlers": ["compliance_file"],
            "level": "INFO",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
}

# Create logs directory if it doesn't exist
logs_dir = os.path.join(BASE_DIR, "logs")
os.makedirs(logs_dir, exist_ok=True)


# CORS Configuration
# Permitir apenas origens específicas (desenvolvimento e produção)
def _normalize_cors_origins(origins_str: str) -> list[str]:
    """
    Normaliza origens CORS garantindo que todas tenham esquema (http/https).
    Adiciona https:// automaticamente se o esquema estiver faltando.
    """
    origins = []
    for origin in origins_str.split(","):
        origin = origin.strip()
        if not origin:
            continue
        # Se não tem esquema, adiciona https:// por padrão
        if not origin.startswith(("http://", "https://")):
            origin = f"https://{origin}"
        origins.append(origin)
    return origins


_DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000,"
    "http://127.0.0.1:3000,"
    "http://axiom.localhost:3000"
)
CORS_ALLOWED_ORIGINS = _normalize_cors_origins(
    os.getenv("CORS_ALLOWED_ORIGINS", _DEFAULT_CORS_ORIGINS)
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# ============================================================================
# Email Configuration
# Uses SMTP by default; switch EMAIL_BACKEND to console for development.
# ============================================================================
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL", "Axiom <noreply@axiom.app>"
)
# Public URL used in email links (e.g. https://axiom.yourdomain.com)
SITE_URL = os.getenv("SITE_URL", "")

# Use console backend in tests to avoid hitting a real SMTP server
if _TESTING:
    EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# ============================================================================
# LLM / Agents Configuration
# ============================================================================
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
LLM_TIMEOUT_CHAT = int(os.getenv("LLM_TIMEOUT_CHAT", "120"))
LLM_TIMEOUT_EMBED = int(os.getenv("LLM_TIMEOUT_EMBED", "30"))
# ANTHROPIC_MODEL and ANTHROPIC_API_KEY must be set when LLM_PROVIDER=anthropic
# OPENAI_MODEL and OPENAI_API_KEY must be set when LLM_PROVIDER=openai

# ============================================================================
# Celery / Async Tasks
# ============================================================================
CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Sao_Paulo"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_BEAT_SCHEDULE = {
    "weekly-financial-insights": {
        "task": "agents.tasks.generate_weekly_insights_all_users",
        "schedule": crontab(hour=9, minute=0, day_of_week="sunday"),
        "options": {"expires": 3600},
    },
    "smart-financial-notifications": {
        "task": "dashboard.tasks.send_smart_financial_notifications",
        "schedule": crontab(hour=6, minute=0),
        "options": {"expires": 3600},
    },
    "weekly-intellect-recommendations": {
        "task": "agents.tasks.send_weekly_intellect_recommendations",
        "schedule": crontab(hour=9, minute=0, day_of_week="sunday"),
        "options": {"expires": 3600},
    },
    "check-vault-alert-rules": {
        "task": "security.tasks.check_vault_alert_rules",
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 900},
    },
    # Gera notificações para todos os membros ativos a cada hora.
    "generate-all-notifications-hourly": {
        "task": "notifications.tasks.generate_all_notifications",
        "schedule": crontab(minute=0),
    },
    # Calcula rendimentos diários de vaults com taxa configurada.
    "calculate-vault-yields-daily": {
        "task": "vaults.tasks.calculate_daily_yields",
        "schedule": crontab(hour=1, minute=0),
    },
    # Gera instâncias de despesas/receitas fixas no 1º dia de cada mês.
    "generate-fixed-expenses-monthly": {
        "task": "expenses.tasks.generate_fixed_expenses_for_month",
        "schedule": crontab(hour=0, minute=30, day_of_month=1),
    },
    # Gera instâncias de receitas fixas no 1º dia de cada mês.
    "generate-fixed-revenues-monthly": {
        "task": "revenues.tasks.generate_fixed_revenues_for_month",
        "schedule": crontab(hour=0, minute=45, day_of_month=1),
    },
    # Fecha faturas vencidas diariamente (substitui cron externo).
    "close-overdue-bills-daily": {
        "task": "credit_cards.tasks.close_overdue_bills",
        "schedule": crontab(hour=2, minute=0),
    },
    # Busca cotações PTAX do BCB em dias úteis às 14h
    # (após fechamento PTAX das 13h).
    "fetch-ptax-rates-weekdays": {
        "task": "exchange_rates.fetch_ptax_rates",
        "schedule": crontab(hour=14, minute=0, day_of_week="1-5"),
    },
    # Verifica cartões armazenados vencendo em 30/60 dias (diário às 09h).
    "check-stored-card-expiry-daily": {
        "task": "security.tasks.check_stored_card_expiry",
        "schedule": crontab(hour=9, minute=0),
    },
    # Notifica senhas comprometidas (HIBP) — semanal, domingo às 08h.
    "notify-compromised-passwords-weekly": {
        "task": "security.tasks.notify_compromised_passwords",
        "schedule": crontab(hour=8, minute=0, day_of_week=0),
    },
    # Resumo semanal de segurança do cofre — segunda às 09h.
    "send-weekly-security-summary-monday": {
        "task": "security.tasks.send_weekly_security_summary",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),
    },
    # Detecta anomalias no ActivityLog diariamente às 06h.
    "detect-activity-anomalies-daily": {
        "task": "security.tasks.detect_activity_anomalies",
        "schedule": crontab(hour=6, minute=0),
    },
    # Concede conquistas (IntellectBadge) do Intelecto diariamente às 03h.
    "award-intellect-badges-daily": {
        "task": "library.tasks.award_intellect_badges_all",
        "schedule": crontab(hour=3, minute=0),
    },
    # Recomendações semanais de aprendizado — segunda às 10h.
    "send-weekly-learning-recommendations-monday": {
        "task": "library.tasks.send_weekly_learning_recommendations",
        "schedule": crontab(hour=10, minute=0, day_of_week=1),
    },
    # Marca objetivos ativos concluídos diariamente às 00h10 (rede de
    # segurança para objetivos sem tarefa vinculada).
    "check-goal-completions-daily": {
        "task": "personal_planning.tasks.check_goal_completions",
        "schedule": crontab(hour=0, minute=10),
    },
    # Detecta metas em risco (pace atrasado) diariamente às 07h.
    "detect-goal-risk-daily": {
        "task": "personal_planning.tasks.detect_goal_risk",
        "schedule": crontab(hour=7, minute=0),
    },
    # Síntese semanal de planejamento pessoal — segunda às 08h.
    "generate-weekly-planning-synthesis-monday": {
        "task": "personal_planning.tasks.generate_weekly_planning_synthesis",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),
    },
}
# Tasks retry policy
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_MAX_RETRIES = 3
# Use in-memory broker in tests to avoid requiring Redis in CI
if _TESTING:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
