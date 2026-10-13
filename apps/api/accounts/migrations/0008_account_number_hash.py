import os
from collections import defaultdict

from django.db import migrations, models


def fill_account_number_hashes(apps, schema_editor):
    """
    Preenche account_number_hash das contas existentes e aborta, listando os
    casos, se houver contas ativas duplicadas (mesmo usuário, instituição e
    número). Nada é apagado automaticamente. Contas cujo número não pode ser
    descriptografado ficam sem hash e são listadas no aviso.
    """
    from accounts.models import compute_account_number_hash
    from app.encryption import DecryptionError, FieldEncryption

    Account = apps.get_model("accounts", "Account")
    key = os.getenv("ENCRYPTION_KEY", "")

    accounts = list(
        Account.objects.exclude(_account_number__isnull=True).exclude(
            _account_number=""
        )
    )
    groups = defaultdict(list)
    undecryptable = []
    for account in accounts:
        try:
            plain = FieldEncryption.decrypt_data(account._account_number)
        except DecryptionError:
            undecryptable.append(account)
            continue
        account.account_number_hash = compute_account_number_hash(plain, key)
        if not account.is_deleted:
            groups[
                (
                    account.created_by_id,
                    account.institution_name,
                    account.account_number_hash,
                )
            ].append((account, plain))

    if undecryptable:
        print(
            "\nAviso: contas sem hash do número (não descriptografável com a "
            "ENCRYPTION_KEY atual):\n"
            + "\n".join(
                f"- id={a.pk} | {a.account_name}" for a in undecryptable
            )
        )
        accounts = [a for a in accounts if a not in undecryptable]

    duplicates = [items for items in groups.values() if len(items) > 1]
    if duplicates:
        lines = [
            f"- id={account.pk} | usuário={account.created_by_id} | "
            f"instituição={account.institution_name} | "
            f"nome={account.account_name} | número=****{plain[-4:]}"
            for items in duplicates
            for account, plain in items
        ]
        raise RuntimeError(
            "Migração bloqueada: existem contas duplicadas (mesma instituição "
            "e número para o mesmo usuário). Corrija-as e rode a migração de "
            "novo:\n" + "\n".join(lines)
        )

    Account.objects.bulk_update(
        accounts, ["account_number_hash"], batch_size=200
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_convert_wallet_accounts"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="account_number_hash",
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
                verbose_name="Hash do Número da Conta",
            ),
        ),
        migrations.RunPython(
            fill_account_number_hashes, migrations.RunPython.noop
        ),
        migrations.AddConstraint(
            model_name="account",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("account_number_hash__isnull", False),
                    ("is_deleted", False),
                ),
                fields=(
                    "created_by",
                    "institution_name",
                    "account_number_hash",
                ),
                name="unique_account_number_per_institution_per_user",
            ),
        ),
    ]
