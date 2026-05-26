from django.urls import path

from admin_panel.views import (
    AdminAgentsStatusView,
    AdminEmailTestView,
    AdminHealthView,
    AdminIntegrationsView,
    AdminLogsView,
    AdminRestartAllView,
    SystemConfigDetailView,
    SystemConfigListView,
)

urlpatterns = [
    path("config/", SystemConfigListView.as_view(), name="admin-config-list"),
    path(
        "config/<str:key>/",
        SystemConfigDetailView.as_view(),
        name="admin-config-detail",
    ),
    path("health/", AdminHealthView.as_view(), name="admin-health"),
    path(
        "integrations/",
        AdminIntegrationsView.as_view(),
        name="admin-integrations",
    ),
    path("logs/", AdminLogsView.as_view(), name="admin-logs"),
    path("email/test/", AdminEmailTestView.as_view(), name="admin-email-test"),
    path(
        "agents/status/",
        AdminAgentsStatusView.as_view(),
        name="admin-agents-status",
    ),
    path("restart/", AdminRestartAllView.as_view(), name="admin-restart-all"),
]
