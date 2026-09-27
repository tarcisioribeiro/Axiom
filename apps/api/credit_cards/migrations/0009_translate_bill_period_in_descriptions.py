"""Troca o mês em inglês ("Sep/2026") pelo nome em pt-BR ("Setembro/2026")
nos textos gerados a partir de faturas: despesas de pagamento de fatura e
compras de renegociação."""

import re

from django.db import migrations

MONTHS = {
    "Jan": "Janeiro",
    "Feb": "Fevereiro",
    "Mar": "Março",
    "Apr": "Abril",
    "May": "Maio",
    "Jun": "Junho",
    "Jul": "Julho",
    "Aug": "Agosto",
    "Sep": "Setembro",
    "Oct": "Outubro",
    "Nov": "Novembro",
    "Dec": "Dezembro",
}

# (model, field, prefixo do texto gerado, tamanho máximo)
TARGETS = (
    ("expenses", "Expense", "description", r"Pagamento fatura .*? - ", 100),
    ("credit_cards", "CreditCardPurchase", "description", r"Renegociação Fatura .*? ", 200),
    ("credit_cards", "CreditCardPurchase", "notes", r"Renegociação da fatura ", None),
)


def _translate(apps, mapping):
    months = "|".join(re.escape(m) for m in mapping)
    for app_label, model_name, field, prefix, max_len in TARGETS:
        model = apps.get_model(app_label, model_name)
        pattern = re.compile(rf"^({prefix})({months})/(\d{{4}})")
        rows = model.objects.filter(**{f"{field}__regex": rf"^{prefix}"})
        for obj in rows.only("pk", field):
            old = getattr(obj, field) or ""
            new = pattern.sub(lambda m: f"{m[1]}{mapping[m[2]]}/{m[3]}", old, 1)
            if max_len:
                new = new[:max_len]
            if new != old:
                model.objects.filter(pk=obj.pk).update(**{field: new})


def forwards(apps, schema_editor):
    _translate(apps, MONTHS)


def backwards(apps, schema_editor):
    _translate(apps, {v: k for k, v in MONTHS.items()})


class Migration(migrations.Migration):
    dependencies = [
        ("credit_cards", "0008_alter_creditcard_deleted_by_and_more"),
        ("expenses", "0021_remove_fixedexpense_payment_method"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
