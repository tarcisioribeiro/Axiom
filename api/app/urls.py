from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from app.health import health_check, ready_check, live_check
from app.views import current_date

urlpatterns = [
    path("admin/", admin.site.urls),
    # Prometheus metrics endpoint (scraped by Prometheus in k8s)
    path('', include('django_prometheus.urls')),
    # Health check endpoints
    path('health/', health_check, name='health-check'),
    path('ready/', ready_check, name='ready-check'),
    path('live/', live_check, name='live-check'),
    # App utilities
    path('api/v1/app/current-date/', current_date, name='current-date'),
    # API endpoints
    path('api/v1/', include('authentication.urls')),
    path('api/v1/', include('accounts.urls')),
    path('api/v1/', include('credit_cards.urls')),
    path('api/v1/', include('expenses.urls')),
    path('api/v1/', include('loans.urls')),
    path('api/v1/', include('members.urls')),
    path('api/v1/', include('revenues.urls')),
    path('api/v1/', include('transfers.urls')),
    path('api/v1/dashboard/', include('dashboard.urls')),
    # Security Module
    path('api/v1/security/', include('security.urls')),
    # Library Module
    path('api/v1/library/', include('library.urls')),
    # Personal Planning Module
    path('api/v1/personal-planning/', include('personal_planning.urls')),
    # Payables Module
    path('api/v1/', include('payables.urls')),
    # Vaults Module (Cofres)
    path('api/v1/', include('vaults.urls')),
    # Notifications Module
    path('api/v1/', include('notifications.urls')),
    # AI Assistant Module
    path('api/v1/ai/', include('ai_assistant.urls')),
    # API Documentation (OpenAPI/Swagger)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.STATIC_URL, document_root=settings.STATIC_ROOT
    )
    urlpatterns += static(
        settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
    )
