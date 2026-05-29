"""
Management command for vault diagnostics and emergency recovery.

Usage:
    # Diagnose vault state for a user:
    docker-compose exec api python manage.py vault_recovery \
        --username tarcisio

    # Test if a master password can unlock the vault:
    docker-compose exec api python manage.py vault_recovery \
        --username tarcisio --test-password "sua_senha_mestre"

    # Force-reset vault (saves snapshot first, then soft-deletes items):
    docker-compose exec api python manage.py vault_recovery \
        --username tarcisio --reset --confirm

    # Restore vault from snapshot saved by --reset:
    docker-compose exec api python manage.py vault_recovery \
        --username tarcisio \
        --restore-snapshot \
        /app/media/vault_snapshots/vault_reset_tarcisio_20260224.json

    # Force-restore even if DB already has a newer VaultConfig:
    docker-compose exec api python manage.py vault_recovery \
        --username tarcisio \
        --restore-snapshot \
        /app/media/vault_snapshots/vault_reset_tarcisio_20260224.json \
        --force-restore

NOTE: After restoring a SQL backup that includes VaultConfig, you do
NOT need to run --restore-snapshot. Just start the containers and
unlock the vault via the UI or API
(POST /api/v1/security/vault/unlock/) with the original master
password.
--restore-snapshot is only needed when the SQL backup was taken AFTER running
--reset --confirm (which deletes VaultConfig from the database).
"""

import base64
import json
import os
from datetime import datetime
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

SNAPSHOT_DIR = "/app/media/vault_snapshots"
_BACKUP_KEY_ENV = "BACKUP_ENCRYPTION_KEY_PREVIOUS"


class Command(BaseCommand):
    help = "Diagnose, reset, or restore the security vault for a user."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--username",
            required=True,
            help="Username to inspect/reset/restore.",
        )
        parser.add_argument(
            "--test-password",
            metavar="MASTER_PASSWORD",
            help=(
                "Test whether the given master password can unlock"
                " the vault (derives the key and attempts to decrypt"
                " the vault_key in DB)."
            ),
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            default=False,
            help=(
                "Soft-delete all vault items and remove VaultConfig. "
                "A snapshot is saved before deletion. DESTRUCTIVE."
            ),
        )
        parser.add_argument(
            "--confirm",
            action="store_true",
            default=False,
            help="Required together with --reset to confirm the operation.",
        )
        parser.add_argument(
            "--restore-snapshot",
            metavar="SNAPSHOT_FILE",
            help=(
                "Path to a snapshot JSON file (created by --reset) "
                "to restore VaultConfig and undelete vault items. "
                "Only use this when VaultConfig is missing from the DB. "
                "If restoring from a full SQL backup, just unlock"
                " via the API instead."
            ),
        )
        parser.add_argument(
            "--force-restore",
            action="store_true",
            default=False,
            help=(
                "Allow --restore-snapshot to overwrite an existing"
                " VaultConfig in the database. Without this flag,"
                " the command aborts if a VaultConfig already exists"
                " (to avoid corrupting a good restore)."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        from members.models import Member
        from security.models import (
            Archive,
            Password,
            StoredBankAccount,
            StoredCreditCard,
            VaultConfig,
        )

        username = options["username"]
        do_reset = options["reset"]
        confirmed = options["confirm"]
        snapshot_file = options["restore_snapshot"]
        force_restore = options["force_restore"]
        test_password = options.get("test_password")

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' not found.")

        try:
            member = Member.objects.get(user=user)
        except Member.DoesNotExist:
            raise CommandError(
                f"No active Member record found for user '{username}'."
            )

        models = (
            Password,
            StoredCreditCard,
            StoredBankAccount,
            Archive,
            VaultConfig,
        )

        if snapshot_file:
            self._restore_snapshot(
                snapshot_file, member, user, force_restore, *models
            )
            return

        self._diagnose(username, user, member, test_password, *models)

        if do_reset and not confirmed:
            raise CommandError(
                "Pass --confirm together with --reset "
                "to confirm the destructive operation."
            )

        if do_reset and confirmed:
            self._reset(username, user, member, *models)

    # ------------------------------------------------------------------ #
    # Diagnosis                                                            #
    # ------------------------------------------------------------------ #

    def _diagnose(
        self,
        username: str,
        user: Any,
        member: Any,
        test_password: Any,
        Password: type[Any],
        StoredCreditCard: type[Any],
        StoredBankAccount: type[Any],
        Archive: type[Any],
        VaultConfig: type[Any],
    ) -> None:
        self.stdout.write(
            f"\n=== Vault Diagnostics for '{username}'"
            f" (user_id={user.id}) ===\n"
        )
        self.stdout.write(f"Member      : {member.name} (id={member.id})")

        try:
            vault_config = VaultConfig.objects.get(owner=member)
        except VaultConfig.DoesNotExist:
            self.stdout.write(
                self.style.WARNING("VaultConfig : NOT CONFIGURED")
            )
            self.stdout.write(
                "\nThe vault is not configured — "
                "the user can run setup freely.\n"
            )
            return

        self.stdout.write(f"VaultConfig : EXISTS (id={vault_config.id})")
        created_str = vault_config.created_at.astimezone().strftime(
            "%Y-%m-%d %H:%M:%S %Z"
        )
        self.stdout.write(f"  Created   : {created_str}")
        updated_str = vault_config.updated_at.astimezone().strftime(
            "%Y-%m-%d %H:%M:%S %Z"
        )
        self.stdout.write(f"  Updated   : {updated_str}")

        salt_ok = False
        try:
            salt_bytes = base64.b64decode(vault_config.salt.encode())
            self.stdout.write(f"  Salt      : OK ({len(salt_bytes)} bytes)")
            salt_ok = True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  Salt      : CORRUPT ({e})"))

        evk_len = (
            len(vault_config.encrypted_vault_key)
            if vault_config.encrypted_vault_key
            else 0
        )
        self.stdout.write(f"  EV-Key len: {evk_len} chars")

        pw_count = Password.objects.filter(owner=member).count()
        card_count = StoredCreditCard.objects.filter(owner=member).count()
        acc_count = StoredBankAccount.objects.filter(owner=member).count()
        arch_count = Archive.objects.filter(owner=member).count()
        total = pw_count + card_count + acc_count + arch_count

        self.stdout.write("\nVault items :")
        self.stdout.write(f"  Passwords      : {pw_count}")
        self.stdout.write(f"  Credit Cards   : {card_count}")
        self.stdout.write(f"  Bank Accounts  : {acc_count}")
        self.stdout.write(f"  Archives       : {arch_count}")
        self.stdout.write(f"  Total          : {total}")

        # Test the master password if supplied
        if test_password:
            self.stdout.write("\nPassword test:")
            if not salt_ok:
                self.stdout.write(
                    self.style.ERROR(
                        "  SKIPPED — salt is corrupt, cannot derive key."
                    )
                )
            else:
                self._test_password(vault_config, test_password)
        else:
            self.stdout.write(
                '\nTip: pass --test-password "<senha_mestre>" to verify '
                "whether the master password can unlock this vault.\n"
            )

        # Report BACKUP_ENCRYPTION_KEY_PREVIOUS status
        backup_key = os.getenv(_BACKUP_KEY_ENV)
        if backup_key:
            self.stdout.write(
                self.style.WARNING(
                    f"\n[INFO] {_BACKUP_KEY_ENV} is set.\n"
                    "  A previous encryption key is available as a fallback.\n"
                    "  If any app-level encrypted field fails to"
                    " decrypt (e.g.\n"
                    "  CredentialShareToken, Account, CreditCard,"
                    " Member), run:\n"
                    "    python manage.py rotate_encryption_key \\\n"
                    f"      --old-key ${{BACKUP_ENCRYPTION_KEY_PREVIOUS}} \\\n"
                    "      --new-key ${ENCRYPTION_KEY}\n"
                    "  to re-encrypt those records with the current key.\n"
                )
            )
        else:
            self.stdout.write(
                f"\n[INFO] {_BACKUP_KEY_ENV} is not set "
                "(normal when no key rotation has occurred)."
            )

        # Only show recovery hint when there is a detectable problem
        if not salt_ok or not vault_config.encrypted_vault_key:
            self.stdout.write(
                self.style.WARNING(
                    "\n[!] VaultConfig appears corrupt"
                    " (bad salt or missing key).\n"
                    "Recovery options:\n"
                    "  A. Restore from a SQL backup that has a valid"
                    " VaultConfig,\n"
                    "     then unlock the vault via the API with the"
                    " master password.\n"
                    "  B. Force-reset (--reset --confirm): saves a"
                    " snapshot first,\n"
                    "     then soft-deletes vault items and removes"
                    " VaultConfig.\n"
                    "     Restore later with --restore-snapshot"
                    " <file>.\n"
                )
            )

    def _test_password(self, vault_config: Any, master_password: str) -> None:
        """Try to decrypt the vault_key with the given master password."""
        from app.encryption import DecryptionError
        from security.vault_crypto import VaultEncryption

        try:
            salt = base64.b64decode(vault_config.salt.encode())
            derived_key = VaultEncryption.derive_key(master_password, salt)
            VaultEncryption.decrypt_vault_key(
                vault_config.encrypted_vault_key, derived_key
            )
            self.stdout.write(
                self.style.SUCCESS(
                    "  PASS — master password is correct. "
                    "The vault can be unlocked via the API.\n"
                    "  POST /api/v1/security/vault/unlock/"
                    " with your master password.\n"
                )
            )
        except DecryptionError:
            self.stdout.write(
                self.style.ERROR(
                    "  FAIL — master password is INCORRECT.\n"
                    "  Possible causes:\n"
                    "  1. The SQL backup or --restore-snapshot"
                    " loaded a VaultConfig\n"
                    "     that was created with a different master"
                    " password.\n"
                    "  2. The master password was changed via"
                    " 'change-master-password'\n"
                    "     and you are entering the old one.\n"
                    "  3. Typo, extra spaces, or encoding difference"
                    " in the password.\n"
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"  ERROR — unexpected failure: {e}")
            )

    # ------------------------------------------------------------------ #
    # Snapshot                                                             #
    # ------------------------------------------------------------------ #

    def _save_snapshot(
        self,
        username: str,
        user: Any,
        member: Any,
        vault_config: Any,
        Password: type[Any],
        StoredCreditCard: type[Any],
        StoredBankAccount: type[Any],
        Archive: type[Any],
    ) -> str:
        """Persist VaultConfig credentials + item IDs to a JSON file."""
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(SNAPSHOT_DIR, f"vault_reset_{username}_{ts}.json")

        pw_ids = list(
            Password.objects.filter(owner=member).values_list("id", flat=True)
        )
        card_ids = list(
            StoredCreditCard.objects.filter(owner=member).values_list(
                "id", flat=True
            )
        )
        acc_ids = list(
            StoredBankAccount.objects.filter(owner=member).values_list(
                "id", flat=True
            )
        )
        arch_ids = list(
            Archive.objects.filter(owner=member).values_list("id", flat=True)
        )

        snapshot = {
            "username": username,
            "user_id": user.id,
            "member_id": member.id,
            "snapshot_created_at": datetime.now().isoformat(),
            "vault_config": {
                "id": vault_config.id,
                "owner_id": member.id,
                "salt": vault_config.salt,
                "encrypted_vault_key": vault_config.encrypted_vault_key,
                "created_at": vault_config.created_at.isoformat(),
                "updated_at": vault_config.updated_at.isoformat(),
            },
            "soft_deleted_item_ids": {
                "passwords": pw_ids,
                "credit_cards": card_ids,
                "bank_accounts": acc_ids,
                "archives": arch_ids,
            },
        }

        with open(path, "w") as f:
            json.dump(snapshot, f, indent=2)

        return path

    # ------------------------------------------------------------------ #
    # Reset                                                                #
    # ------------------------------------------------------------------ #

    def _reset(
        self,
        username: str,
        user: Any,
        member: Any,
        Password: type[Any],
        StoredCreditCard: type[Any],
        StoredBankAccount: type[Any],
        Archive: type[Any],
        VaultConfig: type[Any],
    ) -> None:
        try:
            vault_config = VaultConfig.objects.get(owner=member)
        except VaultConfig.DoesNotExist:
            self.stdout.write(
                self.style.WARNING("VaultConfig not found — nothing to reset.")
            )
            return

        pw_count = Password.objects.filter(owner=member).count()
        card_count = StoredCreditCard.objects.filter(owner=member).count()
        acc_count = StoredBankAccount.objects.filter(owner=member).count()
        arch_count = Archive.objects.filter(owner=member).count()
        total = pw_count + card_count + acc_count + arch_count

        # Always save snapshot BEFORE any deletion.
        try:
            snapshot_path = self._save_snapshot(
                username,
                user,
                member,
                vault_config,
                Password,
                StoredCreditCard,
                StoredBankAccount,
                Archive,
            )
        except OSError as e:
            raise CommandError(
                f"Could not write snapshot to {SNAPSHOT_DIR}: {e}\n"
                "Aborting reset to prevent unrecoverable data loss."
            )

        self.stdout.write(
            self.style.SUCCESS(f"\n[SNAPSHOT] Saved to: {snapshot_path}")
        )

        self.stdout.write(
            self.style.ERROR(
                f"\n[RESET] Soft-deleting {total} vault items "
                f"and removing VaultConfig for '{username}'..."
            )
        )

        from django.core.cache import cache
        from django.db import transaction

        with transaction.atomic():
            now = timezone.now()

            deleted_pws = Password.objects.filter(owner=member).update(
                is_deleted=True, deleted_at=now
            )
            deleted_cards = StoredCreditCard.objects.filter(
                owner=member
            ).update(is_deleted=True, deleted_at=now)
            deleted_accs = StoredBankAccount.objects.filter(
                owner=member
            ).update(is_deleted=True, deleted_at=now)
            deleted_archs = Archive.objects.filter(owner=member).update(
                is_deleted=True, deleted_at=now
            )

            vault_config.delete()
            cache.delete(f"vault_key:{user.id}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n[DONE] Reset complete.\n"
                f"  Soft-deleted: {deleted_pws} passwords, "
                f"{deleted_cards} cards, "
                f"{deleted_accs} accounts, {deleted_archs} archives.\n"
                f"  VaultConfig deleted.\n"
                f"\nTo restore, run:\n"
                f"  python manage.py vault_recovery"
                f" --username {username}"
                f" --restore-snapshot {snapshot_path}\n"
                f"\nThe user can also set up a new vault master password.\n"
            )
        )

    # ------------------------------------------------------------------ #
    # Restore                                                              #
    # ------------------------------------------------------------------ #

    def _restore_snapshot(
        self,
        snapshot_file: str,
        member: Any,
        user: Any,
        force_restore: bool,
        Password: type[Any],
        StoredCreditCard: type[Any],
        StoredBankAccount: type[Any],
        Archive: type[Any],
        VaultConfig: type[Any],
    ) -> None:
        """Restore VaultConfig from a snapshot and undelete recorded items."""
        try:
            with open(snapshot_file) as f:
                snapshot = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"Snapshot file not found: {snapshot_file}")
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid snapshot file: {e}")

        if snapshot.get("member_id") != member.id:
            raise CommandError(
                f"Snapshot member_id ({snapshot['member_id']}) does not "
                f"match current member id ({member.id}). Refusing to restore."
            )

        vc_data = snapshot["vault_config"]
        item_ids = snapshot["soft_deleted_item_ids"]

        self.stdout.write(
            f"\n=== Vault Restore for '{snapshot['username']}' ===\n"
        )
        self.stdout.write(
            f"Snapshot created : {snapshot['snapshot_created_at']}"
        )
        self.stdout.write(
            f"VaultConfig (original id={vc_data['id']},"
            f" created={vc_data['created_at'][:19]})"
        )

        # Guard: warn and abort if VaultConfig already exists in DB.
        # A full SQL backup restore already includes VaultConfig — running
        # --restore-snapshot on top would overwrite it with a potentially
        # older/mismatched config, breaking the vault.
        existing_vc = VaultConfig.objects.filter(owner=member).first()
        if existing_vc and not force_restore:
            existing_updated = existing_vc.updated_at.isoformat()
            snapshot_updated = vc_data.get("updated_at", "unknown")
            self.stdout.write(
                self.style.ERROR(
                    "\n[ABORTED] VaultConfig already exists in the database.\n"
                    f"  DB VaultConfig updated_at  : {existing_updated}\n"
                    f"  Snapshot VaultConfig updated_at: {snapshot_updated}\n"
                    "\nIf you restored from a full SQL backup, the"
                    " VaultConfig is\n"
                    "already present — you do NOT need"
                    " --restore-snapshot.\n"
                    "Just unlock the vault via the API with your"
                    " master password:\n"
                    "  POST /api/v1/security/vault/unlock/\n"
                    "\nTo verify the password works first, run:\n"
                    f"  python manage.py vault_recovery"
                    f" --username {snapshot['username']}"
                    ' --test-password "<sua_senha_mestre>"\n'
                    "\nIf you are SURE you want to overwrite the"
                    " existing VaultConfig\n"
                    "with the snapshot data, re-run with"
                    " --force-restore.\n"
                    "WARNING: this may make vault items unreadable if the key "
                    "versions do not match.\n"
                )
            )
            return

        from django.core.cache import cache
        from django.db import transaction

        with transaction.atomic():
            if existing_vc:
                existing_vc.salt = vc_data["salt"]
                existing_vc.encrypted_vault_key = vc_data[
                    "encrypted_vault_key"
                ]
                existing_vc.save(update_fields=["salt", "encrypted_vault_key"])
                self.stdout.write(
                    self.style.WARNING(
                        f"  VaultConfig overwritten"
                        f" (--force-restore, id={existing_vc.id})."
                    )
                )
            else:
                VaultConfig.objects.create(
                    owner=member,
                    salt=vc_data["salt"],
                    encrypted_vault_key=vc_data["encrypted_vault_key"],
                )
                self.stdout.write("  VaultConfig created.")

            restored_pws = Password.all_objects.filter(
                id__in=item_ids["passwords"], is_deleted=True
            ).update(is_deleted=False, deleted_at=None, deleted_by_id=None)
            restored_cards = StoredCreditCard.all_objects.filter(
                id__in=item_ids["credit_cards"], is_deleted=True
            ).update(is_deleted=False, deleted_at=None, deleted_by_id=None)
            restored_accs = StoredBankAccount.all_objects.filter(
                id__in=item_ids["bank_accounts"], is_deleted=True
            ).update(is_deleted=False, deleted_at=None, deleted_by_id=None)
            restored_archs = Archive.all_objects.filter(
                id__in=item_ids["archives"], is_deleted=True
            ).update(is_deleted=False, deleted_at=None, deleted_by_id=None)

            cache.delete(f"vault_key:{user.id}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n[DONE] Restore complete.\n"
                f"  Restored: {restored_pws} passwords, "
                f"{restored_cards} cards, "
                f"{restored_accs} accounts, {restored_archs} archives.\n"
                "\nUnlock the vault with the ORIGINAL master password:\n"
                "  POST /api/v1/security/vault/unlock/\n"
                "\nOr verify the password first:\n"
                f"  python manage.py vault_recovery"
                f" --username {snapshot['username']}"
                ' --test-password "<sua_senha_mestre>"\n'
            )
        )
