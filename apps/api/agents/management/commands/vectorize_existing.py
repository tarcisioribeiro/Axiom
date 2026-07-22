import time
import uuid

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

DOMAIN_CHOICES = ["finance", "budget", "planning", "library", "all"]


class Command(BaseCommand):
    help = (
        "Gera embeddings vetoriais (AgentEmbedding) para registros existentes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--domain",
            choices=DOMAIN_CHOICES,
            default="all",
            help="Domínio a processar (padrão: all)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help=(
                "Remove embeddings existentes do domínio"
                " antes de reprocessar"
            ),
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Registros por lote (padrão: 50)",
        )
        parser.add_argument(
            "--user",
            type=str,
            dest="username",
            help="Processa apenas o usuário especificado",
        )

    def handle(self, *args, **options):
        from agents.core.llm_client import LLMClient

        if not LLMClient.is_available():
            raise CommandError(
                "LLM não disponível. Verifique"
                " OLLAMA_BASE_URL ou ANTHROPIC_API_KEY."
            )

        domain = options["domain"]
        domains = (
            ["finance", "budget", "planning", "library"]
            if domain == "all"
            else [domain]
        )
        users = self._get_users(options.get("username"))

        for user in users:
            self.stdout.write(f"\nUsuário: {user.username}")
            for d in domains:
                self._process_domain(user, d, options)

    def _get_users(self, username: str | None) -> list:
        if username:
            try:
                return [User.objects.get(username=username)]
            except User.DoesNotExist:
                raise CommandError(f"Usuário '{username}' não encontrado.")
        return list(User.objects.filter(is_active=True))

    def _process_domain(self, user: User, domain: str, options: dict) -> None:
        from agents.models import AgentEmbedding

        if options["reset"]:
            deleted, _ = AgentEmbedding.objects.filter(
                user=user, domain=domain
            ).delete()
            self.stdout.write(
                f"  [{domain}] Reset: {deleted} embeddings removidos"
            )

        handlers = {
            "finance": self._process_finance,
            "budget": self._process_budget,
            "planning": self._process_planning,
            "library": self._process_library,
        }
        generated, errors = handlers[domain](user, options["batch_size"])
        self.stdout.write(
            self.style.SUCCESS(
                f"  Domínio {domain}: {generated} embeddings"
                f" gerados, {errors} erros"
            )
        )

    # -------------------------------------------------------------------------
    # Finance domain: expenses + revenues
    # -------------------------------------------------------------------------

    def _process_finance(self, user: User, batch_size: int) -> tuple[int, int]:
        generated, errors = 0, 0
        g, e = self._embed_expenses(user, batch_size)
        generated += g
        errors += e
        g, e = self._embed_revenues(user, batch_size)
        generated += g
        errors += e
        return generated, errors

    def _embed_expenses(self, user: User, batch_size: int) -> tuple[int, int]:
        from expenses.models import Expense

        qs = Expense.objects.filter(created_by=user, is_deleted=False).values(
            "uuid", "value", "category", "merchant", "date", "description"
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, expense in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [expense {i + 1}/{total}] {expense['description'][:50]}"
            )
            merchant = expense["merchant"] or expense["description"]
            text = (
                f"Despesa de R$ {expense['value']} em {expense['category']}"
                f" — {merchant} em {expense['date']}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="finance",
                source_type="expense",
                source_id=expense["uuid"],
                source_title=f"{expense['category']} — {expense['date']}",
                content=text,
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    def _embed_revenues(self, user: User, batch_size: int) -> tuple[int, int]:
        from revenues.models import Revenue

        qs = Revenue.objects.filter(created_by=user, is_deleted=False).values(
            "uuid", "value", "category", "date", "description"
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, revenue in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [revenue {i + 1}/{total}] {revenue['description'][:50]}"
            )
            text = (
                f"Receita de R$ {revenue['value']} em {revenue['category']}"
                f" em {revenue['date']}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="finance",
                source_type="revenue",
                source_id=revenue["uuid"],
                source_title=f"{revenue['category']} — {revenue['date']}",
                content=text,
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    # -------------------------------------------------------------------------
    # Budget domain
    # -------------------------------------------------------------------------

    def _process_budget(self, user: User, batch_size: int) -> tuple[int, int]:
        from django.db.models import Sum

        from budgets.models import Budget
        from expenses.models import Expense

        qs = Budget.objects.filter(created_by=user, is_deleted=False).values(
            "uuid", "category", "limit_amount", "month", "year"
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, budget in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [budget {i + 1}/{total}] {budget['category']}"
                f" {budget['month']:02d}/{budget['year']}"
            )
            spent = (
                Expense.objects.filter(
                    created_by=user,
                    category=budget["category"],
                    date__month=budget["month"],
                    date__year=budget["year"],
                    is_deleted=False,
                ).aggregate(total=Sum("value"))["total"]
                or 0
            )
            limit = budget["limit_amount"]
            pct = int(spent / limit * 100) if limit else 0
            text = (
                f"Orçamento de {budget['category']}: limite R$ {limit},"
                f" gasto R$ {spent} ({pct}%)"
                f" em {budget['month']:02d}/{budget['year']}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="budget",
                source_type="budget",
                source_id=budget["uuid"],
                source_title=(
                    f"{budget['category']}"
                    f" {budget['month']:02d}/{budget['year']}"
                ),
                content=text,
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    # -------------------------------------------------------------------------
    # Planning domain: routine tasks + goals
    # -------------------------------------------------------------------------

    def _process_planning(
        self, user: User, batch_size: int
    ) -> tuple[int, int]:
        generated, errors = 0, 0
        g, e = self._embed_routines(user, batch_size)
        generated += g
        errors += e
        g, e = self._embed_goals(user, batch_size)
        generated += g
        errors += e
        return generated, errors

    def _embed_routines(self, user: User, batch_size: int) -> tuple[int, int]:
        from personal_planning.models import RoutineTask

        qs = RoutineTask.objects.filter(
            owner__user=user, is_deleted=False
        ).values("uuid", "name", "description", "periodicity")
        total = qs.count()
        generated, errors = 0, 0

        for i, task in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [routine {i + 1}/{total}] {task['name'][:50]}"
            )
            description = task["description"] or ""
            text = (
                f"Rotina '{task['name']}': {description},"
                f" frequência {task['periodicity']}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="planning",
                source_type="routine",
                source_id=task["uuid"],
                source_title=task["name"],
                content=text,
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    def _embed_goals(self, user: User, batch_size: int) -> tuple[int, int]:
        from personal_planning.models import Goal

        qs = Goal.objects.filter(owner__user=user, is_deleted=False).values(
            "uuid",
            "title",
            "description",
            "current_value",
            "target_value",
            "end_date",
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, goal in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [goal {i + 1}/{total}] {goal['title'][:50]}"
            )
            description = goal["description"] or ""
            target = goal["target_value"] or 1
            progress = int(goal["current_value"] / target * 100)
            deadline = (
                goal["end_date"].strftime("%d/%m/%Y")
                if goal["end_date"]
                else "sem prazo"
            )
            text = (
                f"Meta '{goal['title']}': {description},"
                f" progresso {progress}%, prazo {deadline}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="planning",
                source_type="goal",
                source_id=goal["uuid"],
                source_title=goal["title"],
                content=text,
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    # -------------------------------------------------------------------------
    # Library domain: summaries, reading notes, highlights
    # -------------------------------------------------------------------------

    def _process_library(self, user: User, batch_size: int) -> tuple[int, int]:
        generated, errors = 0, 0
        for handler in (
            self._embed_summaries,
            self._embed_reading_notes,
            self._embed_highlights,
        ):
            g, e = handler(user, batch_size)
            generated += g
            errors += e
        return generated, errors

    def _embed_summaries(self, user: User, batch_size: int) -> tuple[int, int]:
        from library.models import Summary

        qs = (
            Summary.objects.filter(owner__user=user, is_deleted=False)
            .select_related("book")
            .values("uuid", "title", "text", "book__title")
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, summary in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [book_summary {i + 1}/{total}]"
                f" {summary['book__title'][:50]}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="library",
                source_type="book_summary",
                source_id=summary["uuid"],
                source_title=f"{summary['book__title']} — {summary['title']}",
                content=summary["text"],
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    def _embed_reading_notes(
        self, user: User, batch_size: int
    ) -> tuple[int, int]:
        from library.models import Reading

        qs = (
            Reading.objects.filter(owner__user=user, is_deleted=False)
            .exclude(notes__isnull=True)
            .exclude(notes="")
            .select_related("book")
            .values("uuid", "notes", "reading_date", "book__title")
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, reading in enumerate(qs.iterator(chunk_size=batch_size)):
            self.stdout.write(
                f"    [reading_note {i + 1}/{total}]"
                f" {reading['book__title'][:50]}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="library",
                source_type="reading_note",
                source_id=reading["uuid"],
                source_title=(
                    f"{reading['book__title']}" f" ({reading['reading_date']})"
                ),
                content=reading["notes"] or "",
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    def _embed_highlights(
        self, user: User, batch_size: int
    ) -> tuple[int, int]:
        from library.models import BookHighlight

        qs = (
            BookHighlight.objects.filter(owner__user=user, is_deleted=False)
            .select_related("book")
            .values("uuid", "text", "book__title")
        )
        total = qs.count()
        generated, errors = 0, 0

        for i, hl in enumerate(qs.iterator(chunk_size=batch_size)):
            if not hl["text"] or not hl["text"].strip():
                continue
            self.stdout.write(
                f"    [highlight {i + 1}/{total}] {hl['book__title'][:50]}"
            )
            ok = self._upsert_embedding(
                user=user,
                domain="library",
                source_type="highlight",
                source_id=hl["uuid"],
                source_title=hl["book__title"] or "Livro desconhecido",
                content=hl["text"],
            )
            if ok:
                generated += 1
            else:
                errors += 1

        return generated, errors

    # -------------------------------------------------------------------------
    # Core embed + upsert
    # -------------------------------------------------------------------------

    def _upsert_embedding(
        self,
        user: User,
        domain: str,
        source_type: str,
        source_id,
        source_title: str,
        content: str,
    ) -> bool:
        from agents.core.llm_client import LLMClient
        from agents.models import AgentEmbedding

        if not content or not content.strip():
            return False

        try:
            embedding = LLMClient.embed(content)
            if not embedding:
                self.stdout.write(
                    self.style.WARNING(
                        f"      Falha no embedding: {source_title[:60]}"
                    )
                )
                return False

            if isinstance(source_id, str):
                source_id = uuid.UUID(source_id)

            AgentEmbedding.objects.update_or_create(
                user=user,
                source_id=source_id,
                source_type=source_type,
                defaults={
                    "domain": domain,
                    "source_title": source_title[:255],
                    "content": content,
                    "embedding": embedding,
                    "is_deleted": False,
                },
            )
            time.sleep(0.05)
            return True
        except Exception as exc:
            self.stdout.write(
                self.style.ERROR(f"      Erro em {source_title[:60]}: {exc}")
            )
            return False
