# Generated manually to remove unique constraint from institution_name
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='account',
            name='institution_name',
            field=models.CharField(
                choices=[
                    ('NUB', 'Nubank'),
                    ('SIC', 'Sicoob'),
                    ('MPG', 'Mercado Pago'),
                    ('IFB', 'Ifood Benefícios'),
                    ('CEF', 'Caixa Econômica Federal')
                ],
                default='CEF',
                max_length=200,
                verbose_name='Institution'
            ),
        ),
    ]
