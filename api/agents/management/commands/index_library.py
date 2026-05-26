import json
import time

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = (
        "Indexa resumos, notas de leitura e destaques"
        " da biblioteca no pgvector."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            type=str,
            help="Username específico (padrão: todos os usuários)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-indexa mesmo que já esteja vetorizado",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra o que seria indexado sem executar",
        )
        parser.add_argument(
            "--chunk-size",
            type=int,
            default=500,
            help="Tamanho máximo do chunk em caracteres (padrão: 500)",
        )

    def handle(self, *args, **options):
        from agents.core.llm_client import LLMClient

        if not LLMClient.is_available():
            raise CommandError(
                "LLM não disponível. Verifique"
                " OLLAMA_BASE_URL ou ANTHROPIC_API_KEY."
            )

        dry_run = options["dry_run"]
        force = options["force"]
        chunk_size = options["chunk_size"]

        users = self._get_users(options.get("user"))

        total_indexed = 0
        total_skipped = 0

        for user in users:
            self.stdout.write(f"\nProcessando usuário: {user.username}")

            # Indexa Summary.text (resumos em Markdown)
            indexed, skipped = self._index_summaries(
                user, force, dry_run, chunk_size
            )
            total_indexed += indexed
            total_skipped += skipped

            # Indexa Reading.notes (notas de leitura)
            indexed, skipped = self._index_reading_notes(
                user, force, dry_run, chunk_size
            )
            total_indexed += indexed
            total_skipped += skipped

            # Indexa BookHighlight.text (destaques)
            indexed, skipped = self._index_highlights(
                user, force, dry_run, chunk_size
            )
            total_indexed += indexed
            total_skipped += skipped

        action = "[DRY-RUN] Seriam indexados" if dry_run else "Indexados"
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{action}: {total_indexed} chunks"
                f" | Pulados: {total_skipped}"
            )
        )

    def _get_users(self, username):
        if username:
            try:
                return [User.objects.get(username=username)]
            except User.DoesNotExist:
                raise CommandError(f"Usuário '{username}' não encontrado.")
        return User.objects.filter(is_active=True)

    def _chunk_text(self, text: str, chunk_size: int) -> list[str]:
        """Divide texto em chunks por parágrafo, respeitando chunk_size."""
        if not text:
            return []
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks = []
        current = ""
        for para in paragraphs:
            if len(current) + len(para) <= chunk_size:
                current = (current + "\n\n" + para).strip()
            else:
                if current:
                    chunks.append(current)
                current = para[:chunk_size]
        if current:
            chunks.append(current)
        return chunks

    def _upsert_embedding(
        self,
        user: User,
        source_type: str,
        source_id,
        source_title: str,
        content: str,
        dry_run: bool,
    ) -> bool:
        from agents.core.llm_client import LLMClient
        from agents.models import EmbeddingDocument

        if dry_run:
            self.stdout.write(f"  [DRY-RUN] {source_title[:60]}...")
            return True

        embedding = LLMClient.embed(content)
        if not embedding:
            self.stdout.write(
                self.style.WARNING(
                    f"  Falha no embedding para: {source_title[:60]}"
                )
            )
            return False

        EmbeddingDocument.objects.update_or_create(
            user=user,
            source_id=source_id,
            content=content,
            defaults={
                "source_type": source_type,
                "source_title": source_title,
                "embedding_json": json.dumps(embedding),
                "created_by": user,
                "updated_by": user,
            },
        )
        time.sleep(0.05)  # Evita sobrecarga no Ollama
        return True

    def _index_summaries(
        self, user: User, force: bool, dry_run: bool, chunk_size: int
    ) -> tuple[int, int]:
        from agents.models import EmbeddingDocument
        from library.models import Summary

        summaries = Summary.objects.filter(
            owner__user=user,
            is_deleted=False,
        ).select_related("book")

        if not force:
            already_indexed = set(
                EmbeddingDocument.objects.filter(
                    user=user, source_type="book_summary"
                ).values_list("source_id", flat=True)
            )
            summaries = summaries.exclude(uuid__in=already_indexed)

        indexed = 0
        skipped = 0

        for summary in summaries:
            chunks = self._chunk_text(summary.text, chunk_size)
            self.stdout.write(
                f"  Resumo: '{summary.book.title}' → {len(chunks)} chunks"
            )
            for i, chunk in enumerate(chunks):
                import uuid

                chunk_id = uuid.uuid5(summary.uuid, str(i))
                ok = self._upsert_embedding(
                    user=user,
                    source_type="book_summary",
                    source_id=chunk_id,
                    source_title=f"{summary.book.title} — {summary.title}",
                    content=chunk,
                    dry_run=dry_run,
                )
                if ok:
                    indexed += 1
                else:
                    skipped += 1

            if not dry_run:
                Summary.objects.filter(pk=summary.pk).update(
                    is_vectorized=True,
                    vectorization_date=timezone.now(),
                )

        return indexed, skipped

    def _index_reading_notes(
        self, user: User, force: bool, dry_run: bool, chunk_size: int
    ) -> tuple[int, int]:
        from agents.models import EmbeddingDocument
        from library.models import Reading

        readings = (
            Reading.objects.filter(
                owner__user=user,
                is_deleted=False,
            )
            .exclude(notes__isnull=True)
            .exclude(notes="")
            .select_related("book")
        )

        if not force:
            already_indexed = set(
                EmbeddingDocument.objects.filter(
                    user=user, source_type="reading_note"
                ).values_list("source_id", flat=True)
            )
            readings = readings.exclude(uuid__in=already_indexed)

        indexed = 0
        skipped = 0

        for reading in readings:
            chunks = self._chunk_text(reading.notes or "", chunk_size)
            if not chunks:
                continue
            self.stdout.write(
                f"  Leitura: '{reading.book.title}'"
                f" {reading.reading_date} → {len(chunks)} chunks"
            )
            for i, chunk in enumerate(chunks):
                import uuid

                chunk_id = uuid.uuid5(reading.uuid, str(i))
                ok = self._upsert_embedding(
                    user=user,
                    source_type="reading_note",
                    source_id=chunk_id,
                    source_title=(
                        f"{reading.book.title}" f" ({reading.reading_date})"
                    ),
                    content=chunk,
                    dry_run=dry_run,
                )
                if ok:
                    indexed += 1
                else:
                    skipped += 1

        return indexed, skipped

    def _index_highlights(
        self, user: User, force: bool, dry_run: bool, chunk_size: int
    ) -> tuple[int, int]:
        from agents.models import EmbeddingDocument
        from library.models import BookHighlight

        highlights = BookHighlight.objects.filter(
            owner__user=user,
            is_deleted=False,
        ).select_related("book")

        if not force:
            already_indexed = set(
                EmbeddingDocument.objects.filter(
                    user=user, source_type="book_highlight"
                ).values_list("source_id", flat=True)
            )
            highlights = highlights.exclude(uuid__in=already_indexed)

        indexed = 0
        skipped = 0

        for hl in highlights:
            content = hl.text if hasattr(hl, "text") else str(hl)
            if not content.strip():
                continue
            ok = self._upsert_embedding(
                user=user,
                source_type="book_highlight",
                source_id=hl.uuid,
                source_title=str(hl.book) if hl.book else "Livro desconhecido",
                content=content[:chunk_size],
                dry_run=dry_run,
            )
            if ok:
                indexed += 1
            else:
                skipped += 1

        return indexed, skipped
