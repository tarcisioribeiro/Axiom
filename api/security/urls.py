from django.urls import path
from security.views import (
    # Password views
    PasswordListCreateView,
    PasswordDetailView,
    PasswordRevealView,
    PasswordGenerateView,
    # Stored Credit Card views
    StoredCreditCardListCreateView,
    StoredCreditCardDetailView,
    StoredCreditCardRevealView,
    # Stored Bank Account views
    StoredBankAccountListCreateView,
    StoredBankAccountDetailView,
    StoredBankAccountRevealView,
    # Archive views
    ArchiveListCreateView,
    ArchiveDetailView,
    ArchiveRevealView,
    ArchiveDownloadView,
    # Activity Log views
    ActivityLogListView,
    # Dashboard views
    SecurityDashboardStatsView,
)

urlpatterns = [
    # Dashboard
    path('dashboard/stats/', SecurityDashboardStatsView.as_view(), name='security-dashboard-stats'),

    # Passwords
    path('passwords/', PasswordListCreateView.as_view(), name='password-list-create'),
    path('passwords/generate/', PasswordGenerateView.as_view(), name='password-generate'),
    path('passwords/<int:pk>/', PasswordDetailView.as_view(), name='password-detail'),
    path('passwords/<int:pk>/reveal/', PasswordRevealView.as_view(), name='password-reveal'),

    # Stored Credit Cards
    path('stored-cards/', StoredCreditCardListCreateView.as_view(), name='stored-card-list-create'),
    path('stored-cards/<int:pk>/', StoredCreditCardDetailView.as_view(), name='stored-card-detail'),
    path('stored-cards/<int:pk>/reveal/', StoredCreditCardRevealView.as_view(), name='stored-card-reveal'),

    # Stored Bank Accounts
    path('stored-accounts/', StoredBankAccountListCreateView.as_view(), name='stored-account-list-create'),
    path('stored-accounts/<int:pk>/', StoredBankAccountDetailView.as_view(), name='stored-account-detail'),
    path('stored-accounts/<int:pk>/reveal/', StoredBankAccountRevealView.as_view(), name='stored-account-reveal'),

    # Archives
    path('archives/', ArchiveListCreateView.as_view(), name='archive-list-create'),
    path('archives/<int:pk>/', ArchiveDetailView.as_view(), name='archive-detail'),
    path('archives/<int:pk>/reveal/', ArchiveRevealView.as_view(), name='archive-reveal'),
    path('archives/<int:pk>/download/', ArchiveDownloadView.as_view(), name='archive-download'),

    # Activity Logs
    path('activity-logs/', ActivityLogListView.as_view(), name='activity-log-list'),
]
