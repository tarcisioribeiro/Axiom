"""
Django management command to hard-delete soft-deleted sensitive/PII records
after a configurable retention period, in compliance with LGPD/GDPR.

Usage:
    python manage.py purge_deleted_records [--days N] [--dry-run]

Default retention period: 90 days.

Before each hard-delete the command:
  1. Anonymizes PII fields on the instance and persists that anonymized state
     to the database (so the next DB backup sees clean data).
  2. Emits a structured JSON line to the ``compliance`` logger
     (compliance.log) for audit purposes.
  3. Creates an immutable DeletionRecord row for audit reporting.
  4. Writes an ActivityLog entry via the existing security audit trail.
"""

import logging
from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

compliance_logger = logging.getLogger("compliance")


class Command(BaseCommand):
    help = (
        "Hard-delete soft-deleted sensitive/PII records older than N days "
        "(LGPD/GDPR compliance)."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help=(
                "Retention period in days (default: 90). Records"
                " soft-deleted more than this many days ago will"
                " be purged."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simulate the purge without making any changes.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        days = options["days"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(days=days)

        mode = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.WARNING(
                f"{mode}Purging soft-deleted sensitive records "
                f"(cutoff: {days} days, before {cutoff.date()})..."
            )
        )

        total_purged = 0
        results = {}

        for label, model, anonymize_fn in self._get_sensitive_models():
            qs = model.all_objects.filter(
                is_deleted=True, deleted_at__lte=cutoff
            )
            count = qs.count()
            results[label] = count

            if count == 0:
                self.stdout.write(f"  {label}: 0 records eligible")
                continue

            self.stdout.write(f"  {label}: {count} record(s) eligible")

            if not dry_run:
                for instance in qs.iterator():
                    try:
                        self._anonymize_and_save(instance, anonymize_fn)
                        self._emit_compliance_log(instance, label)
                        self._create_deletion_record(instance, label)
                        self._log_purge(instance, label)
                        instance.delete()
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f"    ERROR purging {label}"
                                f" id={instance.pk}: {e}"
                            )
                        )
                        count -= 1

            total_purged += count

        separator = "-" * 50
        self.stdout.write(separator)
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] {total_purged} record(s) would be purged. "
                    "No changes were made."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Done. {total_purged} record(s) purged.")
            )

    # ------------------------------------------------------------------
    # Sensitive model registry
    # ------------------------------------------------------------------

    def _get_sensitive_models(self) -> list[Any]:
        """
        Returns a list of (label, Model, anonymize_fn) tuples for all
        sensitive/PII models that require LGPD/GDPR compliance purging.
        """
        from accounts.models import Account
        from credit_cards.models import CreditCard
        from members.models import Member
        from security.models import (
            Archive,
            Password,
            StoredBankAccount,
            StoredCreditCard,
        )

        return [
            ("members.Member", Member, self._anonymize_member),
            ("accounts.Account", Account, self._anonymize_account),
            (
                "credit_cards.CreditCard",
                CreditCard,
                self._anonymize_credit_card,
            ),
            ("security.Password", Password, self._anonymize_password),
            (
                "security.StoredCreditCard",
                StoredCreditCard,
                self._anonymize_stored_card,
            ),
            (
                "security.StoredBankAccount",
                StoredBankAccount,
                self._anonymize_stored_bank_account,
            ),
            ("security.Archive", Archive, self._anonymize_archive),
        ]

    # ------------------------------------------------------------------
    # Anonymization + save
    # ------------------------------------------------------------------

    def _anonymize_and_save(self, instance: Any, anonymize_fn: Any) -> None:
        """
        Anonymize PII fields and persist the clean state to the database
        before hard-deletion.  If the model exposes a first-class
        ``anonymize()`` method (e.g. Member) we call that; otherwise we
        fall back to the legacy inline function.

        Using update_fields limits the UPDATE to only the columns we are
        intentionally blanking, avoiding unintended side-effects.
        """
        if hasattr(instance, "anonymize"):
            instance.anonymize()
            instance.save(
                update_fields=self._anonymize_update_fields(instance)
            )
        else:
            anonymize_fn(instance)
            instance.save()

    def _anonymize_update_fields(self, instance: Any) -> list[str]:
        """Return the DB column names that anonymize() touches per model."""
        from members.models import Member

        if isinstance(instance, Member):
            return [
                "name",
                "_document",
                "document_hash",
                "phone",
                "email",
                "address",
                "birth_date",
                "emergency_contact",
                "occupation",
                "notes",
            ]
        return []

    # ------------------------------------------------------------------
    # Anonymization functions — clear PII/encrypted fields before purge
    # (used for models that do not yet have a first-class anonymize())
    # ------------------------------------------------------------------

    def _anonymize_member(self, instance: Any) -> None:
        """Delegate to the model's own anonymize() method."""
        instance.anonymize()

    def _anonymize_account(self, instance: Any) -> None:
        """Clear encrypted account number."""
        instance._account_number = None

    def _anonymize_credit_card(self, instance: Any) -> None:
        """Clear encrypted card credentials."""
        instance._card_number = None
        instance._security_code = None

    def _anonymize_password(self, instance: Any) -> None:
        """Clear encrypted password payload."""
        instance._password = None

    def _anonymize_stored_card(self, instance: Any) -> None:
        """Clear encrypted stored card credentials."""
        instance._card_number = None
        instance._security_code = None

    def _anonymize_stored_bank_account(self, instance: Any) -> None:
        """Clear encrypted banking credentials."""
        instance._account_number = None
        instance._password = None
        instance._digital_password = None

    def _anonymize_archive(self, instance: Any) -> None:
        """Clear encrypted text and delete associated file from storage."""
        instance._encrypted_text = None
        if instance.encrypted_file:
            try:
                instance.encrypted_file.delete(save=False)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Compliance logging
    # ------------------------------------------------------------------

    def _emit_compliance_log(self, instance: Any, label: str) -> None:
        """
        Emit a structured JSON line to the ``compliance`` logger so that
        each hard-deletion is traceable in compliance.log.

        Fields emitted:
          event      — fixed string "record_purged"
          model      — dotted model label (e.g. "members.Member")
          pk         — database primary key of the deleted row
          uuid       — UUID field value (referential integrity anchor)
          deleted_at — ISO-8601 timestamp of the original soft-delete
          purged_at  — ISO-8601 timestamp of this hard-delete
        """
        compliance_logger.info(
            "record_purged",
            extra={
                "event": "record_purged",
                "model": label,
                "pk": str(instance.pk),
                "uuid": str(instance.uuid),
                "deleted_at": (
                    instance.deleted_at.isoformat()
                    if instance.deleted_at
                    else None
                ),
                "purged_at": timezone.now().isoformat(),
            },
        )

    def _create_deletion_record(self, instance: Any, label: str) -> None:
        """Create an immutable DeletionRecord for audit reporting."""
        try:
            from security.models import DeletionRecord

            DeletionRecord.objects.create(
                record_uuid=instance.uuid,
                model_name=label,
                deleted_at=instance.deleted_at,
            )
        except Exception:
            # DeletionRecord failure must never block the purge itself.
            pass

    # ------------------------------------------------------------------
    # Audit logging (ActivityLog)
    # ------------------------------------------------------------------

    def _log_purge(self, instance: Any, label: str) -> None:
        """Write an immutable ActivityLog entry recording the hard delete."""
        try:
            from security.models import ActivityLog

            ActivityLog.log_action(
                user=None,
                action="purge",
                description=(
                    f"Registro {label} id={instance.pk}"
                    f" (uuid={instance.uuid}) permanentemente"
                    " removido por política de retenção LGPD/GDPR."
                ),
                model_name=label,
                object_id=instance.pk,
                ip_address=None,
                user_agent="management_command:purge_deleted_records",
                description_key="record.purge",
                description_params={
                    "label": label,
                    "id": instance.pk,
                    "uuid": str(instance.uuid),
                },
            )
        except Exception:
            # ActivityLog failure must never block the purge itself.
            pass
