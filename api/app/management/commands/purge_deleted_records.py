"""
Django management command to hard-delete soft-deleted sensitive/PII records
after a configurable retention period, in compliance with LGPD/GDPR.

Usage:
    python manage.py purge_deleted_records [--days N] [--dry-run]

Default retention period: 90 days.
"""

import uuid
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = (
        "Hard-delete soft-deleted sensitive/PII records older than N days "
        "(LGPD/GDPR compliance)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Retention period in days (default: 90). Records soft-deleted "
            "more than this many days ago will be purged.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simulate the purge without making any changes.",
        )

    def handle(self, *args, **options):
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
            qs = model.objects.filter(is_deleted=True, deleted_at__lte=cutoff)
            count = qs.count()
            results[label] = count

            if count == 0:
                self.stdout.write(f"  {label}: 0 records eligible")
                continue

            self.stdout.write(f"  {label}: {count} record(s) eligible")

            if not dry_run:
                for instance in qs.iterator():
                    try:
                        anonymize_fn(instance)
                        self._log_purge(instance, label)
                        instance.delete()
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f"    ERROR purging {label} id={instance.pk}: {e}"
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

    def _get_sensitive_models(self):
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
            ("credit_cards.CreditCard", CreditCard, self._anonymize_credit_card),
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
    # Anonymization functions — clear PII/encrypted fields before purge
    # ------------------------------------------------------------------

    def _anonymize_member(self, instance):
        """Replace PII fields with placeholder values."""
        instance.name = "[REMOVIDO]"
        instance.document = str(uuid.uuid4())
        instance.phone = "[REMOVIDO]"
        instance.email = None
        instance.address = None
        instance.birth_date = None
        instance.emergency_contact = None
        instance.occupation = None
        instance.notes = None
        # Intentionally NOT saving — record will be hard-deleted immediately.

    def _anonymize_account(self, instance):
        """Clear encrypted account number."""
        instance._account_number = None

    def _anonymize_credit_card(self, instance):
        """Clear encrypted card credentials."""
        instance._card_number = None
        instance._security_code = None

    def _anonymize_password(self, instance):
        """Clear encrypted password payload."""
        instance._password = None

    def _anonymize_stored_card(self, instance):
        """Clear encrypted stored card credentials."""
        instance._card_number = None
        instance._security_code = None

    def _anonymize_stored_bank_account(self, instance):
        """Clear encrypted banking credentials."""
        instance._account_number = None
        instance._password = None
        instance._digital_password = None

    def _anonymize_archive(self, instance):
        """Clear encrypted text and delete associated file from storage."""
        instance._encrypted_text = None
        if instance.encrypted_file:
            try:
                instance.encrypted_file.delete(save=False)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Audit logging
    # ------------------------------------------------------------------

    def _log_purge(self, instance, label):
        """Write an immutable ActivityLog entry recording the hard delete."""
        try:
            from security.activity_logs.models import ActivityLog

            ActivityLog.log_action(
                user=None,
                action="purge",
                description=(
                    f"Registro {label} id={instance.pk} (uuid={instance.uuid}) "
                    "permanentemente removido por política de retenção LGPD/GDPR."
                ),
                model_name=label,
                object_id=instance.pk,
                ip_address=None,
                user_agent="management_command:purge_deleted_records",
            )
        except Exception:
            # ActivityLog failure must never block the purge itself.
            pass
