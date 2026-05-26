from django.urls import path

from .views import (
    BankStatementEntryManualMatchView,
    BankStatementEntryUpdateView,
    BankStatementImportCreateView,
    BankStatementImportDetailView,
    BankStatementImportListView,
    BankStatementMatchView,
)

urlpatterns = [
    path(
        "bank-reconciliation/imports/",
        BankStatementImportCreateView.as_view(),
        name="bank-reconciliation-import-create",
    ),
    path(
        "bank-reconciliation/imports/list/",
        BankStatementImportListView.as_view(),
        name="bank-reconciliation-import-list",
    ),
    path(
        "bank-reconciliation/imports/<int:pk>/",
        BankStatementImportDetailView.as_view(),
        name="bank-reconciliation-import-detail",
    ),
    path(
        "bank-reconciliation/imports/<int:pk>/match/",
        BankStatementMatchView.as_view(),
        name="bank-reconciliation-match",
    ),
    path(
        "bank-reconciliation/entries/<int:pk>/",
        BankStatementEntryUpdateView.as_view(),
        name="bank-reconciliation-entry-update",
    ),
    path(
        "bank-reconciliation/imports/<int:import_pk>/entries/<int:entry_pk>/match/",  # noqa: E501
        BankStatementEntryManualMatchView.as_view(),
        name="bank-reconciliation-entry-manual-match",
    ),
]
