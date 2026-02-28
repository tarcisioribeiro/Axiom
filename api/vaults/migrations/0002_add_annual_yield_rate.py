from django.db import migrations, models
from decimal import Decimal


def migrate_daily_to_annual_rate(apps, schema_editor):
    """
    Migra a taxa diária para taxa anual.
    annual_rate = daily_rate * 365
    """
    Vault = apps.get_model('vaults', 'Vault')
    for vault in Vault.objects.all():
        if vault.yield_rate and vault.yield_rate > 0:
            vault.annual_yield_rate = vault.yield_rate * Decimal('365')
            vault.save(update_fields=['annual_yield_rate'])


def migrate_annual_to_daily_rate(apps, schema_editor):
    """
    Reverte: migra a taxa anual para taxa diária.
    daily_rate = annual_rate / 365
    """
    Vault = apps.get_model('vaults', 'Vault')
    for vault in Vault.objects.all():
        if vault.annual_yield_rate and vault.annual_yield_rate > 0:
            vault.yield_rate = vault.annual_yield_rate / Decimal('365')
            vault.save(update_fields=['yield_rate'])


class Migration(migrations.Migration):

    dependencies = [
        ('vaults', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='vault',
            name='annual_yield_rate',
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal('0.0000'),
                help_text='Taxa de rendimento anual (ex: 0.1200 = 12% ao ano)',
                max_digits=8,
                verbose_name='Taxa de Rendimento Anual'
            ),
        ),
        migrations.AlterField(
            model_name='vault',
            name='yield_rate',
            field=models.DecimalField(
                decimal_places=6,
                default=Decimal('0.000000'),
                help_text='Taxa de rendimento diária (legado) - use annual_yield_rate',
                max_digits=10,
                verbose_name='Taxa de Rendimento Diária (legado)'
            ),
        ),
        migrations.RunPython(
            migrate_daily_to_annual_rate,
            migrate_annual_to_daily_rate
        ),
    ]
