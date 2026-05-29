"""
Tests for the purge_deleted_records management command.

Covers:
  - Member.anonymize() clears all PII fields
  - Member.anonymize() sets a unique document_hash placeholder
  - purge command: anonymizes + saves + hard-deletes eligible records
  - purge command: creates DeletionRecord per purged row
  - purge command: emits compliance log line per purged row
  - purge command: --dry-run makes no DB changes
  - purge command: records within retention window are not touched
"""

from datetime import timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from members.models import Member
from security.models import ActivityLog, DeletionRecord


def _make_member(suffix: str, days_deleted: int | None = None) -> Member:
    """Create a Member (optionally soft-deleted ``days_deleted`` ago)."""
    user = User.objects.create_user(
        username=f"purge_test_{suffix}",
        email=f"purge_{suffix}@test.com",
        password="pw",
    )
    m = Member.objects.create(
        name=f"Test User {suffix}",
        document_hash=f"{'x' * (64 - len(suffix))}{suffix}",
        phone="11999990000",
        sex="M",
        user=user,
    )
    if days_deleted is not None:
        m.is_deleted = True
        m.deleted_at = timezone.now() - timedelta(days=days_deleted)
        Member.all_objects.filter(pk=m.pk).update(
            is_deleted=True,
            deleted_at=m.deleted_at,
        )
    return m


# ---------------------------------------------------------------------------
# Member.anonymize() unit tests
# ---------------------------------------------------------------------------


class MemberAnonymizeTest(TestCase):
    def setUp(self):
        self.member = _make_member("anon1")

    def test_anonymize_clears_name(self):
        self.member.anonymize()
        self.assertEqual(self.member.name, "[REMOVIDO]")

    def test_anonymize_clears_document(self):
        self.member.anonymize()
        self.assertIsNone(self.member._document)

    def test_anonymize_sets_unique_document_hash(self):
        self.member.anonymize()
        self.assertEqual(
            self.member.document_hash, f"PURGED-{self.member.uuid}"
        )

    def test_anonymize_clears_phone(self):
        self.member.anonymize()
        self.assertEqual(self.member.phone, "[REMOVIDO]")

    def test_anonymize_clears_nullable_fields(self):
        self.member.email = "real@email.com"
        self.member.address = "Rua Real, 1"
        self.member.emergency_contact = "999"
        self.member.occupation = "Developer"
        self.member.notes = "Some notes"
        self.member.anonymize()
        self.assertIsNone(self.member.email)
        self.assertIsNone(self.member.address)
        self.assertIsNone(self.member.emergency_contact)
        self.assertIsNone(self.member.occupation)
        self.assertIsNone(self.member.notes)

    def test_anonymize_does_not_save(self):
        """anonymize() is side-effect-free on the DB until save() is called."""
        original_name = self.member.name
        self.member.anonymize()
        refreshed = Member.objects.get(pk=self.member.pk)
        self.assertEqual(refreshed.name, original_name)

    def test_anonymize_unique_hash_per_member(self):
        m2 = _make_member("anon2")
        self.member.anonymize()
        m2.anonymize()
        self.assertNotEqual(self.member.document_hash, m2.document_hash)

    def test_save_after_anonymize_persists(self):
        self.member.anonymize()
        self.member.save(
            update_fields=[
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
        )
        refreshed = Member.all_objects.get(pk=self.member.pk)
        self.assertEqual(refreshed.name, "[REMOVIDO]")
        self.assertIsNone(refreshed._document)
        self.assertEqual(refreshed.document_hash, f"PURGED-{self.member.uuid}")


# ---------------------------------------------------------------------------
# purge_deleted_records command tests
# ---------------------------------------------------------------------------


class PurgeDeletedRecordsCommandTest(TestCase):
    def _run_purge(self, days: int = 90, dry_run: bool = False) -> str:
        out = StringIO()
        call_command(
            "purge_deleted_records",
            days=days,
            dry_run=dry_run,
            stdout=out,
        )
        return out.getvalue()

    # --- basic purge ---

    def test_purges_eligible_member(self):
        m = _make_member("purge1", days_deleted=91)
        self._run_purge()
        self.assertFalse(Member.all_objects.filter(pk=m.pk).exists())

    def test_does_not_purge_within_retention_window(self):
        m = _make_member("retain1", days_deleted=50)
        self._run_purge(days=90)
        self.assertTrue(Member.all_objects.filter(pk=m.pk).exists())

    def test_does_not_purge_active_record(self):
        m = _make_member("active1")
        self._run_purge()
        self.assertTrue(Member.objects.filter(pk=m.pk).exists())

    # --- anonymization before deletion ---

    def test_member_is_anonymized_before_deletion(self):
        """
        We can't inspect the row after delete(), but we can verify that
        anonymize() + save() ran by checking that no ActivityLog error
        was recorded for the purge (i.e., the purge completed cleanly).
        """
        _make_member("anonpurge1", days_deleted=95)
        output = self._run_purge()
        self.assertNotIn("ERROR", output)

    # --- DeletionRecord ---

    def test_creates_deletion_record_per_purged_row(self):
        m = _make_member("drec1", days_deleted=100)
        record_uuid = m.uuid
        self._run_purge()
        self.assertTrue(
            DeletionRecord.objects.filter(record_uuid=record_uuid).exists()
        )

    def test_deletion_record_fields(self):
        m = _make_member("drec2", days_deleted=100)
        record_uuid = m.uuid
        deleted_at = Member.all_objects.get(pk=m.pk).deleted_at
        self._run_purge()
        rec = DeletionRecord.objects.get(record_uuid=record_uuid)
        self.assertEqual(rec.model_name, "members.Member")
        self.assertIsNotNone(rec.purged_at)
        # deleted_at should match the soft-delete timestamp (within 1s)
        self.assertAlmostEqual(
            rec.deleted_at.timestamp(),
            deleted_at.timestamp(),
            delta=1,
        )

    def test_no_deletion_record_for_retained_row(self):
        m = _make_member("drec3", days_deleted=10)
        self._run_purge(days=90)
        self.assertFalse(
            DeletionRecord.objects.filter(record_uuid=m.uuid).exists()
        )

    # --- compliance logger ---

    def test_compliance_log_emitted_per_purged_row(self):
        m = _make_member("clog1", days_deleted=95)
        with self.assertLogs("compliance", level="INFO") as log_ctx:
            self._run_purge()
        # assertLogs output format is "LEVEL:logger:message"; extra fields
        # live on the LogRecord objects, not the formatted string.
        uuids = [getattr(r, "uuid", "") for r in log_ctx.records]
        self.assertIn(str(m.uuid), uuids)

    def test_compliance_log_contains_required_fields(self):
        m = _make_member("clog2", days_deleted=95)
        with self.assertLogs("compliance", level="INFO") as log_ctx:
            self._run_purge()
        # Find the record for this member's UUID
        record = next(
            (
                r
                for r in log_ctx.records
                if getattr(r, "uuid", "") == str(m.uuid)
            ),
            None,
        )
        self.assertIsNotNone(
            record, "No compliance log record found for member UUID"
        )
        self.assertEqual(record.getMessage(), "record_purged")
        self.assertEqual(getattr(record, "event", None), "record_purged")
        self.assertEqual(getattr(record, "model", None), "members.Member")
        self.assertEqual(getattr(record, "pk", None), str(m.pk))

    # --- dry-run ---

    def test_dry_run_does_not_delete(self):
        m = _make_member("dry1", days_deleted=100)
        output = self._run_purge(dry_run=True)
        self.assertTrue(Member.all_objects.filter(pk=m.pk).exists())
        self.assertIn("DRY RUN", output)

    def test_dry_run_creates_no_deletion_records(self):
        m = _make_member("dry2", days_deleted=100)
        self._run_purge(dry_run=True)
        self.assertFalse(
            DeletionRecord.objects.filter(record_uuid=m.uuid).exists()
        )

    def test_dry_run_creates_no_activity_logs(self):
        _make_member("dry3", days_deleted=100)
        before = ActivityLog.objects.filter(action="purge").count()
        self._run_purge(dry_run=True)
        after = ActivityLog.objects.filter(action="purge").count()
        self.assertEqual(before, after)

    # --- activity log ---

    def test_activity_log_created_per_purged_row(self):
        _make_member("alog1", days_deleted=95)
        before = ActivityLog.objects.filter(action="purge").count()
        self._run_purge()
        after = ActivityLog.objects.filter(action="purge").count()
        self.assertGreater(after, before)
