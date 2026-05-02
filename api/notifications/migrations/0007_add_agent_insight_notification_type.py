# Generated manually on 2026-05-02

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0006_add_financial_goal_notification_types'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('task_today', 'Tarefa do Dia'),
                    ('task_overdue', 'Tarefa Atrasada'),
                    ('payable_due_soon', 'Valor a Pagar Próximo do Vencimento'),
                    ('payable_overdue', 'Valor a Pagar Atrasado'),
                    ('loan_due_soon', 'Empréstimo Próximo do Vencimento'),
                    ('loan_overdue', 'Empréstimo Atrasado'),
                    ('bill_due_soon', 'Fatura Próxima do Vencimento'),
                    ('bill_overdue', 'Fatura Atrasada'),
                    ('budget_warning', 'Alerta de Orçamento'),
                    ('budget_exceeded', 'Orçamento Estourado'),
                    ('financial_goal_reached', 'Meta Financeira Atingida'),
                    ('financial_goal_approaching', 'Meta Financeira Próxima do Prazo'),
                    ('agent_insight', 'Insight do Agente'),
                ],
                max_length=30,
                verbose_name='Tipo',
            ),
        ),
        migrations.AlterField(
            model_name='notificationpreference',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('task_today', 'Tarefa do Dia'),
                    ('task_overdue', 'Tarefa Atrasada'),
                    ('payable_due_soon', 'Valor a Pagar Próximo do Vencimento'),
                    ('payable_overdue', 'Valor a Pagar Atrasado'),
                    ('loan_due_soon', 'Empréstimo Próximo do Vencimento'),
                    ('loan_overdue', 'Empréstimo Atrasado'),
                    ('bill_due_soon', 'Fatura Próxima do Vencimento'),
                    ('bill_overdue', 'Fatura Atrasada'),
                    ('budget_warning', 'Alerta de Orçamento'),
                    ('budget_exceeded', 'Orçamento Estourado'),
                    ('financial_goal_reached', 'Meta Financeira Atingida'),
                    ('financial_goal_approaching', 'Meta Financeira Próxima do Prazo'),
                    ('agent_insight', 'Insight do Agente'),
                ],
                max_length=30,
                verbose_name='Tipo',
            ),
        ),
    ]
