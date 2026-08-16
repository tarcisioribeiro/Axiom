"""Importação única, por ambiente, do catálogo público
hasaneyldrm/exercises-dataset (GitHub, MIT + mídia © Gym visual) para
`ExerciseDatasetEntry`. Metadados + GIF/miniatura são baixados do
raw.githubusercontent.com e a mídia é salva via os `ImageField`/`FileField`
do model, que fazem o upload automático para o MinIO configurado no
storage backend do projeto.

Idempotente: reexecutar apenas atualiza metadados e preenche mídia
faltante — seguro rodar de novo após uma falha parcial.
"""

import logging
from typing import Any

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

import requests

from personal_planning.models import ExerciseDatasetEntry

logger = logging.getLogger(__name__)

RAW_BASE = (
    "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/"
)
DATASET_JSON_URL = RAW_BASE + "data/exercises.json"


class Command(BaseCommand):
    help = (
        "Importação única do catálogo hasaneyldrm/exercises-dataset "
        "(1.324 exercícios, metadados + GIF + miniatura) para "
        "ExerciseDatasetEntry, com upload de mídia para o MinIO. "
        "Idempotente — seguro reexecutar."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Não grava nada — apenas mostra o que seria importado.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Importa apenas os N primeiros registros (útil para teste).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run = options["dry_run"]
        limit = options["limit"]

        response = requests.get(DATASET_JSON_URL, timeout=30)
        response.raise_for_status()
        entries = response.json()
        if limit:
            entries = entries[:limit]

        created = updated = failed = 0
        for row in entries:
            dataset_id = row["id"]
            if dry_run:
                self.stdout.write(
                    f"[DRY RUN] importaria {dataset_id} — {row['name']}"
                )
                continue
            try:
                obj, was_created = (
                    ExerciseDatasetEntry.objects.update_or_create(
                        dataset_id=dataset_id,
                        defaults={
                            "name": row["name"],
                            "category": row.get("category"),
                            "body_part": row.get("body_part"),
                            "equipment": row.get("equipment"),
                            "target": row.get("target"),
                            "muscle_group": row.get("muscle_group"),
                            "secondary_muscles": ", ".join(
                                row.get("secondary_muscles") or []
                            ),
                            "media_id": row.get("media_id"),
                            "attribution": row.get("attribution"),
                        },
                    )
                )
                if not obj.thumbnail and row.get("image"):
                    self._attach_media(obj, "thumbnail", row["image"])
                if not obj.gif and row.get("gif_url"):
                    self._attach_media(obj, "gif", row["gif_url"])
                created += int(was_created)
                updated += int(not was_created)
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Falha ao importar exercício %s: %s", dataset_id, exc
                )
                self.stdout.write(
                    self.style.WARNING(f"✗ Falhou {dataset_id}: {exc}")
                )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"[DRY RUN] {len(entries)} registros analisados."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Concluído. criados={created} atualizados={updated} "
                f"falhas={failed}"
            )
        )

    def _attach_media(
        self, obj: ExerciseDatasetEntry, field_name: str, relative_path: str
    ) -> None:
        url = RAW_BASE + relative_path
        media_response = requests.get(url, timeout=30)
        media_response.raise_for_status()
        filename = relative_path.rsplit("/", 1)[-1]
        getattr(obj, field_name).save(
            filename, ContentFile(media_response.content), save=True
        )
