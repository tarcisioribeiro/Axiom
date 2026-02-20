from django.urls import path

from security.vault_config import (
    VaultChangePasswordView,
    VaultLockView,
    VaultSetupView,
    VaultStatusView,
    VaultUnlockView,
)
from security.views import (  # noqa: E501  # Password/StoredCard/StoredBankAccount/Archive/ActivityLog/Dashboard views
    ActivityLogListView,
    ArchiveDetailView,
    ArchiveDownloadView,
    ArchiveListCreateView,
    ArchiveRevealView,
    PasswordDetailView,
    PasswordGenerateView,
    PasswordListCreateView,
    PasswordRevealView,
    SecurityDashboardStatsView,
    StoredBankAccountDetailView,
    StoredBankAccountListCreateView,
    StoredBankAccountRevealView,
    StoredCreditCardDetailView,
    StoredCreditCardListCreateView,
    StoredCreditCardRevealView,
)

urlpatterns = [
    # Vault config (senha mestre)
    path("vault/status/", VaultStatusView.as_view(), name="vault-status"),
    path("vault/setup/", VaultSetupView.as_view(), name="vault-setup"),
    path("vault/unlock/", VaultUnlockView.as_view(), name="vault-unlock"),
    path("vault/lock/", VaultLockView.as_view(), name="vault-lock"),
    path(
        "vault/change-master-password/",
        VaultChangePasswordView.as_view(),
        name="vault-change-password",
    ),
    # Dashboard
    path(
        "dashboard/stats/",
        SecurityDashboardStatsView.as_view(),
        name="security-dashboard-stats",
    ),
    # Passwords
    path("passwords/", PasswordListCreateView.as_view(), name="password-list-create"),
    path(
        "passwords/generate/", PasswordGenerateView.as_view(), name="password-generate"
    ),
    path("passwords/<int:pk>/", PasswordDetailView.as_view(), name="password-detail"),
    path(
        "passwords/<int:pk>/reveal/",
        PasswordRevealView.as_view(),
        name="password-reveal",
    ),
    # Stored Credit Cards
    path(
        "stored-cards/",
        StoredCreditCardListCreateView.as_view(),
        name="stored-card-list-create",
    ),
    path(
        "stored-cards/<int:pk>/",
        StoredCreditCardDetailView.as_view(),
        name="stored-card-detail",
    ),
    path(
        "stored-cards/<int:pk>/reveal/",
        StoredCreditCardRevealView.as_view(),
        name="stored-card-reveal",
    ),
    # Stored Bank Accounts
    path(
        "stored-accounts/",
        StoredBankAccountListCreateView.as_view(),
        name="stored-account-list-create",
    ),
    path(
        "stored-accounts/<int:pk>/",
        StoredBankAccountDetailView.as_view(),
        name="stored-account-detail",
    ),
    path(
        "stored-accounts/<int:pk>/reveal/",
        StoredBankAccountRevealView.as_view(),
        name="stored-account-reveal",
    ),
    # Archives
    path("archives/", ArchiveListCreateView.as_view(), name="archive-list-create"),
    path("archives/<int:pk>/", ArchiveDetailView.as_view(), name="archive-detail"),
    path(
        "archives/<int:pk>/reveal/", ArchiveRevealView.as_view(), name="archive-reveal"
    ),
    path(
        "archives/<int:pk>/download/",
        ArchiveDownloadView.as_view(),
        name="archive-download",
    ),
    # Activity Logs
    path("activity-logs/", ActivityLogListView.as_view(), name="activity-log-list"),
]
