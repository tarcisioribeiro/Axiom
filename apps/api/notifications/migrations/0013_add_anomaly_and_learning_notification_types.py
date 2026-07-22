from django.db import migrations, models

ALL_CHOICES = [
    ("task_today", "Tarefa do Dia"),
    ("task_overdue", "Tarefa Atrasada"),
    ("payable_due_soon", "Valor a Pagar Próximo do Vencimento"),
    ("payable_overdue", "Valor a Pagar Atrasado"),
    ("loan_due_soon", "Empréstimo Próximo do Vencimento"),
    ("loan_overdue", "Empréstimo Atrasado"),
    ("bill_due_soon", "Fatura Próxima do Vencimento"),
    ("bill_overdue", "Fatura Atrasada"),
    ("budget_warning", "Alerta de Orçamento"),
    ("budget_exceeded", "Orçamento Estourado"),
    ("financial_goal_reached", "Meta Financeira Atingida"),
    ("financial_goal_approaching", "Meta Financeira Próxima do Prazo"),
    ("agent_insight", "Insight do Agente"),
    ("reading_goal_achieved", "Meta de Leitura Atingida"),
    ("reading_goal_behind", "Meta de Leitura Atrasada"),
    ("reconciliation_pending", "Reconciliação Bancária Pendente"),
    ("stored_card_expiring", "Cartão Armazenado Próximo do Vencimento"),
    ("credential_share_accessed", "Credencial Acessada via Link"),
    ("vault_breach_detected", "Senha Comprometida em Vazamento"),
    ("vault_weekly_report", "Relatório Semanal de Segurança"),
    ("vault_anomaly_detected", "Anomalia Detectada no Cofre"),
    (
        "learning_weekly_recommendations",
        "Recomendações Semanais de Aprendizado",
    ),
]


class Migration(migrations.Migration):

    dependencies = [
        (
            "notifications",
            "0012_alter_notification_notification_type_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=ALL_CHOICES,
                max_length=40,
                verbose_name="Tipo",
            ),
        ),
        migrations.AlterField(
            model_name="notificationpreference",
            name="notification_type",
            field=models.CharField(
                choices=ALL_CHOICES,
                max_length=40,
                verbose_name="Tipo",
            ),
        ),
    ]
