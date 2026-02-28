from django.urls import path

from . import views

urlpatterns = [
    # Cofres CRUD
    path("vaults/", views.VaultListCreateView.as_view(), name="vault-list-create"),
    path("vaults/<int:pk>/", views.VaultDetailView.as_view(), name="vault-detail"),
    # Operações de cofre
    path(
        "vaults/<int:pk>/deposit/",
        views.VaultDepositView.as_view(),
        name="vault-deposit",
    ),
    path(
        "vaults/<int:pk>/withdraw/",
        views.VaultWithdrawView.as_view(),
        name="vault-withdraw",
    ),
    path(
        "vaults/<int:pk>/apply-yield/",
        views.VaultApplyYieldView.as_view(),
        name="vault-apply-yield",
    ),
    path(
        "vaults/<int:pk>/update-yield/",
        views.VaultUpdateYieldView.as_view(),
        name="vault-update-yield",
    ),
    # Transações
    path(
        "vaults/<int:pk>/transactions/",
        views.VaultTransactionListView.as_view(),
        name="vault-transactions",
    ),
    path(
        "vault-transactions/",
        views.AllVaultTransactionsView.as_view(),
        name="all-vault-transactions",
    ),
    path(
        "vault-transactions/<int:pk>/",
        views.VaultTransactionUpdateView.as_view(),
        name="vault-transaction-update",
    ),
    # Metas Financeiras CRUD
    path(
        "financial-goals/",
        views.FinancialGoalListCreateView.as_view(),
        name="financial-goal-list-create",
    ),
    path(
        "financial-goals/<int:pk>/",
        views.FinancialGoalDetailView.as_view(),
        name="financial-goal-detail",
    ),
    # Operações de Metas
    path(
        "financial-goals/<int:pk>/check-completion/",
        views.FinancialGoalCheckCompletionView.as_view(),
        name="financial-goal-check-completion",
    ),
    path(
        "financial-goals/<int:pk>/add-vaults/",
        views.FinancialGoalAddVaultsView.as_view(),
        name="financial-goal-add-vaults",
    ),
    path(
        "financial-goals/<int:pk>/remove-vaults/",
        views.FinancialGoalRemoveVaultsView.as_view(),
        name="financial-goal-remove-vaults",
    ),
]
