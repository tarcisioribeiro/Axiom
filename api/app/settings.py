import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from datetime import timedelta
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = (
    os.getenv('SECRET_KEY')
)

DEBUG = os.getenv('DEBUG', 'False') == 'True'

# ALLOWED_HOSTS configurado via variavel de ambiente
# Em producao, definir explicitamente os dominios permitidos
# Exemplo: ALLOWED_HOSTS=mindledger.com,api.mindledger.com
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Em modo DEBUG, permitir todos os hosts para facilitar acesso via rede local
# Isso e seguro apenas em desenvolvimento - NUNCA use DEBUG=True em producao
if DEBUG:
    ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django_prometheus',
    'django_admin_dracula',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'django_filters',
    'drf_spectacular',
    'app',
    'authentication',
    'accounts',
    'credit_cards',
    'expenses',
    'loans',
    'members',
    'revenues',
    'transfers',
    'dashboard',
    # Security Module
    'security',
    # Library Module
    'library',
    # Personal Planning Module
    'personal_planning',
    # Payables Module
    'payables',
    # Vaults Module (Cofres)
    'vaults',
    # Notifications Module
    'notifications',
    # AI Assistant Module
    'ai_assistant',
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'app.middleware.DecryptionCacheMiddleware',  # Limpa cache de decriptacao por request
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'authentication.middleware.JWTCookieMiddleware',  # JWT via cookies httpOnly
    'app.middleware.AuditLoggingMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'app.middleware.SecurityHeadersMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

ROOT_URLCONF = 'app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'app.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', 5435)
    }
}

# Use SQLite for tests to avoid database connection issues
if 'test' in sys.argv:
    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:'
    }
    # Disable MinIO storage during tests — use default local filesystem
    os.environ.pop('MINIO_ENDPOINT', None)

AUTH_PASSWORD_TYPES = [
    'UserAttributeSimilarityValidator',
    'MinimumLengthValidator',
    'CommonPasswordValidator',
    'NumericPasswordValidator'
]

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': f'''django.contrib.auth.password_validation.{
            AUTH_PASSWORD_TYPES[0]
        }''',
    },
    {
        'NAME': f'''django.contrib.auth.password_validation.{
            AUTH_PASSWORD_TYPES[1]
        }''',
    },
    {
        'NAME': f'''django.contrib.auth.password_validation.{
            AUTH_PASSWORD_TYPES[2]
        }''',
    },
    {
        'NAME': f'''django.contrib.auth.password_validation.{
            AUTH_PASSWORD_TYPES[3]
        }''',
    },
]

LANGUAGE_CODE = 'pt-BR'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=1),
}

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

# MinIO / S3 Object Storage
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', '')

if MINIO_ENDPOINT:
    STORAGES = {
        'default': {
            'BACKEND': 'app.storage.MinIOStorage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
    AWS_ACCESS_KEY_ID = os.getenv('MINIO_ROOT_USER', 'mindledger')
    AWS_SECRET_ACCESS_KEY = os.getenv('MINIO_ROOT_PASSWORD', 'mindledger_secret')
    AWS_STORAGE_BUCKET_NAME = os.getenv('MINIO_BUCKET_NAME', 'mindledger')
    AWS_S3_ENDPOINT_URL = f'http://{MINIO_ENDPOINT}'
    AWS_S3_REGION_NAME = 'us-east-1'
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_ADDRESSING_STYLE = 'path'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/minute',  # Aumentado para desenvolvimento
        'user': '1000/minute'   # Aumentado para desenvolvimento
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# OpenAPI/Swagger Documentation (drf-spectacular)
SPECTACULAR_SETTINGS = {
    'TITLE': 'MindLedger API',
    'DESCRIPTION': 'API para gerenciamento financeiro pessoal',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/v1',
    'TAGS': [
        {'name': 'auth', 'description': 'Autenticacao e registro'},
        {'name': 'accounts', 'description': 'Contas bancarias'},
        {'name': 'credit_cards', 'description': 'Cartoes de credito'},
        {'name': 'expenses', 'description': 'Despesas'},
        {'name': 'revenues', 'description': 'Receitas'},
        {'name': 'loans', 'description': 'Emprestimos'},
        {'name': 'transfers', 'description': 'Transferencias'},
        {'name': 'dashboard', 'description': 'Dashboard e estatisticas'},
        {'name': 'security', 'description': 'Gerenciador de senhas'},
        {'name': 'library', 'description': 'Biblioteca de livros'},
        {'name': 'personal_planning', 'description': 'Planejamento pessoal'},
    ],
}

# Caching Configuration
# Usa Redis como cache padrao para compartilhamento entre processos
# Fallback para locmem se Redis nao estiver disponivel
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'IGNORE_EXCEPTIONS': True,  # Fallback gracioso se Redis falhar
        },
        'KEY_PREFIX': 'mindledger',
        'TIMEOUT': 300,  # 5 minutos default
    },
    'locmem': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# TTLs de cache especificos (em segundos)
CACHE_TTL_DASHBOARD_STATS = 60  # 1 minuto - dados mudam frequentemente
CACHE_TTL_ACCOUNT_BALANCES = 30  # 30 segundos - saldos sao criticos
CACHE_TTL_CATEGORY_BREAKDOWN = 300  # 5 minutos - agregacoes pesadas
CACHE_TTL_BALANCE_FORECAST = 120  # 2 minutos - previsoes

# Structured Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        },
        'verbose': {
            'format': (
                '{levelname} {asctime} {module} '
                '{process:d} {thread:d} {message}'
            ),
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': (
                'json' if os.getenv('LOG_FORMAT') == 'json' else 'verbose'
            ),
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'expenselit': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'expenselit.audit': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}

# Create logs directory if it doesn't exist
logs_dir = os.path.join(BASE_DIR, 'logs')
os.makedirs(logs_dir, exist_ok=True)

# CORS Configuration
# Permitir apenas origens específicas (desenvolvimento e produção)
def _normalize_cors_origins(origins_str):
    """
    Normaliza origens CORS garantindo que todas tenham esquema (http/https).
    Adiciona https:// automaticamente se o esquema estiver faltando.
    """
    origins = []
    for origin in origins_str.split(','):
        origin = origin.strip()
        if not origin:
            continue
        # Se não tem esquema, adiciona https:// por padrão
        if not origin.startswith(('http://', 'https://')):
            origin = f'https://{origin}'
        origins.append(origin)
    return origins

CORS_ALLOWED_ORIGINS = _normalize_cors_origins(
    os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
)
CORS_ALLOW_CREDENTIALS = True

# Em modo DEBUG, permitir todas as origens para facilitar acesso via rede local
# Isso permite que dispositivos na mesma rede acessem a API
# NUNCA use DEBUG=True em producao
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

# Production security settings
# These default to False (dev-safe) and must be explicitly enabled via env vars.
# SECURE_SSL_REDIRECT: redirect all HTTP requests to HTTPS.
# Note: if SSL termination happens at a reverse proxy/ingress, keep this False
# and use SECURE_PROXY_SSL_HEADER instead to avoid redirect loops.
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False') == 'True'
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False') == 'True'
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'False') == 'True'
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'False') == 'True'
SECURE_HSTS_PRELOAD = os.getenv('SECURE_HSTS_PRELOAD', 'False') == 'True'
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Sentry Error Tracking
SENTRY_DSN = os.getenv('SENTRY_DSN', '')

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        send_default_pii=False,
    )
