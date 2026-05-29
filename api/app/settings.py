import os
import sys
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

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
# (e.g. nginx). Set SECURE_PROXY_SSL_HEADER=true when running
# behind an SSL-terminating proxy.
if os.getenv("SECURE_PROXY_SSL_HEADER", "False") == "True":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ALLOWED_HOSTS configurado via variavel de ambiente
# Em producao, definir explicitamente os dominios permitidos
# Exemplo: ALLOWED_HOSTS=axiom.com,api.axiom.com
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

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
    "authentication.middleware.JWTCookieMiddleware",  # JWT via cookies
    "app.middleware.AuditLoggingMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "app.middleware.SecurityHeadersMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT", 5432),
    }
}

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

# MinIO / S3 Object Storage
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "")

if MINIO_ENDPOINT:
    STORAGES = {
        "default": {
            "BACKEND": "app.storage.MinIOStorage",
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
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",  # noqa: E501
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
        "export": "20/minute",
        "vault_unlock": "10/minute",
        # LLM calls are expensive — conservative per-user cap
        "agent": "30/minute",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# OpenAPI/Swagger Documentation (drf-spectacular)
SPECTACULAR_SETTINGS = {
    "TITLE": "Axiom API",
    "DESCRIPTION": "API para gerenciamento financeiro pessoal",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"],
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
        "BACKEND": "django_redis.cache.RedisCache",
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


CORS_ALLOWED_ORIGINS = _normalize_cors_origins(
    os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )
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
# Tasks retry policy
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_MAX_RETRIES = 3
# Use in-memory broker in tests to avoid requiring Redis in CI
if _TESTING:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
