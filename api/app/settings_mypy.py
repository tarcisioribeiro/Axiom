"""
Minimal Django settings used exclusively by the mypy pre-commit hook.

This module deliberately excludes third-party apps (django_admin_dracula,
corsheaders, rest_framework_simplejwt, django_filters, drf_spectacular)
because the mypy isolated virtualenv only installs the packages listed under
`additional_dependencies` in .pre-commit-config.yaml.  Those packages are
covered by `ignore_missing_imports = true` in pyproject.toml, so mypy will
type-check their usages without needing the real modules installed.

Do NOT use this module in development or production.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Not a real secret — only used during static analysis.
SECRET_KEY = "mypy-static-analysis-only-not-a-real-secret"  # noqa: S105

DEBUG = False

ALLOWED_HOSTS: list = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party — available in mypy additional_dependencies
    # (djangorestframework)
    "rest_framework",
    # First-party apps (local to api/)
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
    "security",
    "library",
    "personal_planning",
    "payables",
    "vaults",
    "notifications",
    "budgets",
    "bank_reconciliation",
    "agents",
    "receivables",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

LANGUAGE_CODE = "pt-BR"
TIME_ZONE = "America/Sao_Paulo"
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
