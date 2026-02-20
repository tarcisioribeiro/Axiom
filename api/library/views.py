from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from library.models import Author, Book, Publisher, Reading, Summary
from library.serializers import (
    AuthorCreateUpdateSerializer,
    AuthorSerializer,
    BookCreateUpdateSerializer,
    BookSerializer,
    PublisherCreateUpdateSerializer,
    PublisherSerializer,
    ReadingCreateUpdateSerializer,
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
            self.request, "create", "Book", book.id, f"Criou livro: {book.title}"
        )


class BookDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um livro."""

    queryset = Book.objects.all()

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

        # Livros por gênero (Top 5)
        books_by_genre = list(
            books_qs.values("genre").annotate(count=Count("id")).order_by("-count")[:5]
        )

        # Adicionar display name dos gêneros
        from library.models import GENRES

        genre_dict = dict(GENRES)
        for item in books_by_genre:
            item["genre_display"] = genre_dict.get(item["genre"], item["genre"])

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
        from datetime import timedelta

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
        }

        return Response(stats)
