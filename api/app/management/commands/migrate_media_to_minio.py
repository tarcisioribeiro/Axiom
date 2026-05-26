import os
from typing import Any

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Migrate existing media files from local filesystem"
        " to MinIO/S3 storage"
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "List files that would be migrated without actually"
                " migrating them"
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run = options["dry_run"]
        media_root = settings.MEDIA_ROOT

        if not os.path.exists(media_root):
            self.stdout.write(
                self.style.WARNING(
                    f"Media directory {media_root} does not exist."
                    " Nothing to migrate."
                )
            )
            return

        files_found = 0
        files_migrated = 0
        files_skipped = 0

        for root, dirs, files in os.walk(media_root):
            for filename in files:
                local_path = os.path.join(root, filename)
                relative_path = os.path.relpath(local_path, media_root)
                files_found += 1

                if dry_run:
                    self.stdout.write(
                        f"  [DRY RUN] Would migrate: {relative_path}"
                    )
                    continue

                # Check if file already exists in storage
                if default_storage.exists(relative_path):
                    self.stdout.write(
                        f"  [SKIP] Already exists: {relative_path}"
                    )
                    files_skipped += 1
                    continue

                try:
                    with open(local_path, "rb") as f:
                        default_storage.save(relative_path, f)
                    files_migrated += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"  [OK] Migrated: {relative_path}")
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"  [ERROR] {relative_path}: {e}")
                    )

        self.stdout.write("")
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run complete. {files_found} file(s) found."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Migration complete. "
                    f"Found: {files_found}, "
                    f"Migrated: {files_migrated}, "
                    f"Skipped: {files_skipped}"
                )
            )
