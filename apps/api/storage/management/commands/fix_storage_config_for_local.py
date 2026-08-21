import os
from typing import Any

from django.core.management.base import BaseCommand

# Keys that SystemConfig may hold and that override the .env via
# app.config.cfg(). When a production/staging DB dump is restored locally,
# these rows can still point at the origin environment's MinIO
# host/credentials, breaking media access even though .env is already
# correct for the local Docker stack.
STORAGE_KEYS = (
    "MINIO_ENDPOINT",
    "MINIO_BUCKET_NAME",
    "MINIO_ROOT_USER",
    "MINIO_ROOT_PASSWORD",
)


def _get_system_config(model: Any, key: str) -> Any:
    return model.objects.get(key=key)  # type: ignore[attr-defined]


class Command(BaseCommand):
    help = (
        "Overwrites the SystemConfig MinIO keys (MINIO_ENDPOINT, "
        "MINIO_BUCKET_NAME, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD) with the "
        "current environment's values. Run this after restoring a database "
        "dump from another environment (e.g. production/staging) into a "
        "local Docker setup — app.config.cfg() prioritizes SystemConfig over "
        ".env, so a stale row otherwise makes the local API try to reach the "
        "origin environment's MinIO instead of the local one."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing to the database.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        from admin_panel.models import SystemConfig

        dry_run = options["dry_run"]

        for key in STORAGE_KEYS:
            env_value = os.environ.get(key)
            if not env_value:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Ignorado: {key} não está definido"
                        " no ambiente atual."
                    )
                )
                continue

            try:
                obj = _get_system_config(SystemConfig, key)
            except SystemConfig.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Ignorado: {key} não existe em SystemConfig"
                        " (.env já é usado como fallback)."
                    )
                )
                continue

            masked = "***" if "PASSWORD" in key else env_value
            current = obj.get_value()
            current_masked = (
                ("***" if "PASSWORD" in key else current)
                if current
                else "(vazio)"
            )

            if current == env_value:
                self.stdout.write(f"  OK: {key} já está correto ({masked}).")
                continue

            if dry_run:
                self.stdout.write(
                    f"  [dry-run] {key}: {current_masked} -> {masked}"
                )
                continue

            obj.set_value(env_value)
            obj.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Atualizado: {key} = {masked} (era: {current_masked})"
                )
            )

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    "SystemConfig sincronizado com o ambiente local."
                )
            )
