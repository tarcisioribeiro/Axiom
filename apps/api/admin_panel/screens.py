"""
Registro de telas do frontend e das rotas da API que cada uma usa.

Fonte única do controle de acesso por tela: o `ScreenAccessMiddleware`
consulta este registro para decidir se uma requisição de usuário comum é
permitida, e o painel `/admin/permissions` lista telas e ações a partir dele.

Tipos de rota (valor de `routes`):
- ``"crud"``: ação derivada do método (GET→view, POST→add, PUT/PATCH→change,
  DELETE→delete).
- ``"read"``: só GET/HEAD/OPTIONS, exige ``view``.
- nome de ação (ex.: ``"deposit"``): qualquer método exige essa ação.
- ``dict`` método→ação, com ``"*"`` como padrão (ex.: GET vê, resto edita).

Uma rota pode aparecer em várias telas; basta ter acesso por uma delas.
Toda ação exige também ``view`` na mesma tela.
"""

from typing import Any

CRUD = ("view", "add", "change", "delete")

MODULES = {
    "planning": "Planejamento Pessoal",
    "finance": "Controle Financeiro",
    "security": "Segurança",
    "intellect": "Intelecto",
}

_VIEW_EDIT = {"GET": "view", "*": "change"}


def _crud(*names: str) -> dict[str, Any]:
    return {name: "crud" for name in names}


def _kind(kind: Any, *names: str) -> dict[str, Any]:
    return {name: kind for name in names}


_FINANCE_DASHBOARD_VIEWS = _kind(
    "view",
    "dashboard-stats",
    "dashboard-summary",
    "account-balances",
    "credit-card-expenses-by-category",
    "balance-forecast",
    "monthly-statement",
    "cash-flow-forecast",
    "debt-payoff-plan",
    "financial-alerts",
    "dashboard-anomalies",
    "alerts-stream",
    "health-score",
    "spending-insights",
)

_WORKOUT_CRUD = _crud(
    "exercise-list-create",
    "exercise-detail",
    "workout-plan-list-create",
    "workout-plan-detail",
    "workout-day-list-create",
    "workout-day-detail",
    "workout-exercise-list-create",
    "workout-exercise-detail",
    "workout-session-list-create",
    "workout-session-detail",
    "workout-session-exercise-list-create",
    "workout-session-exercise-detail",
    "workout-session-set-list-create",
    "workout-session-set-detail",
)

_NUTRITION_CRUD = _crud(
    "food-list-create",
    "food-detail",
    "meal-type-list-create",
    "meal-type-detail",
    "menu-option-list-create",
    "menu-option-detail",
    "menu-option-ingredient-list-create",
    "menu-option-ingredient-detail",
    "meal-log-list-create",
    "meal-log-detail",
    "water-log-list-create",
    "water-log-detail",
)

_TASK_INSTANCES = {
    **_crud("task-instance-list-create", "task-instance-detail"),
    "instances-for-date": "view",
    "task-instance-status-update": "change",
    "task-instance-bulk-update": "change",
}

_COURSES_CRUD = _crud(
    "course-list-create",
    "course-detail",
    "course-module-list-create",
    "course-module-detail",
    "course-lesson-list-create",
    "course-lesson-detail",
    "course-session-list-create",
    "course-session-detail",
)

_SHARE_REVOKE = {"share-token-revoke": "share"}

SCREENS: dict[str, dict[str, Any]] = {
    # ------------------------------------------------------------------
    # Planejamento Pessoal
    # ------------------------------------------------------------------
    "planning.dashboard": {
        "module": "planning",
        "label": "Dashboard",
        "path": "/planning/dashboard",
        "actions": ("view", "import_template"),
        "routes": {
            **_kind(
                "view",
                "personal-planning-dashboard-stats",
                "personal-planning-analytics",
                "routine-task-heatmap",
                "gamification-profile",
                "routine-template-list",
                "daily-caloric-summary",
            ),
            **_kind(
                "read",
                "routine-task-list-create",
                "workout-plan-list-create",
                "workout-session-list-create",
                "meal-log-list-create",
                "water-log-list-create",
                "body-metric-list-create",
                "hydration-goal",
            ),
            "user-routine-template-list-create": {
                "GET": "view",
                "*": "import_template",
            },
            "user-routine-template-detail": {
                "GET": "view",
                "*": "import_template",
            },
            "routine-template-import": "import_template",
            "user-routine-template-import": "import_template",
        },
    },
    "planning.tasks_goals": {
        "module": "planning",
        "label": "Tarefas e Metas",
        "path": "/planning/tasks-goals",
        "actions": CRUD + ("ai_suggest", "export"),
        "routes": {
            **_crud(
                "routine-task-list-create",
                "routine-task-detail",
                "focus-block-list-create",
                "focus-block-detail",
                "focus-block-task-list-create",
                "focus-block-task-detail",
                "goal-list-create",
                "goal-detail",
            ),
            **_TASK_INSTANCES,
            **_kind(
                "change",
                "goal-recalculate",
                "goal-restart",
                "goal-register-failure",
            ),
            **_kind("view", "gamification-profile", "routine-task-heatmap"),
            **_kind(
                "read",
                "meal-log-list-create",
                "water-log-list-create",
                "hydration-goal",
            ),
            "ai-routine-suggestion": "ai_suggest",
            "goals-export": "export",
            "routine-tasks-export": "export",
        },
    },
    "planning.reflections": {
        "module": "planning",
        "label": "Reflexões",
        "path": "/planning/reflections",
        "actions": CRUD + ("export",),
        "routes": {
            **_crud("daily-reflection-list-create", "daily-reflection-detail"),
            "reflections-export": "export",
        },
    },
    "planning.weekly": {
        "module": "planning",
        "label": "Planejamento Semanal",
        "path": "/planning/weekly-planning",
        "actions": ("view", "change"),
        "routes": dict(_TASK_INSTANCES),
    },
    "planning.workout": {
        "module": "planning",
        "label": "Treino",
        "path": "/planning/workout",
        "actions": CRUD + ("ai_generate", "export"),
        "routes": {
            **_WORKOUT_CRUD,
            **_kind(
                "view",
                "exercise-gif-stream",
                "exercise-thumbnail-stream",
                "exercise-dataset-list",
                "exercise-dataset-gif-stream",
                "exercise-dataset-thumbnail-stream",
            ),
            "body-metric-list-create": "read",
            "ai-workout-plan-generation": "ai_generate",
            "workout-sessions-export": "export",
        },
    },
    "planning.nutrition": {
        "module": "planning",
        "label": "Nutrição",
        "path": "/planning/nutrition",
        "actions": CRUD + ("ai_generate", "export"),
        "routes": {
            **_NUTRITION_CRUD,
            "hydration-goal": _VIEW_EDIT,
            **_kind(
                "view", "hydration-goal-suggestion", "daily-caloric-summary"
            ),
            "ai-menu-plan-generation": "ai_generate",
            "meal-logs-export": "export",
        },
    },
    "planning.body_metrics": {
        "module": "planning",
        "label": "Métricas Corporais",
        "path": "/planning/body-metrics",
        "actions": CRUD,
        "routes": {
            **_crud("body-metric-list-create", "body-metric-detail"),
            **_kind(
                "read",
                "workout-session-list-create",
                "workout-plan-list-create",
            ),
        },
    },
    "planning.wellness": {
        "module": "planning",
        "label": "Bem-estar Emocional",
        "path": "/planning/emotional-wellness",
        "actions": CRUD + ("ai_report",),
        "routes": {
            **_crud(
                "self-esteem-list-create",
                "self-esteem-detail",
                "emotional-checkin-list-create",
                "emotional-checkin-detail",
                "crisis-impulse-list-create",
                "crisis-impulse-detail",
                "wellness-intervention-list",
                "wellness-intervention-completion-list-create",
                "wellness-intervention-completion-detail",
            ),
            "wellness-dashboard": "view",
            "crisis-impulse-resolve": "change",
            "wellness-weekly-report-list": {"GET": "view", "*": "ai_report"},
            "wellness-weekly-report-generate": "ai_report",
        },
    },
    "planning.journey": {
        "module": "planning",
        "label": "Jornada",
        "path": "/planning/journey",
        "actions": ("view",),
        "routes": {
            **_kind(
                "view",
                "gamification-profile",
                "library-streak",
                "library-dashboard-stats",
            ),
            **_kind("read", "goal-list-create", "intellect-badge-list"),
        },
    },
    # ------------------------------------------------------------------
    # Controle Financeiro
    # ------------------------------------------------------------------
    "finance.dashboard": {
        "module": "finance",
        "label": "Dashboard",
        "path": "/dashboard",
        "actions": ("view",),
        "routes": {
            **_FINANCE_DASHBOARD_VIEWS,
            **_kind("read", "expense-create-list", "revenue-create-list"),
        },
    },
    "finance.accounts": {
        "module": "finance",
        "label": "Contas",
        "path": "/accounts",
        "actions": CRUD + ("reconcile",),
        "routes": {
            **_crud("account-create-list", "account-detail-view"),
            **_kind(
                "view", "account-projected-balance", "dashboard-reconciliation"
            ),
            **_kind(
                {"GET": "view", "*": "reconcile"},
                "bank-reconciliation-import-list",
                "bank-reconciliation-import-detail",
            ),
            **_kind(
                "reconcile",
                "bank-reconciliation-import-create",
                "bank-reconciliation-match",
                "bank-reconciliation-entry-update",
                "bank-reconciliation-entry-manual-match",
            ),
        },
    },
    "finance.credit_cards": {
        "module": "finance",
        "label": "Cartões",
        "path": "/credit-cards",
        "actions": CRUD + ("pay_bill", "reopen_bill", "renegotiate_bill"),
        "routes": {
            **_crud(
                "credit_card-create-list",
                "credit-card-detail-view",
                "credit_card-bill-create-list",
                "credit-card-bill-detail-view",
            ),
            "credit-card-bill-items": "view",
            "credit_card-installment-list": "read",
            "credit-card-installment-update": "change",
            "credit-card-bill-pay": "pay_bill",
            "credit-card-bill-reopen": "reopen_bill",
            "credit-card-bill-renegotiate": "renegotiate_bill",
            "account-create-list": "read",
        },
    },
    "finance.members": {
        "module": "finance",
        "label": "Membros",
        "path": "/members",
        "actions": CRUD,
        "routes": _crud("member-create-list", "member-detail-view"),
    },
    "finance.budgets": {
        "module": "finance",
        "label": "Orçamentos",
        "path": "/budgets",
        "actions": CRUD + ("ai_suggest",),
        "routes": {
            **_crud("budget-list-create", "budget-detail"),
            **_kind("view", "budget-status", "budget-history"),
            "budget-suggest": "ai_suggest",
            **_kind(
                "read", "expense-create-list", "credit_card-installment-list"
            ),
        },
    },
    "finance.financial_goals": {
        "module": "finance",
        "label": "Metas Financeiras",
        "path": "/financial-goals",
        "actions": CRUD,
        "routes": {
            **_crud("financial-goal-list-create", "financial-goal-detail"),
            **_kind(
                "change",
                "financial-goal-check-completion",
                "financial-goal-add-vaults",
                "financial-goal-remove-vaults",
            ),
            **_kind("read", "vault-list-create", "account-create-list"),
        },
    },
    "finance.recurring": {
        "module": "finance",
        "label": "Recorrências",
        "path": "/recurring",
        "actions": CRUD + ("generate",),
        "routes": {
            **_crud(
                "fixed-expense-list-create",
                "fixed-expense-detail",
                "fixed-revenue-list-create",
                "fixed-revenue-detail",
                "fixed-transfer-list-create",
                "fixed-transfer-detail",
            ),
            **_kind(
                "generate",
                "fixed-expense-generate",
                "fixed-revenue-generate",
                "fixed-transfer-generate",
            ),
            **_kind(
                "view",
                "fixed-expense-generated-months",
                "fixed-expense-stats",
                "fixed-expense-generation-log",
                "fixed-revenue-stats",
                "fixed-revenue-generated-months",
                "fixed-revenue-generation-log",
            ),
            **_kind(
                "read",
                "account-create-list",
                "credit_card-create-list",
                "expense-create-list",
                "revenue-create-list",
            ),
        },
    },
    "finance.rules_tags": {
        "module": "finance",
        "label": "Regras e Tags",
        "path": "/finance/rules-tags",
        "actions": CRUD + ("apply_rules",),
        "routes": {
            **_crud(
                "tag-list-create",
                "tag-detail",
                "automation-rule-list",
                "automation-rule-detail",
            ),
            "automation-rule-logs": "view",
            "automation-rule-apply": "apply_rules",
            "account-create-list": "read",
        },
    },
    "finance.transactions": {
        "module": "finance",
        "label": "Transações",
        "path": "/transactions",
        "actions": CRUD + ("export", "ocr"),
        "routes": {
            **_crud(
                "expense-create-list",
                "expense-detail-view",
                "revenue-create-list",
                "revenue-detail-view",
                "credit_card-purchase-create-list",
                "credit-card-purchase-detail-view",
            ),
            "expense-splits": _VIEW_EDIT,
            **_kind(
                "change",
                "expense-bulk-mark-paid",
                "credit-card-installment-update",
            ),
            "expense-suggest-category": "view",
            **_kind("export", "expense-export", "revenue-export"),
            "expense-ocr": "ocr",
            **_kind(
                "read",
                "account-create-list",
                "credit_card-create-list",
                "credit_card-bill-create-list",
                "credit_card-installment-list",
                "fixed-expense-list-create",
                "fixed-revenue-list-create",
                "loan-create-list",
                "payable-create-list",
                "automation-rule-list",
            ),
        },
    },
    "finance.transfers": {
        "module": "finance",
        "label": "Transferências",
        "path": "/transfers",
        "actions": CRUD,
        "routes": {
            **_crud("transfer-create-list", "transfer-detail-view"),
            **_kind(
                "read", "account-create-list", "credit_card-bill-create-list"
            ),
        },
    },
    "finance.bills": {
        "module": "finance",
        "label": "Contas a Pagar/Receber",
        "path": "/bills",
        "actions": CRUD + ("pay", "receive", "renegotiate"),
        "routes": {
            **_crud(
                "payable-create-list",
                "payable-detail-view",
                "receivable-create-list",
                "receivable-detail-view",
            ),
            **_kind(
                _VIEW_EDIT, "payable-installments", "receivable-installments"
            ),
            "payable-payment": "pay",
            "receivable-receipt": "receive",
            **_kind(
                "renegotiate",
                "payable-payment-plan",
                "payable-increase-value",
                "payable-recalculate-installments",
                "payable-redistribute-after-payment",
            ),
            **_kind(
                "read", "account-create-list", "credit_card-bill-create-list"
            ),
        },
    },
    "finance.vaults": {
        "module": "finance",
        "label": "Cofres",
        "path": "/vaults",
        "actions": CRUD
        + ("deposit", "withdraw", "apply_yield", "generate_contributions"),
        "routes": {
            **_crud(
                "vault-list-create",
                "vault-detail",
                "vault-recurring-contributions",
                "vault-recurring-contribution-detail",
            ),
            "vault-deposit": "deposit",
            "vault-withdraw": "withdraw",
            **_kind("apply_yield", "vault-apply-yield", "vault-update-yield"),
            "vault-generate-contributions": "generate_contributions",
            **_kind(
                "view",
                "vault-yield-preview",
                "vault-simulate",
                "vault-transactions",
                "all-vault-transactions",
                "vault-contribution-history",
            ),
            "vault-transaction-update": "change",
            **_kind(
                "read",
                "account-create-list",
                "credit_card-bill-create-list",
                "financial-goal-list-create",
            ),
        },
    },
    "finance.loans": {
        "module": "finance",
        "label": "Empréstimos",
        "path": "/loans",
        "actions": CRUD + ("pay", "receive", "recalculate"),
        "routes": {
            **_crud("loan-create-list", "loan-detail-view"),
            "loan-installments": _VIEW_EDIT,
            "loan-payment": "pay",
            "loan-receipt": "receive",
            "loan-recalculate-installments": "recalculate",
            **_kind("view", "loan-amortization", "loan-payment-plan"),
            **_kind(
                "read",
                "account-create-list",
                "credit_card-bill-create-list",
                "expense-create-list",
                "revenue-create-list",
            ),
        },
    },
    "finance.agenda": {
        "module": "finance",
        "label": "Agenda",
        "path": "/finance/agenda",
        "actions": ("view", "apply_plan"),
        "routes": {
            **_kind(
                "view", "monthly-plan-summary", "monthly-plan-apply-preview"
            ),
            "monthly-plan-detail": {"GET": "view", "*": "apply_plan"},
            "monthly-plan-apply": "apply_plan",
            **_kind(
                "read",
                "credit_card-bill-create-list",
                "expense-create-list",
                "loan-create-list",
                "payable-create-list",
                "receivable-create-list",
                "receivable-installments",
                "revenue-create-list",
                "transfer-create-list",
            ),
        },
    },
    "finance.analytics": {
        "module": "finance",
        "label": "Análises",
        "path": "/finance/analytics",
        "actions": ("view", "export"),
        "routes": {**_FINANCE_DASHBOARD_VIEWS, "ir-report": "export"},
    },
    "finance.financial_health": {
        "module": "finance",
        "label": "Saúde Financeira",
        "path": "/finance/financial-health",
        "actions": ("view",),
        "routes": {
            **_FINANCE_DASHBOARD_VIEWS,
            **_kind(
                "read",
                "account-create-list",
                "credit_card-create-list",
                "loan-create-list",
                "payable-create-list",
                "receivable-create-list",
                "receivable-installments",
                "vault-list-create",
                "financial-goal-list-create",
            ),
        },
    },
    # ------------------------------------------------------------------
    # Segurança
    # ------------------------------------------------------------------
    "security.vault": {
        "module": "security",
        "label": "Cofre (base do módulo)",
        "path": None,
        "actions": ("view", "manage_vault"),
        "routes": {
            # Base: criar o cofre na 1ª vez (o endpoint recusa se já existe),
            # destravar e travar. Sem isso nenhuma tela de Segurança funciona.
            **_kind(
                "view",
                "vault-status",
                "vault-setup",
                "vault-unlock",
                "vault-lock",
                "vault-recovery-unlock",
            ),
            **_kind(
                "manage_vault",
                "vault-change-password",
                "vault-recovery-key-generate",
                "vault-export-zip",
            ),
            **_kind(
                {"GET": "view", "*": "manage_vault"},
                "vault-preferences",
                "vault-alert-config",
            ),
        },
    },
    "security.dashboard": {
        "module": "security",
        "label": "Dashboard",
        "path": "/security/dashboard",
        "actions": ("view",),
        "routes": {
            **_kind(
                "view",
                "security-dashboard-stats",
                "password-health-report",
                "vault-health-history",
            ),
            "password-list-create": "read",
        },
    },
    "security.passwords": {
        "module": "security",
        "label": "Senhas",
        "path": "/security/passwords",
        "actions": CRUD + ("reveal", "share", "import", "check_breach"),
        "routes": {
            **_crud("password-list-create", "password-detail"),
            **_kind(
                "view",
                "password-generate",
                "password-health-report",
                "security-dashboard-stats",
            ),
            "password-favorite-toggle": "change",
            **_kind(
                "reveal",
                "password-reveal",
                "password-copy",
                "password-history",
                "password-totp-verify",
            ),
            "password-share-token-list-create": "share",
            **_SHARE_REVOKE,
            **_kind(
                "import", "password-import-preview", "password-import-confirm"
            ),
            "hibp-check": "check_breach",
        },
    },
    "security.stored_cards": {
        "module": "security",
        "label": "Cartões Armazenados",
        "path": "/security/stored-cards",
        "actions": CRUD + ("reveal", "share"),
        "routes": {
            **_crud("stored-card-list-create", "stored-card-detail"),
            "stored-card-favorite-toggle": "change",
            **_kind("reveal", "stored-card-reveal", "stored-card-copy"),
            "stored-card-share-token-list-create": "share",
            **_SHARE_REVOKE,
        },
    },
    "security.stored_accounts": {
        "module": "security",
        "label": "Contas Armazenadas",
        "path": "/security/stored-accounts",
        "actions": CRUD + ("reveal", "share"),
        "routes": {
            **_crud("stored-account-list-create", "stored-account-detail"),
            "stored-account-favorite-toggle": "change",
            **_kind("reveal", "stored-account-reveal", "stored-account-copy"),
            "stored-account-share-token-list-create": "share",
            **_SHARE_REVOKE,
        },
    },
    "security.archives": {
        "module": "security",
        "label": "Arquivos",
        "path": "/security/archives",
        "actions": CRUD + ("reveal",),
        "routes": {
            **_crud("archive-list-create", "archive-detail"),
            "archive-favorite-toggle": "change",
            **_kind("reveal", "archive-reveal", "archive-download"),
        },
    },
    "security.activity_logs": {
        "module": "security",
        "label": "Logs de Atividade",
        "path": "/security/activity-logs",
        "actions": ("view", "export"),
        "routes": {
            "activity-log-list": "view",
            "activity-log-export": "export",
        },
    },
    # ------------------------------------------------------------------
    # Intelecto
    # ------------------------------------------------------------------
    "intellect.dashboard": {
        "module": "intellect",
        "label": "Dashboard",
        "path": "/library/dashboard",
        "actions": ("view",),
        "routes": {
            **_kind("view", "library-dashboard-stats", "library-streak"),
            **_kind(
                "read",
                "course-list-create",
                "course-module-list-create",
                "course-lesson-list-create",
                "course-session-list-create",
                "skill-list-create",
            ),
        },
    },
    "intellect.today": {
        "module": "intellect",
        "label": "Hoje",
        "path": "/library/intellect-today",
        "actions": ("view",),
        "routes": {
            **_kind("view", "library-dashboard-stats", "library-streak"),
            **_kind(
                "read",
                "book-list-create",
                "course-list-create",
                "flashcard-list-create",
                "intellect-badge-list",
            ),
        },
    },
    "intellect.books": {
        "module": "intellect",
        "label": "Livros",
        "path": "/library/books",
        "actions": CRUD + ("ai_summary", "import", "export"),
        "routes": {
            **_crud(
                "book-list-create",
                "book-detail",
                "summary-list-create",
                "summary-detail",
                "reading-list-create",
                "reading-detail",
                "reading-goal-list-create",
                "reading-goal-detail",
                "literary-type-goal-list-create",
                "literary-type-goal-detail",
                "highlight-list-create",
                "highlight-detail",
            ),
            **_kind(
                "view",
                "book-cover-stream",
                "book-file-stream",
                "reading-queue",
                "author-photo-stream",
            ),
            "book-file": _VIEW_EDIT,
            **_kind("change", "book-mark-as-read", "reading-queue-reorder"),
            "book-ai-summary": "ai_summary",
            **_kind("import", "goodreads-import", "highlight-kindle-import"),
            "highlight-export": "export",
            **_kind("read", "author-list-create", "publisher-list-create"),
        },
    },
    "intellect.authors": {
        "module": "intellect",
        "label": "Autores",
        "path": "/library/authors",
        "actions": CRUD,
        "routes": {
            **_crud("author-list-create", "author-detail"),
            "author-photo-stream": "view",
        },
    },
    "intellect.publishers": {
        "module": "intellect",
        "label": "Editoras",
        "path": "/library/publishers",
        "actions": CRUD,
        "routes": _crud("publisher-list-create", "publisher-detail"),
    },
    "intellect.courses": {
        "module": "intellect",
        "label": "Cursos",
        "path": "/library/courses",
        "actions": CRUD,
        "routes": {
            **_COURSES_CRUD,
            **_kind(
                "change", "course-lesson-toggle", "course-lesson-bulk-complete"
            ),
            "course-certificate-stream": "view",
        },
    },
    "intellect.skills": {
        "module": "intellect",
        "label": "Habilidades",
        "path": "/library/skills",
        "actions": CRUD,
        "routes": {
            **_crud("skill-list-create", "skill-detail"),
            "skill-history": "view",
            **_kind(
                "read",
                "course-list-create",
                "course-module-list-create",
                "course-lesson-list-create",
                "course-session-list-create",
            ),
        },
    },
    "intellect.flashcards": {
        "module": "intellect",
        "label": "Flashcards",
        "path": "/library/flashcards",
        "actions": CRUD + ("generate",),
        "routes": {
            **_crud("flashcard-list-create", "flashcard-detail"),
            "flashcard-review": "change",
            "book-flashcards-generate": "generate",
            "book-list-create": "read",
        },
    },
    "intellect.knowledge_graph": {
        "module": "intellect",
        "label": "Grafo de Conhecimento",
        "path": "/library/knowledge-graph",
        "actions": CRUD + ("ai_suggest",),
        "routes": {
            **_crud("knowledge-link-list-create", "knowledge-link-detail"),
            "knowledge-graph": "view",
            "knowledge-graph-suggest-links": "ai_suggest",
        },
    },
}

# Rotas liberadas a qualquer usuário autenticado, independentemente de telas.
# Membro é o "dono" dos registros em todos os módulos, então ler a lista e o
# próprio perfil é permissão base; escrever exige a tela Membros.
BASE_ROUTES: dict[str, Any] = {
    "member-create-list": "read",
    "member-detail-view": "read",
    "member-photo-stream": "read",
    "current-user-member": "any",
    "member-profile-photo": "any",
}

# Rotas dentro dos prefixos dos módulos que ficam fora do controle por tela.
UNGUARDED_ROUTES = frozenset(
    {
        "lgpd-export",  # direito do titular (LGPD art. 18): sempre liberado
        "share-token-redeem",  # resgate por quem recebeu o link
    }
)

# Prefixos de URL (após /api/v1/) cobertos pelo controle por tela. Usado pelo
# teste que garante que nenhuma rota desses módulos fique fora do registro.
GUARDED_PREFIXES = (
    "accounts/",
    "automation-rules/",
    "bank-reconciliation/",
    "budgets/",
    "credit-cards",
    "dashboard/",
    "expenses/",
    "financial-goals/",
    "fixed-",
    "library/",
    "loans/",
    "members/",
    "monthly-plan/",
    "payables/",
    "personal-planning/",
    "receivables/",
    "revenues/",
    "security/",
    "tags/",
    "transfers/",
    "vault",
)

_METHOD_ACTION = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "add",
    "PUT": "change",
    "PATCH": "change",
    "DELETE": "delete",
}
_SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


def required_action(kind: Any, method: str) -> str | None:
    """Ação exigida por uma rota para o método; None = método não permitido."""
    if kind == "crud":
        return _METHOD_ACTION.get(method)
    if kind == "read":
        return "view" if method in _SAFE_METHODS else None
    if kind == "any":
        return "view"
    if isinstance(kind, dict):
        if method in _SAFE_METHODS and "GET" in kind:
            return str(kind["GET"])
        return kind.get(method, kind.get("*"))
    return str(kind)


def _build_route_index() -> dict[str, list[tuple[str, Any]]]:
    index: dict[str, list[tuple[str, Any]]] = {}
    for key, screen in SCREENS.items():
        for name, kind in screen["routes"].items():
            index.setdefault(name, []).append((key, kind))
    return index


ROUTE_INDEX = _build_route_index()


def effective_actions(grants: dict[str, list[str]]) -> dict[str, set[str]]:
    """Normaliza os acessos salvos: descarta ações desconhecidas e telas sem
    ``view``; libera status/desbloqueio do cofre a quem tem alguma tela de
    Segurança."""
    result: dict[str, set[str]] = {}
    for key, actions in grants.items():
        screen = SCREENS.get(key)
        if not screen or "view" not in actions:
            continue
        result[key] = set(actions) & set(screen["actions"])
    if any(SCREENS[k]["module"] == "security" for k in result):
        result.setdefault("security.vault", set()).add("view")
    return result


def is_allowed(
    url_name: str, method: str, actions: dict[str, set[str]]
) -> bool:
    """Decide o acesso de um usuário comum a uma rota registrada."""
    base_kind = BASE_ROUTES.get(url_name)
    if base_kind and required_action(base_kind, method):
        return True
    for screen_key, kind in ROUTE_INDEX.get(url_name, ()):
        needed = required_action(kind, method)
        if needed and needed in actions.get(screen_key, ()):
            return True
    return False


def is_registered(url_name: str) -> bool:
    return url_name in ROUTE_INDEX or url_name in BASE_ROUTES
