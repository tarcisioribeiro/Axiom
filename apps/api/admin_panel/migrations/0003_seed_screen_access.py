"""
Concede aos usuários comuns existentes os acessos definidos em
documentation/admin-panel/migracao-permissoes-checklist.md e usa os mesmos
valores como padrão para novos cadastros. Valores congelados aqui de propósito:
mudanças futuras no registro de telas não devem alterar esta migração.
"""

from django.db import migrations

CRUD = ["view", "add", "change", "delete"]

GRANTS = {
    "planning.dashboard": ["view"],
    "planning.tasks_goals": CRUD,
    "planning.reflections": CRUD,
    "planning.weekly": ["view"],
    "planning.workout": CRUD,
    "planning.nutrition": CRUD,
    "planning.body_metrics": CRUD,
    "planning.wellness": CRUD,
    "finance.dashboard": ["view"],
    "finance.accounts": CRUD,
    "finance.credit_cards": CRUD + ["pay_bill", "reopen_bill", "renegotiate_bill"],
    "finance.members": CRUD,
    "finance.budgets": CRUD,
    "finance.financial_goals": CRUD,
    "finance.recurring": CRUD + ["generate"],
    "finance.rules_tags": CRUD + ["apply_rules"],
    "finance.transactions": CRUD + ["export"],
    "finance.transfers": CRUD,
    "finance.bills": CRUD + ["pay", "receive", "renegotiate"],
    "finance.vaults": CRUD
    + ["deposit", "withdraw", "apply_yield", "generate_contributions"],
    "finance.loans": CRUD + ["pay", "receive", "recalculate"],
    "finance.agenda": ["view", "apply_plan"],
    "finance.analytics": ["view"],
    "finance.financial_health": ["view"],
    "security.vault": ["view", "manage_vault"],
    "security.dashboard": ["view"],
    "security.passwords": CRUD + ["import"],
    "security.stored_cards": CRUD + ["reveal"],
    "security.stored_accounts": CRUD + ["reveal"],
    "security.archives": CRUD + ["reveal"],
    "security.activity_logs": ["view"],
    "intellect.dashboard": ["view"],
    "intellect.today": ["view"],
    "intellect.books": CRUD,
    "intellect.authors": CRUD,
    "intellect.publishers": CRUD,
    "intellect.courses": CRUD,
    "intellect.skills": CRUD,
    "intellect.flashcards": CRUD,
    "intellect.knowledge_graph": CRUD,
}


def seed(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserScreenAccess = apps.get_model("admin_panel", "UserScreenAccess")
    ScreenDefault = apps.get_model("admin_panel", "ScreenDefault")

    ScreenDefault.objects.bulk_create(
        [ScreenDefault(screen=k, actions=v) for k, v in GRANTS.items()],
        ignore_conflicts=True,
    )
    user_ids = User.objects.filter(is_staff=False, is_superuser=False).values_list(
        "id", flat=True
    )
    UserScreenAccess.objects.bulk_create(
        [
            UserScreenAccess(user_id=uid, screen=k, actions=v)
            for uid in user_ids
            for k, v in GRANTS.items()
        ],
        ignore_conflicts=True,
    )


def unseed(apps, schema_editor):
    apps.get_model("admin_panel", "UserScreenAccess").objects.all().delete()
    apps.get_model("admin_panel", "ScreenDefault").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("admin_panel", "0002_screen_access"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
