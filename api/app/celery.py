import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")

app = Celery("axiom")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # Gera notificações para todos os membros ativos a cada hora.
    "generate-all-notifications-hourly": {
        "task": "notifications.tasks.generate_all_notifications",
        "schedule": crontab(minute=0),
    },
    # Calcula rendimentos diários de vaults com taxa configurada.
    "calculate-vault-yields-daily": {
        "task": "vaults.tasks.calculate_daily_yields",
        "schedule": crontab(hour=1, minute=0),
    },
    # Gera instâncias de despesas/receitas fixas no 1º dia de cada mês.
    "generate-fixed-expenses-monthly": {
        "task": "expenses.tasks.generate_fixed_expenses_for_month",
        "schedule": crontab(hour=0, minute=30, day_of_month=1),
    },
    # Gera instâncias de receitas fixas no 1º dia de cada mês.
    "generate-fixed-revenues-monthly": {
        "task": "revenues.tasks.generate_fixed_revenues_for_month",
        "schedule": crontab(hour=0, minute=45, day_of_month=1),
    },
    # Insights proativos semanais (segunda-feira às 08h BRT).
    "generate-weekly-insights-monday": {
        "task": "agents.tasks.generate_weekly_insights_all_users",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),
    },
    # Fecha faturas vencidas diariamente (substitui cron externo).
    "close-overdue-bills-daily": {
        "task": "credit_cards.tasks.close_overdue_bills",
        "schedule": crontab(hour=2, minute=0),
    },
    # Busca cotações PTAX do BCB em dias úteis às 14h
    # (após fechamento PTAX das 13h).
    "fetch-ptax-rates-weekdays": {
        "task": "exchange_rates.fetch_ptax_rates",
        "schedule": crontab(hour=14, minute=0, day_of_week="1-5"),
    },
}
