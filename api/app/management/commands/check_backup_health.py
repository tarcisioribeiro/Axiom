"""
Django management command — check whether a recent backup exists.

Reads the sentinel file written by api/scripts/backup.sh after each
successful backup and exits non-zero if the last backup is older than
the configured threshold (default: 24 h).

Usage:
    python manage.py check_backup_health
    python manage.py check_backup_health --max-age-hours 48
    python manage.py check_backup_health --backup-dir /backups

Exit codes:
    0   Last backup is within the allowed age window
    1   Backup is stale / sentinel not found / status shows failure

Integrate with external monitoring (Prometheus, UptimeRobot, cron alert):
    docker compose exec api python manage.py check_backup_health || alert
"""

import os
import sys
import time
from typing import Any

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Exit non-zero if no successful database backup exists"
        " within the last N hours."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--max-age-hours",
            type=float,
            default=26.0,
            help=(
                "Maximum acceptable age of the last successful backup"
                " in hours (default: 26, giving a 2-hour window"
                " past the daily schedule)."
            ),
        )
        parser.add_argument(
            "--backup-dir",
            default=os.environ.get("BACKUP_DIR", "/backups"),
            help=(
                "Directory where backup files are stored"
                " (default: /backups)."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        backup_dir = options["backup_dir"]
        max_age_seconds = options["max_age_hours"] * 3600

        sentinel = os.path.join(backup_dir, ".last_successful_backup")
        status_file = os.path.join(backup_dir, ".last_backup_status")

        # ── Check sentinel file ──────────────────────────────────────────
        if not os.path.exists(sentinel):
            self._fail(
                f"Sentinel file not found: {sentinel}\n"
                "Has the backup service run at least once? "
                "Check: docker compose logs db-backup"
            )

        try:
            with open(sentinel) as fh:
                last_ts = float(fh.read().strip())
        except (ValueError, OSError) as exc:
            self._fail(f"Cannot read sentinel file {sentinel}: {exc}")
            return  # unreachable; silences mypy

        age_seconds = time.time() - last_ts
        age_hours = age_seconds / 3600

        # ── Check status file for non-success state ──────────────────────
        last_status = ""
        if os.path.exists(status_file):
            try:
                with open(status_file) as fh:
                    last_status = fh.read().strip()
            except OSError:
                pass

        # If sentinel exists but status shows failure, report it.
        if last_status.startswith("failed:"):
            self._fail(
                f"Last backup status: {last_status}\n"
                "The backup script ran but did not complete successfully."
            )

        # ── Check age ────────────────────────────────────────────────────
        if age_seconds > max_age_seconds:
            self._fail(
                f"Last successful backup was {age_hours:.1f}h ago "
                f"(threshold: {options['max_age_hours']}h).\n"
                "Check: docker compose logs db-backup"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Backup OK — last successful backup {age_hours:.1f}h ago "
                f"(status: {last_status or 'unknown'})"
            )
        )

    def _fail(self, message: str) -> None:
        self.stderr.write(self.style.ERROR(f"BACKUP STALE: {message}"))
        sys.exit(1)
