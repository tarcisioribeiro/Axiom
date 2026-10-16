from django.urls import path

from admin_panel.permission_views import (
    PermissionUserDetailView,
    PermissionUserListView,
    ScreenCatalogView,
    ScreenDefaultsView,
)
from admin_panel.views import (
    AdminAgentsStatusView,
    AdminEmailTestView,
    AdminHealthView,
    AdminIntegrationsView,
    AdminLogsView,
    AdminRestartAllView,
    StaffDetailView,
    StaffListCreateView,
    SystemConfigDetailView,
    SystemConfigListView,
    SystemConfigRevealView,
)

urlpatterns = [
    path("config/", SystemConfigListView.as_view(), name="admin-config-list"),
    path(
        "config/<str:key>/",
        SystemConfigDetailView.as_view(),
        name="admin-config-detail",
    ),
    path(
        "config/<str:key>/reveal/",
        SystemConfigRevealView.as_view(),
        name="admin-config-reveal",
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
    path("staff/", StaffListCreateView.as_view(), name="admin-staff-list"),
    path(
        "staff/<int:pk>/", StaffDetailView.as_view(), name="admin-staff-detail"
    ),
    path(
        "permissions/screens/",
        ScreenCatalogView.as_view(),
        name="admin-permissions-screens",
    ),
    path(
        "permissions/users/",
        PermissionUserListView.as_view(),
        name="admin-permissions-users",
    ),
    path(
        "permissions/users/<int:pk>/",
        PermissionUserDetailView.as_view(),
        name="admin-permissions-user-detail",
    ),
    path(
        "permissions/defaults/",
        ScreenDefaultsView.as_view(),
        name="admin-permissions-defaults",
    ),
]
