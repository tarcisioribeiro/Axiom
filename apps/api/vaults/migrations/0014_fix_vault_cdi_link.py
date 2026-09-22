"""
Corrige cofres cuja descrição indica rendimento atrelado a um índice
(CDI/SELIC) mas que estão com ``yield_index_type='none'`` — ou seja, com a
taxa anual congelada num snapshot antigo, sem nunca mais sincronizar com o
índice real (a tarefa periódica ``calculate_daily_yields`` só chama
``refresh_annual_rate_from_index()`` quando ``yield_index_type`` é
``cdi``/``selic``).

Isso causava a divergência entre o rendimento realmente creditado (calculado
sobre a taxa congelada) e a prévia (``yield-preview``, que sempre consulta o
CDI ao vivo): o cofre "Rendimentos Mercado Pago" foi cadastrado como 120% do
CDI, mas ficou preso em 15% a.a. enquanto o CDI real já rendia mais.

Não recalcula ``annual_yield_rate`` aqui (evita depender da API do BCB
durante a migração); a tarefa periódica já existente faz isso na próxima
execução, agora que o cofre volta a apontar para o índice correto.
"""

from django.db import migrations

# UUID do cofre "Rendimentos Mercado Pago", cadastrado como 120% do CDI mas
# com o link para o índice perdido (yield_index_type='none').
VAULT_UUID = "036326e6-2022-4476-8737-d787473027f1"


def forwards(apps, schema_editor):
    Vault = apps.get_model("vaults", "Vault")
    Vault.objects.filter(uuid=VAULT_UUID, yield_index_type="none").update(
        yield_index_type="cdi",
        yield_index_percentage=120,
    )


def backwards(apps, schema_editor):
    Vault = apps.get_model("vaults", "Vault")
    Vault.objects.filter(uuid=VAULT_UUID).update(
        yield_index_type="none",
        yield_index_percentage=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "vaults",
            "0013_vault_yield_index_percentage_vault_yield_index_type",
        ),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
