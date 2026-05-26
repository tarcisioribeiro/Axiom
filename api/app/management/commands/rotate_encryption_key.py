"""
Management command to rotate the ENCRYPTION_KEY (Fernet) without data loss.

IMPORTANT: Take a full database backup before running this command:
    docker compose exec db pg_dump -U $DB_USER axiom_db \\
        > backups/pre_rotation_$(date +%%Y%%m%%d_%%H%%M%%S).sql

Usage:
    # Dry-run (validates and counts; no writes):
    python manage.py rotate_encryption_key \\
        --old-key <OLD_FERNET_KEY> --new-key <NEW_FERNET_KEY> --dry-run

    # Live rotation (runs inside a single DB transaction):
    python manage.py rotate_encryption_key \\
        --old-key <OLD_FERNET_KEY> --new-key <NEW_FERNET_KEY>

After a successful rotation:
    1. Update ENCRYPTION_KEY in .env with the --new-key value.
    2. Move the old key to BACKUP_ENCRYPTION_KEY_PREVIOUS in .env.
    3. Rebuild: docker compose up --build -d

Note on vault items (security.Password, StoredCreditCard,
StoredBankAccount, Archive):
    These fields use per-user vault-key encryption.  The app key is
    only used as a fallback when a vault has never been configured.
    Records encrypted with vault_key are automatically skipped
    ("skipped" counter) and do NOT need re-encryption here.
"""

import hashlib
import hmac as hmac_lib
from typing import Any, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cryptography.fernet import Fernet, InvalidToken


def _decrypt(encrypted_data: str, key: bytes) -> Optional[str]:
    """Decrypt with an explicit Fernet key; return None on failure."""
    if not encrypted_data:
        return None
    try:
        return Fernet(key).decrypt(encrypted_data.encode()).decode()
    except (InvalidToken, Exception):
        return None


def _encrypt(data: str, key: bytes) -> str:
    return Fernet(key).encrypt(data.encode()).decode()


def _hmac_sha256(document: str, key_str: str) -> str:
    """Recomputes HMAC-SHA256 of document using the given key string."""
    return hmac_lib.new(
        key_str.encode(), document.encode(), hashlib.sha256
    ).hexdigest()


class Command(BaseCommand):
    help = (
        "Rotate ENCRYPTION_KEY: decrypt all app-level encrypted fields"
        " with the old key and re-encrypt them with the new key."
        " Runs inside a single transaction."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--old-key",
            default=None,
            metavar="FERNET_KEY",
            help=(
                "Current Fernet key (44-char base64). Must match"
                " the key used when the data was originally encrypted."
            ),
        )
        parser.add_argument(
            "--new-key",
            default=None,
            metavar="FERNET_KEY",
            help=(
                "New Fernet key (44-char base64). Generate with: "
                'python -c "from cryptography.fernet import Fernet; '
                'print(Fernet.generate_key().decode())"'
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Iterate and decrypt all fields but make no writes.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        old_key_str: str = options["old_key"]
        new_key_str: str = options["new_key"]
        dry_run: bool = options["dry_run"]

        if not old_key_str:
            raise CommandError("--old-key is required.")
        if not new_key_str:
            raise CommandError("--new-key is required.")

        try:
            old_key = old_key_str.encode()
            Fernet(old_key)
        except Exception as e:
            raise CommandError(f"--old-key is not a valid Fernet key: {e}")
        try:
            new_key = new_key_str.encode()
            Fernet(new_key)
        except Exception as e:
            raise CommandError(f"--new-key is not a valid Fernet key: {e}")

        if old_key == new_key:
            raise CommandError(
                "--old-key and --new-key are identical; nothing to do."
            )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\n[DRY-RUN] No writes will be committed.\n"
                )
            )

        totals = {"rotated": 0, "skipped": 0, "empty": 0}

        with transaction.atomic():
            self._rotate_accounts(old_key, new_key, dry_run, totals)
            self._rotate_credit_cards(old_key, new_key, dry_run, totals)
            self._rotate_members(
                old_key, old_key_str, new_key, new_key_str, dry_run, totals
            )
            self._rotate_share_tokens(old_key, new_key, dry_run, totals)
            self._rotate_vault_items(old_key, new_key, dry_run, totals)

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'[DRY-RUN] ' if dry_run else ''}Rotation complete.\n"
                f"  Fields rotated : {totals['rotated']}\n"
                f"  Fields skipped : {totals['skipped']}  "
                f"(vault-key-encrypted or decryption failed with old key)\n"
                f"  Fields empty   : {totals['empty']}\n"
            )
        )

        if not dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\nNext steps:\n"
                    f"  1. Set ENCRYPTION_KEY={new_key_str} in .env\n"
                    "  2. Set"
                    f" BACKUP_ENCRYPTION_KEY_PREVIOUS={old_key_str}"
                    " in .env\n"
                    "  3. Rebuild: docker compose up --build -d\n"
                )
            )

    # ------------------------------------------------------------------ #
    # Per-model rotators                                                   #
    # ------------------------------------------------------------------ #

    def _rotate_accounts(
        self,
        old_key: bytes,
        new_key: bytes,
        dry_run: bool,
        totals: dict[str, int],
    ) -> None:
        from accounts.models import Account

        self._rotate_model(
            Account,
            ["_account_number"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="accounts.Account",
        )

    def _rotate_credit_cards(
        self,
        old_key: bytes,
        new_key: bytes,
        dry_run: bool,
        totals: dict[str, int],
    ) -> None:
        from credit_cards.models import CreditCard

        self._rotate_model(
            CreditCard,
            ["_security_code", "_card_number"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="credit_cards.CreditCard",
        )

    def _rotate_members(
        self,
        old_key: bytes,
        old_key_str: str,
        new_key: bytes,
        new_key_str: str,
        dry_run: bool,
        totals: dict[str, int],
    ) -> None:
        """Rotate Member._document and recompute document_hash with
        the new HMAC key."""
        from members.models import Member

        qs = (
            Member.objects.exclude(_document=None)
            .exclude(_document="")
            .only("id", "_document", "document_hash")
        )
        count = qs.count()
        self.stdout.write(
            f"\nmembers.Member: {count} records with encrypted document"
        )

        to_update = []
        for obj in qs.iterator(chunk_size=200):
            raw = obj._document
            if not raw:
                totals["empty"] += 1
                continue

            plain = _decrypt(raw, old_key)
            if plain is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP Member pk={obj.pk} _document"
                        " — could not decrypt with old key"
                    )
                )
                totals["skipped"] += 1
                continue

            obj._document = _encrypt(plain, new_key)
            obj.document_hash = _hmac_sha256(plain, new_key_str)
            totals["rotated"] += 1
            to_update.append(obj)

        if to_update and not dry_run:
            Member.objects.bulk_update(
                to_update, ["_document", "document_hash"], batch_size=200
            )
            self.stdout.write(f"  Updated {len(to_update)} Member records")
        elif dry_run:
            self.stdout.write(
                f"  [DRY-RUN] Would update {len(to_update)} Member records"
            )
        else:
            self.stdout.write("  No records needed updating")

    def _rotate_share_tokens(
        self,
        old_key: bytes,
        new_key: bytes,
        dry_run: bool,
        totals: dict[str, int],
    ) -> None:
        from security.models import CredentialShareToken

        self._rotate_model(
            CredentialShareToken,
            ["_encrypted_password"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="security.CredentialShareToken",
        )

    def _rotate_vault_items(
        self,
        old_key: bytes,
        new_key: bytes,
        dry_run: bool,
        totals: dict[str, int],
    ) -> None:
        """
        Rotate vault model fields that fall back to app-key encryption.
        Records encrypted with vault_key (not app key) are silently skipped.
        """
        from security.models import (
            Archive,
            Password,
            StoredBankAccount,
            StoredCreditCard,
        )

        self._rotate_model(
            Password,
            ["_password"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="security.Password",
            best_effort=True,
        )
        self._rotate_model(
            StoredCreditCard,
            ["_card_number", "_security_code"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="security.StoredCreditCard",
            best_effort=True,
        )
        self._rotate_model(
            StoredBankAccount,
            ["_account_number", "_password", "_digital_password"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="security.StoredBankAccount",
            best_effort=True,
        )
        self._rotate_model(
            Archive,
            ["_encrypted_text"],
            old_key,
            new_key,
            dry_run,
            totals,
            label="security.Archive",
            best_effort=True,
        )

    # ------------------------------------------------------------------ #
    # Generic helper                                                       #
    # ------------------------------------------------------------------ #

    def _rotate_model(
        self,
        model_class: type[Any],
        field_names: list[str],
        old_key: bytes,
        new_key: bytes,
        dry_run: bool,
        totals: dict[str, int],
        label: str,
        best_effort: bool = False,
    ) -> None:
        """
        Rotate listed encrypted fields on a model using bulk_update.

        best_effort=True: silently skip fields whose decryption fails.
        Used for vault items that may be encrypted with vault_key, not app key.
        """
        from django.db.models import Q

        q = Q()
        for f in field_names:
            q |= Q(**{f"{f}__isnull": False}) & ~Q(**{f: ""})

        qs = model_class.objects.filter(q).only("id", *field_names)
        count = qs.count()
        self.stdout.write(f"\n{label}: {count} records to inspect")

        to_update = []
        for obj in qs.iterator(chunk_size=200):
            changed = False
            for field_name in field_names:
                raw = getattr(obj, field_name, None)
                if not raw:
                    totals["empty"] += 1
                    continue

                plain = _decrypt(raw, old_key)
                if plain is None:
                    if not best_effort:
                        self.stdout.write(
                            self.style.WARNING(
                                f"  SKIP {label} pk={obj.pk} {field_name}"
                                " — could not decrypt with old key"
                            )
                        )
                    totals["skipped"] += 1
                    continue

                setattr(obj, field_name, _encrypt(plain, new_key))
                totals["rotated"] += 1
                changed = True

            if changed:
                to_update.append(obj)

        if to_update and not dry_run:
            model_class.objects.bulk_update(
                to_update, field_names, batch_size=200
            )
            self.stdout.write(f"  Updated {len(to_update)} records")
        elif dry_run:
            self.stdout.write(
                f"  [DRY-RUN] Would update {len(to_update)} records"
            )
        else:
            self.stdout.write("  No records needed updating")
