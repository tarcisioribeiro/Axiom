"""
Adiciona ``Vault.yield_tax_rate`` (IR sobre o rendimento) e a define para o
cofre "Rendimentos Mercado Pago".

O valor creditado pela instituição é líquido de IR (22,5% até 180 dias),
enquanto o cálculo anterior usava 120% do CDI bruto — por isso a prévia
mostrava ~R$ 3,07/dia contra ~R$ 2,37 realmente creditados (razão ≈ 0,775).
A taxa anual é recalculada na próxima execução de ``calculate_daily_yields``.
"""

from decimal import Decimal

from django.db import migrations, models

VAULT_UUID = "036326e6-2022-4476-8737-d787473027f1"


def forwards(apps, schema_editor):
    Vault = apps.get_model("vaults", "Vault")
    Vault.objects.filter(uuid=VAULT_UUID).update(
        yield_tax_rate=Decimal("0.2250")
    )


class Migration(migrations.Migration):

    dependencies = [
        ("vaults", "0014_fix_vault_cdi_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="vault",
            name="yield_tax_rate",
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal("0.0000"),
                help_text=(
                    "Alíquota de IR descontada do rendimento do índice (ex:"
                    " 0.2250 = 22,5%). Aplicada sobre a taxa diária do"
                    " índice, para que o rendimento creditado seja líquido,"
                    " como na instituição."
                ),
                max_digits=5,
                verbose_name="Alíquota de IR sobre o rendimento",
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
