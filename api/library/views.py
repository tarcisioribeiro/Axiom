from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from library.models import (
    Author,
    Book,
    BookHighlight,
    Publisher,
    Reading,
    ReadingGoal,
    Summary,
)
from library.serializers import (
    AuthorCreateUpdateSerializer,
    AuthorSerializer,
    BookCreateUpdateSerializer,
    BookHighlightCreateUpdateSerializer,
    BookHighlightSerializer,
    BookReorderItemSerializer,
    BookSerializer,
    PublisherCreateUpdateSerializer,
    PublisherSerializer,
    ReadingCreateUpdateSerializer,
    ReadingGoalCreateUpdateSerializer,
    ReadingGoalSerializer,
    ReadingSerializer,
    SummaryCreateUpdateSerializer,
    SummarySerializer,
)


def log_activity(request, action, model_name, object_id, description):
    """Helper para registrar atividades de biblioteca."""
    try:
        from security.activity_logs.models import ActivityLog

        ActivityLog.log_action(
            user=request.user,
            action=action,
            description=description,
            model_name=model_name,
            object_id=object_id,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
    except Exception:
        pass  # Se ActivityLog não estiver disponível, ignora


def get_client_ip(request):
    """Extrai o IP do cliente da requisição."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip


# ============================================================================
# AUTHOR VIEWS
# ============================================================================


class AuthorListCreateView(BaseListCreateView):
    """Lista todos os autores ou cria um novo."""

    queryset = Author.objects.all()

    def get_queryset(self):
        return (
            Author.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("books")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AuthorCreateUpdateSerializer
        return AuthorSerializer

    def perform_create(self, serializer):
        author = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request, "create", "Author", author.id, f"Criou autor: {author.name}"
        )


class AuthorDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um autor."""

    queryset = Author.objects.all()

    def get_queryset(self):
        return (
            Author.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("books")
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return AuthorCreateUpdateSerializer
        return AuthorSerializer

    def perform_update(self, serializer):
        author = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "Author",
            author.id,
            f"Atualizou autor: {author.name}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Author",
            instance.id,
            f"Deletou autor: {instance.name}",
        )


# ============================================================================
# PUBLISHER VIEWS
# ============================================================================


class PublisherListCreateView(BaseListCreateView):
    """Lista todas as editoras ou cria uma nova."""

    queryset = Publisher.objects.all()

    def get_queryset(self):
        return (
            Publisher.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("books")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PublisherCreateUpdateSerializer
        return PublisherSerializer

    def perform_create(self, serializer):
        publisher = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "Publisher",
            publisher.id,
            f"Criou editora: {publisher.name}",
        )


class PublisherDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma editora."""

    queryset = Publisher.objects.all()

    def get_queryset(self):
        return (
            Publisher.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("books")
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return PublisherCreateUpdateSerializer
        return PublisherSerializer

    def perform_update(self, serializer):
        publisher = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "Publisher",
            publisher.id,
            f"Atualizou editora: {publisher.name}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Publisher",
            instance.id,
            f"Deletou editora: {instance.name}",
        )


# ============================================================================
# BOOK VIEWS
# ============================================================================


class BookListCreateView(BaseListCreateView):
    """Lista todos os livros ou cria um novo."""

    queryset = Book.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return (
            Book.objects.filter(owner__user=self.request.user, deleted_at__isnull=True)
            .select_related("owner", "publisher")
            .prefetch_related("authors", "readings")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BookCreateUpdateSerializer
        return BookSerializer

    def perform_create(self, serializer):
        book = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "Book",
            book.id,
            f"Criou livro: {
                book.title}",
        )


class BookDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um livro."""

    queryset = Book.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return (
            Book.objects.filter(owner__user=self.request.user, deleted_at__isnull=True)
            .select_related("owner", "publisher")
            .prefetch_related("authors", "readings")
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return BookCreateUpdateSerializer
        return BookSerializer

    def perform_update(self, serializer):
        book = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request, "update", "Book", book.id, f"Atualizou livro: {book.title}"
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Book",
            instance.id,
            f"Deletou livro: {instance.title}",
        )


# ============================================================================
# SUMMARY VIEWS
# ============================================================================


class SummaryListCreateView(BaseListCreateView):
    """Lista todos os resumos ou cria um novo."""

    queryset = Summary.objects.all()

    def get_queryset(self):
        return Summary.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SummaryCreateUpdateSerializer
        return SummarySerializer

    def perform_create(self, serializer):
        summary = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "Summary",
            summary.id,
            f"Criou resumo: {summary.title}",
        )


class SummaryDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um resumo."""

    queryset = Summary.objects.all()

    def get_queryset(self):
        return Summary.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return SummaryCreateUpdateSerializer
        return SummarySerializer

    def perform_update(self, serializer):
        summary = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "Summary",
            summary.id,
            f"Atualizou resumo: {summary.title}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Summary",
            instance.id,
            f"Deletou resumo: {instance.title}",
        )


# ============================================================================
# READING VIEWS
# ============================================================================


class ReadingListCreateView(BaseListCreateView):
    """Lista todas as leituras ou cria uma nova."""

    queryset = Reading.objects.all()

    def get_queryset(self):
        return Reading.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ReadingCreateUpdateSerializer
        return ReadingSerializer

    def perform_create(self, serializer):
        reading = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "Reading",
            reading.id,
            f"Registrou leitura de: {reading.book.title}",
        )


class ReadingDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma leitura."""

    queryset = Reading.objects.all()

    def get_queryset(self):
        return Reading.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ReadingCreateUpdateSerializer
        return ReadingSerializer

    def perform_update(self, serializer):
        reading = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "Reading",
            reading.id,
            f"Atualizou leitura de: {reading.book.title}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "Reading",
            instance.id,
            f"Deletou leitura de: {instance.book.title}",
        )


# ============================================================================
# READING GOAL VIEWS
# ============================================================================


class ReadingGoalListCreateView(BaseListCreateView):
    """Lista todas as metas de leitura ou cria uma nova."""

    queryset = ReadingGoal.objects.all()

    def get_queryset(self):
        return ReadingGoal.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ReadingGoalCreateUpdateSerializer
        return ReadingGoalSerializer

    def perform_create(self, serializer):
        goal = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "ReadingGoal",
            goal.id,
            f"""Criou meta de leitura para {
                goal.year
            }: {
                goal.books_goal
            } livros""",
        )


class ReadingGoalDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma meta de leitura."""

    queryset = ReadingGoal.objects.all()

    def get_queryset(self):
        return ReadingGoal.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ReadingGoalCreateUpdateSerializer
        return ReadingGoalSerializer

    def perform_update(self, serializer):
        goal = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "ReadingGoal",
            goal.id,
            f"""Atualizou meta de leitura para {
                goal.year
            }: {
                goal.books_goal
            } livros""",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "ReadingGoal",
            instance.id,
            f"Deletou meta de leitura para {instance.year}",
        )


# ============================================================================
# READING QUEUE VIEWS
# ============================================================================


class BookReadingQueueView(APIView):
    """
    GET /api/v1/library/reading-queue/

    Retorna os livros com status 'to_read' ordenados por reading_priority ASC
    (nulos no final).
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Book.objects.all()

    def get(self, request):
        books = (
            Book.objects.filter(
                owner__user=request.user,
                deleted_at__isnull=True,
                read_status="to_read",
            )
            .select_related("owner", "publisher")
            .prefetch_related("authors", "readings")
            .order_by("reading_priority", "created_at")
        )

        # Colocar livros sem prioridade no final
        with_priority = [b for b in books if b.reading_priority is not None]
        without_priority = [b for b in books if b.reading_priority is None]
        ordered = with_priority + without_priority

        serializer = BookSerializer(ordered, many=True)
        return Response({"results": serializer.data, "count": len(ordered)})


class BookReorderView(APIView):
    """
    PATCH /api/v1/library/reading-queue/reorder/

    Recebe uma lista de {id, priority} e atualiza em lote as prioridades.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Book.objects.all()

    def patch(self, request):
        serializer = BookReorderItemSerializer(data=request.data, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        items = serializer.validated_data
        ids = [item["id"] for item in items]

        # Verifica que todos os livros pertencem ao usuário
        user_books = set(
            Book.objects.filter(
                id__in=ids,
                owner__user=request.user,
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        )

        invalid_ids = [id for id in ids if id not in user_books]
        if invalid_ids:
            return Response(
                {"detail": "Alguns livros não foram encontrados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for item in items:
                Book.objects.filter(id=item["id"]).update(
                    reading_priority=item["priority"]
                )

        return Response({"detail": "Fila atualizada com sucesso."})


# ============================================================================
# LIBRARY DASHBOARD VIEWS
# ============================================================================


class LibraryDashboardStatsView(APIView):
    """
    GET /api/v1/library/dashboard/stats/

    Retorna estatísticas agregadas do módulo de Leitura.

    Response:
    {
        "total_books": 25,
        "total_authors": 15,
        "total_publishers": 8,
        "books_reading": 3,
        "books_to_read": 10,
        "books_read": 12,
        "average_rating": 4.2,
        "total_pages_read": 1580,
        "books_by_genre": [
            {"genre": "Philosophy", "genre_display": "Filosofia", "count": 8},
            {"genre": "Fiction", "genre_display": "Ficção", "count": 5}
        ],
        "recent_readings": [
            {
                "book_title": "1984",
                "pages_read": 45,
                "reading_date": "2025-03-15"
            }
        ],
        "top_rated_books": [
            {
                "title": "Crime e Castigo",
                "rating": 5,
                "authors_names": ["Fiódor Dostoiévski"]
            }
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Calcula estatísticas do módulo de leitura."""
        user = request.user

        # Querysets filtrados por owner e não deletados
        books_qs = Book.objects.filter(owner__user=user, deleted_at__isnull=True)
        authors_qs = Author.objects.filter(owner__user=user, deleted_at__isnull=True)
        publishers_qs = Publisher.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        readings_qs = Reading.objects.filter(owner__user=user, deleted_at__isnull=True)

        # Contadores gerais
        total_books = books_qs.count()
        total_authors = authors_qs.count()
        total_publishers = publishers_qs.count()

        # Status de leitura
        books_reading = books_qs.filter(read_status="reading").count()
        books_to_read = books_qs.filter(read_status="to_read").count()
        books_read = books_qs.filter(read_status="read").count()

        # Média de avaliações
        avg_rating = books_qs.aggregate(avg=Avg("rating"))["avg"] or 0.0

        # Total de páginas lidas
        total_pages = readings_qs.aggregate(total=Sum("pages_read"))["total"] or 0

        # Tempo total de leitura (horas)
        total_reading_time = (
            readings_qs.aggregate(total=Sum("reading_time"))["total"] or 0
        )
        total_reading_time_hours = round(total_reading_time / 60, 1)

        # Média de páginas por livro
        avg_pages = books_qs.aggregate(avg=Avg("pages"))["avg"] or 0.0
        average_pages_per_book = round(float(avg_pages), 1)

        # Velocidade média de leitura (páginas/hora)
        speed_agg = readings_qs.filter(reading_time__gt=0).aggregate(
            total_pages=Sum("pages_read"), total_time=Sum("reading_time")
        )
        if speed_agg["total_time"]:
            avg_speed_pages_per_hour = round(
                (speed_agg["total_pages"] / speed_agg["total_time"]) * 60, 1
            )
        else:
            avg_speed_pages_per_hour = 0.0

        # Livro atual em leitura + estimativa de conclusão
        current_reading_book = None
        current_book_qs = books_qs.filter(read_status="reading").order_by("-updated_at")
        if current_book_qs.exists():
            book = current_book_qs.first()
            pages_read_so_far = (
                readings_qs.filter(book=book).aggregate(total=Sum("pages_read"))[
                    "total"
                ]
                or 0
            )
            remaining_pages = max(0, book.pages - pages_read_so_far)
            current_reading_book = {
                "title": book.title,
                "total_pages": book.pages,
                "pages_read": pages_read_so_far,
                "remaining_pages": remaining_pages,
                "estimated_days_to_finish": None,
            }
            # Ritmo dos últimos 30 dias (todas as sessões do usuário)
            thirty_days_ago = (timezone.now() - timedelta(days=30)).date()
            last_30_pages = (
                readings_qs.filter(reading_date__gte=thirty_days_ago).aggregate(
                    total=Sum("pages_read")
                )["total"]
                or 0
            )
            avg_pages_per_day = last_30_pages / 30
            if avg_pages_per_day > 0 and remaining_pages > 0:
                current_reading_book["estimated_days_to_finish"] = max(
                    1, round(remaining_pages / avg_pages_per_day)
                )

        # Comparação mensal: mês atual vs mês anterior
        now = timezone.now()
        curr_year, curr_month = now.year, now.month
        prev_month = curr_month - 1 if curr_month > 1 else 12
        prev_year = curr_year if curr_month > 1 else curr_year - 1

        def _month_stats(year, month):
            qs = readings_qs.filter(reading_date__year=year, reading_date__month=month)
            agg = qs.aggregate(pages=Sum("pages_read"), minutes=Sum("reading_time"))
            pages = agg["pages"] or 0
            hours = round((agg["minutes"] or 0) / 60, 1)
            completed = (
                books_qs.filter(
                    read_status="read",
                    readings__deleted_at__isnull=True,
                    readings__reading_date__year=year,
                    readings__reading_date__month=month,
                )
                .distinct()
                .count()
            )
            return {
                "year": year,
                "month": month,
                "pages_read": pages,
                "reading_time_hours": hours,
                "books_completed": completed,
            }

        def _pct_change(curr, prev):
            if prev == 0:
                return None
            return round(((curr - prev) / prev) * 100, 1)

        curr_stats = _month_stats(curr_year, curr_month)
        prev_stats = _month_stats(prev_year, prev_month)
        monthly_comparison = {
            "current_month": curr_stats,
            "previous_month": prev_stats,
            "changes": {
                "pages_read": _pct_change(
                    curr_stats["pages_read"], prev_stats["pages_read"]
                ),
                "reading_time_hours": _pct_change(
                    curr_stats["reading_time_hours"], prev_stats["reading_time_hours"]
                ),
                "books_completed": _pct_change(
                    curr_stats["books_completed"], prev_stats["books_completed"]
                ),
            },
        }

        # Livros por gênero (Top 5)
        books_by_genre = list(
            books_qs.values("genre").annotate(count=Count("id")).order_by("-count")[:5]
        )

        # Adicionar display name dos gêneros
        from library.models import GENRES

        genre_dict = dict(GENRES)
        for item in books_by_genre:
            item["genre_display"] = genre_dict.get(item["genre"], item["genre"])

        # Top 3 gêneros por tempo de leitura (ano atual)
        top_genres_by_time_raw = list(
            readings_qs.filter(reading_date__year=curr_year, reading_time__gt=0)
            .values(genre=F("book__genre"))
            .annotate(total_time=Sum("reading_time"), total_pages=Sum("pages_read"))
            .order_by("-total_time")[:3]
        )
        top_genres_by_time = []
        for item in top_genres_by_time_raw:
            top_genres_by_time.append(
                {
                    "genre": item["genre"],
                    "genre_display": genre_dict.get(item["genre"], item["genre"]),
                    "total_time_hours": round(item["total_time"] / 60, 1),
                    "total_pages": item["total_pages"],
                }
            )

        # Livros por idioma
        books_by_language = list(
            books_qs.values("language").annotate(count=Count("id")).order_by("-count")
        )

        # Adicionar display name dos idiomas
        from library.models import LANGUAGES

        language_dict = dict(LANGUAGES)
        for item in books_by_language:
            item["language_display"] = language_dict.get(
                item["language"], item["language"]
            )

        # Livros por tipo de mídia
        books_by_media_type = list(
            books_qs.filter(media_type__isnull=False)
            .values("media_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Adicionar display name dos tipos de mídia
        from library.models import MEDIA_TYPE

        media_type_dict = dict(MEDIA_TYPE)
        for item in books_by_media_type:
            item["media_type_display"] = media_type_dict.get(
                item["media_type"], item["media_type"]
            )

        # Leituras recentes (últimas 5)
        recent_readings_qs = readings_qs.select_related("book").order_by(
            "-reading_date"
        )[:5]

        recent_readings = []
        for reading in recent_readings_qs:
            recent_readings.append(
                {
                    "book_title": reading.book.title,
                    "pages_read": reading.pages_read,
                    "reading_date": reading.reading_date.isoformat(),
                }
            )

        # Top 3 livros mais bem avaliados
        top_rated_qs = books_qs.prefetch_related("authors").order_by(
            "-rating", "-created_at"
        )[:3]

        top_rated_books = []
        for book in top_rated_qs:
            top_rated_books.append(
                {
                    "title": book.title,
                    "rating": book.rating,
                    "authors_names": [author.name for author in book.authors.all()],
                }
            )

        # Autor e editora mais lidos (baseado em livros com read_status='read')
        read_books_qs = books_qs.filter(read_status="read")

        most_read_author = None
        if read_books_qs.exists():
            author_stats = (
                Author.objects.filter(
                    books__in=read_books_qs, owner__user=user, deleted_at__isnull=True
                )
                .annotate(
                    books_count=Count("books", filter=Q(books__in=read_books_qs)),
                    total_pages=Sum("books__pages", filter=Q(books__in=read_books_qs)),
                )
                .order_by("-books_count", "-total_pages")
                .first()
            )

            if author_stats:
                most_read_author = {
                    "name": author_stats.name,
                    "books_count": author_stats.books_count,
                    "total_pages": author_stats.total_pages or 0,
                }

        most_read_publisher = None
        if read_books_qs.exists():
            publisher_stats = (
                Publisher.objects.filter(
                    books__in=read_books_qs, owner__user=user, deleted_at__isnull=True
                )
                .annotate(
                    books_count=Count("books", filter=Q(books__in=read_books_qs)),
                    total_pages=Sum("books__pages", filter=Q(books__in=read_books_qs)),
                )
                .order_by("-books_count", "-total_pages")
                .first()
            )

            if publisher_stats:
                most_read_publisher = {
                    "name": publisher_stats.name,
                    "books_count": publisher_stats.books_count,
                    "total_pages": publisher_stats.total_pages or 0,
                }

        # Status de leitura (para gráfico de pizza)
        from library.models import READ_STATUS_CHOICES

        reading_status_distribution = []
        for status_value, status_display in READ_STATUS_CHOICES:
            count = books_qs.filter(read_status=status_value).count()
            if count > 0:
                reading_status_distribution.append(
                    {
                        "status": status_value,
                        "status_display": status_display,
                        "count": count,
                    }
                )

        # Timeline diária (últimos 6 meses)
        six_months_ago = timezone.now() - timedelta(days=180)

        reading_timeline = list(
            readings_qs.filter(reading_date__gte=six_months_ago)
            .values("reading_date")
            .annotate(
                pages_read=Sum("pages_read"), reading_time_minutes=Sum("reading_time")
            )
            .order_by("reading_date")
        )

        # Formatar date e adicionar reading_time_hours
        for item in reading_timeline:
            item["date"] = item["reading_date"].isoformat()
            item["reading_time_hours"] = round(item["reading_time_minutes"] / 60, 1)
            del item["reading_time_minutes"]
            del item["reading_date"]

        # Top 5 autores por quantidade de livros
        top_authors = list(
            Author.objects.filter(
                books__in=books_qs, owner__user=user, deleted_at__isnull=True
            )
            .annotate(books_count=Count("books", filter=Q(books__in=books_qs)))
            .order_by("-books_count")[:5]
            .values("name", "books_count")
        )

        # Distribuição de ratings (1-5 estrelas)
        rating_distribution = []
        rating_ranges = [
            ("1 estrela", 1, 1),
            ("2 estrelas", 2, 2),
            ("3 estrelas", 3, 3),
            ("4 estrelas", 4, 4),
            ("5 estrelas", 5, 5),
        ]

        for range_label, min_rating, max_rating in rating_ranges:
            count = books_qs.filter(
                rating__gte=min_rating, rating__lte=max_rating
            ).count()
            if count > 0:
                rating_distribution.append(
                    {"rating_range": range_label, "count": count}
                )

        stats = {
            "total_books": total_books,
            "total_authors": total_authors,
            "total_publishers": total_publishers,
            "books_reading": books_reading,
            "books_to_read": books_to_read,
            "books_read": books_read,
            "average_rating": round(float(avg_rating), 2),
            "total_pages_read": total_pages,
            "books_by_genre": books_by_genre,
            "recent_readings": recent_readings,
            "top_rated_books": top_rated_books,
            # Novos campos
            "total_reading_time_hours": total_reading_time_hours,
            "average_pages_per_book": average_pages_per_book,
            "books_by_language": books_by_language,
            "books_by_media_type": books_by_media_type,
            "most_read_author": most_read_author,
            "most_read_publisher": most_read_publisher,
            "reading_status_distribution": reading_status_distribution,
            "reading_timeline": reading_timeline,
            "top_authors": top_authors,
            "rating_distribution": rating_distribution,
            # Novos campos — Issue #18
            "avg_speed_pages_per_hour": avg_speed_pages_per_hour,
            "current_reading_book": current_reading_book,
            "monthly_comparison": monthly_comparison,
            "top_genres_by_time": top_genres_by_time,
        }

        return Response(stats)


# ============================================================================
# BOOK HIGHLIGHT VIEWS
# ============================================================================


class BookHighlightListCreateView(BaseListCreateView):
    """Lista todos os destaques ou cria um novo."""

    queryset = BookHighlight.objects.all()

    def get_queryset(self):
        qs = BookHighlight.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book", "summary")

        book_id = self.request.query_params.get("book")
        if book_id:
            qs = qs.filter(book_id=book_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(text__icontains=search)

        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BookHighlightCreateUpdateSerializer
        return BookHighlightSerializer

    def perform_create(self, serializer):
        highlight = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "BookHighlight",
            highlight.id,
            f"Criou destaque no livro: {highlight.book.title}",
        )


class BookHighlightDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um destaque."""

    queryset = BookHighlight.objects.all()

    def get_queryset(self):
        return BookHighlight.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book", "summary")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return BookHighlightCreateUpdateSerializer
        return BookHighlightSerializer

    def perform_update(self, serializer):
        highlight = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "BookHighlight",
            highlight.id,
            f"Atualizou destaque no livro: {highlight.book.title}",
        )

    def perform_destroy(self, instance):
        instance.deleted_at = instance.updated_at
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "BookHighlight",
            instance.id,
            f"Deletou destaque no livro: {instance.book.title}",
        )


class BookHighlightExportView(APIView):
    """
    GET /api/v1/library/highlights/export/?book=<id>

    Exporta destaques de um livro (ou todos) em formato Markdown.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = BookHighlight.objects.all()

    def get(self, request):
        from django.http import HttpResponse

        qs = BookHighlight.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        ).select_related("book", "summary")

        book_id = request.query_params.get("book")
        if book_id:
            qs = qs.filter(book_id=book_id)

        qs = qs.order_by("book__title", "page_number", "created_at")

        lines = []
        current_book_id = None
        for h in qs:
            if h.book_id != current_book_id:
                if current_book_id is not None:
                    lines.append("")
                lines.append(f"# {h.book.title}")
                lines.append("")
                current_book_id = h.book_id

            type_label = h.get_highlight_type_display()
            location_parts = []
            if h.chapter:
                location_parts.append(h.chapter)
            if h.page_number:
                location_parts.append(f"p. {h.page_number}")
            location = f" — {', '.join(location_parts)}" if location_parts else ""

            lines.append(f"**[{type_label}{location}]**")
            lines.append("")
            lines.append(f"> {h.text}")
            lines.append("")

        content = "\n".join(lines)
        filename = "destaques.md"
        if book_id:
            try:
                book = Book.objects.get(pk=book_id, owner__user=request.user)
                safe_title = book.title[:40].replace(" ", "_").replace("/", "-")
                filename = f"destaques_{safe_title}.md"
            except Book.DoesNotExist:
                pass

        response = HttpResponse(content, content_type="text/markdown; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
