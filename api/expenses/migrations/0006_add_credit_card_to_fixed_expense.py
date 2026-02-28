# Generated manually
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('credit_cards', '0002_alter_creditcard__security_code'),
        ('expenses', '0005_expense_related_loan_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='fixedexpense',
            name='credit_card',
            field=models.ForeignKey(
                blank=True,
                help_text='Cartão de crédito (se não for despesa de conta)',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='fixed_expenses',
                to='credit_cards.creditcard',
                verbose_name='Cartão de Crédito'
            ),
        ),
        migrations.AlterField(
            model_name='fixedexpense',
            name='account',
            field=models.ForeignKey(
                blank=True,
                help_text='Conta bancária (se não for despesa de cartão)',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to='accounts.account',
                verbose_name='Conta'
            ),
        ),
        migrations.AddIndex(
            model_name='fixedexpense',
            index=models.Index(fields=['credit_card', 'is_active'], name='expenses_fi_credit__idx'),
        ),
    ]
