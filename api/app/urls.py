from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from app.health import (
    backup_health_check,
    health_check,
    live_check,
    ready_check,
)
from app.views import PurgeDeletedView, current_date

urlpatterns = [
    path("admin/", admin.site.urls),
    # Prometheus metrics endpoint (scraped by Prometheus in k8s)
    path("", include("django_prometheus.urls")),
    # Health check endpoints
    path("health/", health_check, name="health-check"),
    path("ready/", ready_check, name="ready-check"),
    path("live/", live_check, name="live-check"),
    path(
        "api/v1/health/backup/",
        backup_health_check,
        name="backup-health-check",
    ),
    # App utilities
    path("api/v1/app/current-date/", current_date, name="current-date"),
    path(
        "api/v1/admin/purge-deleted/",
        PurgeDeletedView.as_view(),
        name="admin-purge-deleted",
    ),
    # API endpoints
    path("api/v1/", include("authentication.urls")),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("credit_cards.urls")),
    path("api/v1/", include("expenses.urls")),
    path("api/v1/", include("loans.urls")),
    path("api/v1/", include("members.urls")),
    path("api/v1/", include("revenues.urls")),
    path("api/v1/", include("transfers.urls")),
    path("api/v1/dashboard/", include("dashboard.urls")),
    # Security Module
    path("api/v1/security/", include("security.urls")),
    # Library Module
    path("api/v1/library/", include("library.urls")),
    # Personal Planning Module
    path("api/v1/personal-planning/", include("personal_planning.urls")),
    # Payables Module
    path("api/v1/", include("payables.urls")),
    # Receivables Module
    path("api/v1/", include("receivables.urls")),
    # Vaults Module (Cofres)
    path("api/v1/", include("vaults.urls")),
    # Notifications Module
    path("api/v1/", include("notifications.urls")),
    # Budgets Module
    path("api/v1/", include("budgets.urls")),
    # Bank Reconciliation Module
    path("api/v1/", include("bank_reconciliation.urls")),
    # Agents Module
    path("api/v1/agents/", include("agents.urls")),
    # Admin Panel Module
    path("api/v1/admin/", include("admin_panel.urls")),
    # Webhooks outbound
    path("api/v1/", include("webhooks.urls")),
    # Exchange Rates (multi-currency)
    path("api/v1/", include("exchange_rates.urls")),
]

if settings.DEBUG:
    # API Documentation (OpenAPI/Swagger) — only exposed in development
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="redoc",
        ),
    ]
    urlpatterns += static(
        settings.STATIC_URL or "", document_root=settings.STATIC_ROOT
    )
    urlpatterns += static(
        settings.MEDIA_URL or "", document_root=settings.MEDIA_ROOT
    )
