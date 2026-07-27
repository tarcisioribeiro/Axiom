import csv
import io
import json
import logging
import re
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.db.models import (
    Avg,
    Count,
    ExpressionWrapper,
    F,
    FloatField,
    Max,
    Q,
    Sum,
)
from django.http import FileResponse, HttpResponseRedirect
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import (
    BaseRenderer,
    BrowsableAPIRenderer,
    JSONRenderer,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from app.permissions import GlobalDefaultPermission
from app.throttles import ExportRateThrottle
from library.models import (
    Author,
    Book,
    BookHighlight,
    Course,
    CourseLesson,
    CourseModule,
    CourseSession,
    FlashCard,
    IntellectBadge,
    KnowledgeLink,
    LiteraryTypeGoal,
    Publisher,
    Reading,
    ReadingGoal,
    Skill,
    SkillHistory,
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
    CourseCreateUpdateSerializer,
    CourseLessonCreateUpdateSerializer,
    CourseLessonSerializer,
    CourseModuleCreateUpdateSerializer,
    CourseModuleSerializer,
    CourseSerializer,
    CourseSessionCreateUpdateSerializer,
    CourseSessionSerializer,
    FlashCardCreateUpdateSerializer,
    FlashCardReviewSerializer,
    FlashCardSerializer,
    IntellectBadgeSerializer,
    KnowledgeLinkCreateUpdateSerializer,
    KnowledgeLinkSerializer,
    LiteraryTypeGoalCreateUpdateSerializer,
    LiteraryTypeGoalSerializer,
    MarkAsReadSerializer,
    PublisherCreateUpdateSerializer,
    PublisherSerializer,
    ReadingCreateUpdateSerializer,
    ReadingGoalCreateUpdateSerializer,
    ReadingGoalSerializer,
    ReadingSerializer,
    SkillCreateUpdateSerializer,
    SkillHistorySerializer,
    SkillSerializer,
    SummaryCreateUpdateSerializer,
    SummarySerializer,
)

logger = logging.getLogger(__name__)

READING_SPEED_FALLBACK = {
    "book": 2.0,
    "collection": 2.0,
    "magazine": 1.0,
    "article": 3.0,
    "essay": 4.0,
}
DEFAULT_READING_SPEED = 2.0


def log_activity(
    request,
    action,
    model_name,
    object_id,
    description,
    description_key=None,
    description_params=None,
):
    """Helper para registrar atividades de biblioteca."""
    try:
        from security.models import ActivityLog

        ActivityLog.log_action(
            user=request.user,
            action=action,
            description=description,
            description_key=description_key,
            description_params=description_params,
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
            self.request,
            "create",
            "Author",
            author.id,
            f"Criou autor: {author.name}",
            description_key="author.create",
            description_params={"name": author.name},
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
            description_key="author.update",
            description_params={"name": author.name},
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
            description_key="author.delete",
            description_params={"name": instance.name},
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
            description_key="publisher.create",
            description_params={"name": publisher.name},
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
            description_key="publisher.update",
            description_params={"name": publisher.name},
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
            description_key="publisher.delete",
            description_params={"name": instance.name},
        )


# ============================================================================
# BOOK VIEWS
# ============================================================================


class BookListCreateView(BaseListCreateView):
    """Lista todos os livros ou cria um novo."""

    queryset = Book.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = (
            Book.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner", "publisher")
            .prefetch_related("authors", "readings")
        )
        params = self.request.query_params
        if read_status := params.get("read_status"):
            qs = qs.filter(read_status=read_status)
        if genre := params.get("genre"):
            qs = qs.filter(genre=genre)
        if language := params.get("language"):
            qs = qs.filter(language=language)
        if author_id := params.get("author"):
            qs = qs.filter(authors__id=author_id)
        if search := params.get("search"):
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(authors__name__icontains=search)
                | Q(publisher__name__icontains=search)
                | Q(synopsis__icontains=search)
            ).distinct()
        return qs

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
            f"Criou livro: {book.title}",
            description_key="book.create",
            description_params={"name": book.title},
        )


class BookDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um livro."""

    queryset = Book.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return (
            Book.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
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
            self.request,
            "update",
            "Book",
            book.id,
            f"Atualizou livro: {book.title}",
            description_key="book.update",
            description_params={"name": book.title},
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
            description_key="book.delete",
            description_params={"name": instance.title},
        )


# ============================================================================
# BOOK FILE VIEW
# ============================================================================


class BookFileView(APIView):
    """Gerencia o arquivo (EPUB/PDF) de um livro digital."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    parser_classes = [MultiPartParser, FormParser]
    queryset = Book.objects.all()

    def _get_book(self, request, pk):
        try:
            return Book.objects.get(
                pk=pk,
                owner__user=request.user,
                deleted_at__isnull=True,
            )
        except Book.DoesNotExist:
            return None

    def get(self, request, pk):
        """Retorna a URL presignada para download do arquivo."""
        book = self._get_book(request, pk)
        if not book:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not book.book_file:
            return Response(
                {"detail": "Este livro não possui arquivo anexado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        stream_url = f"/api/v1/library/books/{book.pk}/file/stream/?download=1"
        return Response(
            {"url": stream_url, "name": book.book_file.name.split("/")[-1]}
        )

    def patch(self, request, pk):
        """Faz upload ou substituição do arquivo do livro."""
        book = self._get_book(request, pk)
        if not book:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if book.media_type != "Dig":
            return Response(
                {
                    "detail": (
                        "Upload de arquivo só é permitido para"
                        " livros digitais."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        uploaded_file = request.FILES.get("book_file")
        if not uploaded_file:
            return Response(
                {"detail": "Nenhum arquivo enviado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = (
            uploaded_file.name.rsplit(".", 1)[-1].lower()
            if "." in uploaded_file.name
            else ""
        )
        if ext not in ("epub", "pdf"):
            return Response(
                {"detail": "Apenas arquivos EPUB ou PDF são permitidos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if book.book_file:
            book.book_file.delete(save=False)

        book.book_file = uploaded_file
        book.updated_by = request.user
        book.save(update_fields=["book_file", "updated_at", "updated_by"])
        log_activity(
            request,
            "update",
            "Book",
            book.id,
            f"Fez upload do arquivo do livro: {book.title}",
            description_key="book.upload_file",
            description_params={"name": book.title},
        )
        file_name = book.book_file.name.split("/")[-1]
        return Response(
            {"detail": "Arquivo enviado com sucesso.", "name": file_name}
        )

    def delete(self, request, pk):
        """Remove o arquivo do livro."""
        book = self._get_book(request, pk)
        if not book:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not book.book_file:
            return Response(
                {"detail": "Este livro não possui arquivo anexado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        book.book_file.delete(save=False)
        book.book_file = None
        book.updated_by = request.user
        book.save(update_fields=["book_file", "updated_at", "updated_by"])
        log_activity(
            request,
            "delete",
            "Book",
            book.id,
            f"Removeu arquivo do livro: {book.title}",
            description_key="book.remove_file",
            description_params={"name": book.title},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================================
# BOOK FILE STREAM VIEW
# ============================================================================


class BookFileStreamView(APIView):
    """Faz proxy do arquivo do livro via Django, contornando CORS do MinIO."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Book.objects.all()

    def _get_book(self, request, pk):
        try:
            return Book.objects.get(
                pk=pk,
                owner__user=request.user,
                deleted_at__isnull=True,
            )
        except Book.DoesNotExist:
            return None

    def get(self, request, pk):
        book = self._get_book(request, pk)
        if not book:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not book.book_file:
            return Response(
                {"detail": "Este livro não possui arquivo anexado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        filename = book.book_file.name.split("/")[-1]
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        content_type = (
            "application/epub+zip" if ext == "epub" else "application/pdf"
        )
        try:
            file_obj = book.book_file.open("rb")
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        is_download = request.query_params.get("download", "0") == "1"
        disposition = "attachment" if is_download else "inline"
        response = FileResponse(file_obj, content_type=content_type)
        response["Content-Disposition"] = (
            f'{disposition}; filename="{filename}"'
        )
        return response


# ============================================================================
# BOOK COVER STREAM VIEW
# ============================================================================


class BookCoverStreamView(APIView):
    """Redireciona para a capa do livro.

    Checa autorização (dono, não deletado) e então redireciona para
    ``book.cover.url`` — URL pré-assinada do MinIO em produção/staging com
    ``MINIO_EXTERNAL_ENDPOINT`` configurado (navegador busca direto no MinIO,
    sem passar pelo Django), ou ``/media/<nome>`` roteado para
    ``MediaProxyView`` quando não está. Evita segurar um worker do Gunicorn
    por toda a duração da transferência do arquivo — importante em telas com
    várias capas concorrentes (ex: listagem de livros).
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Book.objects.all()

    def get(self, request, pk):
        try:
            book = Book.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Book.DoesNotExist:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not book.cover:
            return Response(
                {"detail": "Este livro não possui capa."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = book.cover.url
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        # Must stay below the presigned URL's own expiry (MinIOStorage.url()
        # defaults to 3600s) — caching the redirect longer than the signature
        # lives means the browser replays an expired presigned URL and MinIO
        # rejects it with 403, without ever asking us for a fresh one.
        response["Cache-Control"] = "private, max-age=3600"
        return response


# ============================================================================
# AUTHOR PHOTO STREAM VIEW
# ============================================================================


class AuthorPhotoStreamView(APIView):
    """Redireciona para a foto do autor (ver docstring de
    BookCoverStreamView)."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Author.objects.all()

    def get(self, request, pk):
        try:
            author = Author.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Author.DoesNotExist:
            return Response(
                {"detail": "Autor não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not author.photo:
            return Response(
                {"detail": "Este autor não possui foto."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            url = author.photo.url
        except Exception:
            return Response(
                {"detail": "Arquivo não encontrado no sistema de arquivos."},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponseRedirect(url)
        # Same reasoning as BookCoverStreamView: must not outlive the
        # presigned URL's expiry (default 3600s).
        response["Cache-Control"] = "private, max-age=3600"
        return response


# ============================================================================
# BOOK MARK AS READ VIEW
# ============================================================================


class BookMarkAsReadView(APIView):
    """Marca um livro como lido e gera sessões de leitura por dia."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Book.objects.all()

    def _get_book(self, request, pk):
        try:
            return Book.objects.get(
                pk=pk,
                owner__user=request.user,
                deleted_at__isnull=True,
            )
        except Book.DoesNotExist:
            return None

    def post(self, request, pk):
        book = self._get_book(request, pk)
        if not book:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if book.readings.filter(deleted_at__isnull=True).exists():
            return Response(
                {
                    "detail": (
                        "Este livro já possui sessões"
                        " de leitura registradas."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MarkAsReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        start_date = serializer.validated_data["start_date"]
        end_date = serializer.validated_data["end_date"]
        days = (end_date - start_date).days + 1

        avg_min_per_page = self._get_avg_minutes_per_page(
            book.literarytype, request.user
        )

        pages_base = book.pages // days
        remainder = book.pages % days

        with transaction.atomic():
            readings = []
            for i in range(days):
                day = start_date + timedelta(days=i)
                is_last = i == days - 1
                pages = pages_base + (remainder if is_last else 0)
                if pages == 0:
                    continue
                reading_time = max(1, round(pages * avg_min_per_page))
                readings.append(
                    Reading(
                        book=book,
                        reading_date=day,
                        pages_read=pages,
                        reading_time=reading_time,
                        owner=request.user.member,
                        created_by=request.user,
                        updated_by=request.user,
                    )
                )
            Reading.objects.bulk_create(readings)
            book.read_status = "read"
            book.updated_by = request.user
            book.save(
                update_fields=["read_status", "updated_at", "updated_by"]
            )

        cache.delete(f"library_dashboard_stats_{request.user.id}")

        log_activity(
            request,
            "update",
            "Book",
            book.id,
            f"Marcou '{book.title}' como lido com"
            f" {len(readings)} sessões geradas.",
            description_key="book.mark_read",
            description_params={"name": book.title, "sessions": len(readings)},
        )

        return Response(
            {"sessions_created": len(readings)},
            status=status.HTTP_201_CREATED,
        )

    def _get_avg_minutes_per_page(self, literarytype, user):
        readings_qs = Reading.objects.filter(
            deleted_at__isnull=True,
            pages_read__gt=0,
            reading_time__gt=0,
            book__literarytype=literarytype,
            owner=user.member,
        ).annotate(
            min_per_page=ExpressionWrapper(
                F("reading_time") * 1.0 / F("pages_read"),
                output_field=FloatField(),
            )
        )

        count = readings_qs.count()
        if count == 0:
            return READING_SPEED_FALLBACK.get(
                literarytype, DEFAULT_READING_SPEED
            )

        total = sum(r.min_per_page for r in readings_qs)
        return total / count


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
            description_key="summary.create",
            description_params={"name": summary.title},
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
            description_key="summary.update",
            description_params={"name": summary.title},
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
            description_key="summary.delete",
            description_params={"name": instance.title},
        )


# ============================================================================
# AI BOOK SUMMARY VIEW
# ============================================================================


class BookAISummaryView(APIView):
    """
    POST /api/v1/library/books/<pk>/ai-summary/

    Gera um resumo do livro a partir dos destaques (BookHighlight) usando IA.
    Se o livro tiver poucos highlights, usa título/autor/gênero como contexto.

    Body: { "language": "pt-BR" }  (opcional)
    Returns: { "summary": "<texto gerado>" }
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Book.objects.all()

    def post(self, request, pk):
        from members.models import Member

        try:
            member = Member.objects.get(user=request.user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(
                {"detail": "Perfil de membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            book = Book.objects.get(pk=pk, owner=member, is_deleted=False)
        except Book.DoesNotExist:
            return Response(
                {"detail": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        highlights = list(
            BookHighlight.objects.filter(
                book=book, owner=member, is_deleted=False
            ).order_by("page_number")[:50]
        )

        language = request.data.get("language", "pt-BR")

        if highlights:
            quotes_text = "\n".join(
                f"- (p.{h.page_number or '?'}) {h.text}" for h in highlights
            )
            authors_str = (
                ", ".join(a.name for a in book.authors.all()) or "Desconhecido"
            )
            user_prompt = (
                f"Livro: {book.title}\n"
                f"Autor(es): {authors_str}\n\n"
                f"Destaques do leitor:\n{quotes_text}\n\n"
                f"Com base nesses destaques, escreva um resumo conciso"
                f" e perspicaz do livro em {language}, destacando os"
                f" temas principais, a tese central e as ideias mais"
                f" relevantes capturadas pelo leitor. Máximo de 300"
                f" palavras."
            )
        else:
            if book.authors.exists():
                by_str = "de " + ", ".join(a.name for a in book.authors.all())
            else:
                by_str = ""
            user_prompt = (
                f"Escreva um resumo conciso (máximo 200 palavras, em"
                f" {language}) do livro '{book.title}' ({by_str}),"
                f" destacando seus temas principais e valor para o"
                f" leitor."
            )

        try:
            from agents.core.llm_client import LLMClient

            result = LLMClient.chat(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Você é um assistente especializado em"
                            " literatura. Gere resumos claros,"
                            " objetivos e perspicazes de livros."
                        ),
                    },
                    {"role": "user", "content": user_prompt},
                ],
                agent_name="book_ai_summary",
                language=language,
            )
        except Exception as exc:
            logger.error("Erro ao gerar resumo com IA: %s", exc)
            return Response(
                {"detail": "Serviço de IA indisponível no momento."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"summary": result, "highlight_count": len(highlights)}
        )


# ============================================================================
# READING VIEWS
# ============================================================================


class ReadingListCreateView(BaseListCreateView):
    """Lista todas as leituras ou cria uma nova."""

    queryset = Reading.objects.all()

    def get_queryset(self):
        qs = Reading.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "book")
        params = self.request.query_params
        if book_id := params.get("book"):
            qs = qs.filter(book_id=book_id)
        if date_from := params.get("date_from"):
            qs = qs.filter(reading_date__gte=date_from)
        if date_to := params.get("date_to"):
            qs = qs.filter(reading_date__lte=date_to)
        if search := params.get("search"):
            qs = qs.filter(
                Q(book__title__icontains=search) | Q(notes__icontains=search)
            )
        if genre := params.get("genre"):
            qs = qs.filter(book__genre=genre)
        if author_id := params.get("author"):
            qs = qs.filter(book__authors__id=author_id)
        if time_of_day := params.get("time_of_day"):
            qs = qs.filter(time_of_day=time_of_day)
        return qs

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
            description_key="reading.create",
            description_params={"name": reading.book.title},
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
            description_key="reading.update",
            description_params={"name": reading.book.title},
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
            description_key="reading.delete",
            description_params={"name": instance.book.title},
        )


# ============================================================================
# READING GOAL VIEWS
# ============================================================================


class ReadingGoalListCreateView(BaseListCreateView):
    """Lista todas as metas de leitura ou cria uma nova."""

    queryset = ReadingGoal.objects.all()

    def get_queryset(self):
        return (
            ReadingGoal.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("literary_type_goals")
        )

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
            f"Criou meta de leitura para {goal.year}:"
            f" {goal.books_goal} livros",
            description_key="reading_goal.create",
            description_params={"year": goal.year, "count": goal.books_goal},
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
            f"Atualizou meta de leitura para {goal.year}:"
            f" {goal.books_goal} livros",
            description_key="reading_goal.update",
            description_params={"year": goal.year, "count": goal.books_goal},
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "ReadingGoal",
            instance.id,
            f"Deletou meta de leitura para {instance.year}",
            description_key="reading_goal.delete",
            description_params={"year": instance.year},
        )


# ============================================================================
# LITERARY TYPE GOAL VIEWS
# ============================================================================


class LiteraryTypeGoalListCreateView(BaseListCreateView):
    """Lista ou cria metas por tipo literário para uma ReadingGoal."""

    queryset = LiteraryTypeGoal.objects.all()

    def get_queryset(self):
        qs = LiteraryTypeGoal.objects.filter(
            reading_goal__owner__user=self.request.user,
            deleted_at__isnull=True,
        ).select_related("reading_goal")
        if reading_goal_id := self.request.query_params.get("reading_goal"):
            qs = qs.filter(reading_goal_id=reading_goal_id)
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LiteraryTypeGoalCreateUpdateSerializer
        return LiteraryTypeGoalSerializer

    def perform_create(self, serializer):
        goal = serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )
        log_activity(
            self.request,
            "create",
            "LiteraryTypeGoal",
            goal.id,
            f"Criou meta de {goal.literary_type}: {goal.goal_count}",
            description_key="literary_goal.create",
            description_params={
                "type": goal.literary_type,
                "count": goal.goal_count,
            },
        )


class LiteraryTypeGoalDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma meta por tipo literário."""

    queryset = LiteraryTypeGoal.objects.all()

    def get_queryset(self):
        return LiteraryTypeGoal.objects.filter(
            reading_goal__owner__user=self.request.user,
            deleted_at__isnull=True,
        ).select_related("reading_goal")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return LiteraryTypeGoalCreateUpdateSerializer
        return LiteraryTypeGoalSerializer

    def perform_update(self, serializer):
        goal = serializer.save(updated_by=self.request.user)
        log_activity(
            self.request,
            "update",
            "LiteraryTypeGoal",
            goal.id,
            f"Atualizou meta de {goal.literary_type}: {goal.goal_count}",
            description_key="literary_goal.update",
            description_params={
                "type": goal.literary_type,
                "count": goal.goal_count,
            },
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()
        log_activity(
            self.request,
            "delete",
            "LiteraryTypeGoal",
            instance.id,
            f"Deletou meta de {instance.literary_type}",
            description_key="literary_goal.delete",
            description_params={"type": instance.literary_type},
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

        # Calcular avg_pages_per_day dos últimos 30 dias para estimar conclusão
        thirty_days_ago = (timezone.now() - timedelta(days=30)).date()
        readings_qs = Reading.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        )
        last_30_pages = (
            readings_qs.filter(reading_date__gte=thirty_days_ago).aggregate(
                total=Sum("pages_read")
            )["total"]
            or 0
        )
        avg_pages_per_day = last_30_pages / 30

        serializer = BookSerializer(ordered, many=True)
        data = serializer.data

        # Injetar estimated_days_to_finish em cada livro da fila
        for i, book in enumerate(ordered):
            estimated_days = None
            if avg_pages_per_day > 0:
                estimated_days = max(1, round(book.pages / avg_pages_per_day))
            data[i]["estimated_days_to_finish"] = estimated_days

        return Response({"results": data, "count": len(ordered)})


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
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

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
    CACHE_TTL = 120  # 2 minutos

    def get(self, request):
        """Calcula estatísticas do módulo de leitura."""
        user = request.user
        cache_key = f"library_dashboard_stats_{user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # Querysets filtrados por owner e não deletados
        books_qs = Book.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        authors_qs = Author.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        publishers_qs = Publisher.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )
        readings_qs = Reading.objects.filter(
            owner__user=user, deleted_at__isnull=True
        )

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
        total_pages = (
            readings_qs.aggregate(total=Sum("pages_read"))["total"] or 0
        )

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

        # Todos os livros em leitura + estimativa de conclusão por livro
        thirty_days_ago = (timezone.now() - timedelta(days=30)).date()
        last_30_pages = (
            readings_qs.filter(reading_date__gte=thirty_days_ago).aggregate(
                total=Sum("pages_read")
            )["total"]
            or 0
        )
        avg_pages_per_day = last_30_pages / 30

        current_reading_books = []
        current_reading_book = None
        for book in books_qs.filter(read_status="reading").order_by(
            "-updated_at"
        ):
            pages_read_so_far = (
                readings_qs.filter(book=book).aggregate(
                    total=Sum("pages_read")
                )["total"]
                or 0
            )
            remaining_pages = max(0, book.pages - pages_read_so_far)
            estimated_days = None
            if avg_pages_per_day > 0 and remaining_pages > 0:
                estimated_days = max(
                    1, round(remaining_pages / avg_pages_per_day)
                )
            book_data = {
                "title": book.title,
                "total_pages": book.pages,
                "pages_read": pages_read_so_far,
                "remaining_pages": remaining_pages,
                "estimated_days_to_finish": estimated_days,
            }
            current_reading_books.append(book_data)
            if current_reading_book is None:
                current_reading_book = book_data

        # Comparação mensal: mês atual vs mês anterior
        now = timezone.now()
        curr_year, curr_month = now.year, now.month
        prev_month = curr_month - 1 if curr_month > 1 else 12
        prev_year = curr_year if curr_month > 1 else curr_year - 1

        def _month_stats(year, month):
            qs = readings_qs.filter(
                reading_date__year=year, reading_date__month=month
            )
            agg = qs.aggregate(
                pages=Sum("pages_read"), minutes=Sum("reading_time")
            )
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
                    curr_stats["reading_time_hours"],
                    prev_stats["reading_time_hours"],
                ),
                "books_completed": _pct_change(
                    curr_stats["books_completed"],
                    prev_stats["books_completed"],
                ),
            },
        }

        # Livros por gênero (Top 5)
        books_by_genre = list(
            books_qs.values("genre")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # Adicionar display name dos gêneros
        from library.models import GENRES

        genre_dict = dict(GENRES)
        for item in books_by_genre:
            item["genre_display"] = genre_dict.get(
                item["genre"], item["genre"]
            )

        # Top 3 gêneros por tempo de leitura (ano atual)
        top_genres_by_time_raw = list(
            readings_qs.filter(
                reading_date__year=curr_year, reading_time__gt=0
            )
            .values(genre=F("book__genre"))
            .annotate(
                total_time=Sum("reading_time"), total_pages=Sum("pages_read")
            )
            .order_by("-total_time")[:3]
        )
        top_genres_by_time = []
        for item in top_genres_by_time_raw:
            top_genres_by_time.append(
                {
                    "genre": item["genre"],
                    "genre_display": genre_dict.get(
                        item["genre"], item["genre"]
                    ),
                    "total_time_hours": round(item["total_time"] / 60, 1),
                    "total_pages": item["total_pages"],
                }
            )

        # Livros por idioma
        books_by_language = list(
            books_qs.values("language")
            .annotate(count=Count("id"))
            .order_by("-count")
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
                    "authors_names": [
                        author.name for author in book.authors.all()
                    ],
                }
            )

        # Autor e editora mais lidos (baseado em livros com read_status='read')
        read_books_qs = books_qs.filter(read_status="read")

        most_read_author = None
        if read_books_qs.exists():
            author_stats = (
                Author.objects.filter(
                    books__in=read_books_qs,
                    owner__user=user,
                    deleted_at__isnull=True,
                )
                .annotate(
                    books_count=Count(
                        "books", filter=Q(books__in=read_books_qs)
                    ),
                    total_pages=Sum(
                        "books__pages", filter=Q(books__in=read_books_qs)
                    ),
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
                    books__in=read_books_qs,
                    owner__user=user,
                    deleted_at__isnull=True,
                )
                .annotate(
                    books_count=Count(
                        "books", filter=Q(books__in=read_books_qs)
                    ),
                    total_pages=Sum(
                        "books__pages", filter=Q(books__in=read_books_qs)
                    ),
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
                pages_read=Sum("pages_read"),
                reading_time_minutes=Sum("reading_time"),
            )
            .order_by("reading_date")
        )

        # Formatar date e adicionar reading_time_hours
        for item in reading_timeline:
            item["date"] = item["reading_date"].isoformat()
            item["reading_time_hours"] = round(
                item["reading_time_minutes"] / 60, 1
            )
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

        # Total de sessões de leitura
        total_sessions = readings_qs.count()

        # Média de páginas por sessão
        avg_pages_per_session = round(
            float(readings_qs.aggregate(avg=Avg("pages_read"))["avg"] or 0), 1
        )

        # Maior sessão (máximo de páginas em uma única sessão)
        longest_session_pages = (
            readings_qs.aggregate(mx=Max("pages_read"))["mx"] or 0
        )

        # Dia da semana mais produtivo
        from django.db.models.functions import ExtractIsoWeekDay

        weekday_stats = list(
            readings_qs.annotate(weekday=ExtractIsoWeekDay("reading_date"))
            .values("weekday")
            .annotate(total_pages=Sum("pages_read"), session_count=Count("id"))
            .order_by("-total_pages")
        )
        # ExtractIsoWeekDay: 1=Segunda, 7=Domingo
        WEEKDAY_NAMES = {
            1: "Segunda",
            2: "Terça",
            3: "Quarta",
            4: "Quinta",
            5: "Sexta",
            6: "Sábado",
            7: "Domingo",
        }
        most_productive_day = None
        if weekday_stats:
            top = weekday_stats[0]
            most_productive_day = {
                "weekday": top["weekday"],
                "weekday_display": WEEKDAY_NAMES.get(top["weekday"], "?"),
                "total_pages": top["total_pages"],
                "session_count": top["session_count"],
            }

        # Sequência de leitura (streak de dias consecutivos)
        reading_dates = set(
            readings_qs.values_list("reading_date", flat=True).distinct()
        )
        today = timezone.now().date()
        current_streak = 0
        check_date = today
        while check_date in reading_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

        longest_streak = 0
        if reading_dates:
            sorted_dates = sorted(reading_dates)
            streak = 1
            max_streak = 1
            for i in range(1, len(sorted_dates)):
                delta = (sorted_dates[i] - sorted_dates[i - 1]).days
                if delta == 1:
                    streak += 1
                    max_streak = max(max_streak, streak)
                elif delta > 1:
                    streak = 1
            longest_streak = max_streak

        reading_streak = {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
        }

        # Livros por tipo literário
        from library.models import LITERARY_TYPES

        books_by_literary_type = list(
            books_qs.values("literarytype")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        literary_type_dict = dict(LITERARY_TYPES)
        for item in books_by_literary_type:
            item["literary_type_display"] = literary_type_dict.get(
                item["literarytype"], item["literarytype"]
            )

        # Leituras por período do dia
        from library.models import TIME_OF_DAY_CHOICES

        reading_by_time_of_day = []
        for tod_value, tod_display in TIME_OF_DAY_CHOICES:
            count = readings_qs.filter(time_of_day=tod_value).count()
            total_pages_tod = (
                readings_qs.filter(time_of_day=tod_value).aggregate(
                    total=Sum("pages_read")
                )["total"]
                or 0
            )
            if count > 0:
                reading_by_time_of_day.append(
                    {
                        "time_of_day": tod_value,
                        "time_of_day_display": tod_display,
                        "session_count": count,
                        "total_pages": total_pages_tod,
                    }
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
            "avg_speed_pages_per_hour": avg_speed_pages_per_hour,
            "current_reading_book": current_reading_book,
            "current_reading_books": current_reading_books,
            "monthly_comparison": monthly_comparison,
            "top_genres_by_time": top_genres_by_time,
            "total_sessions": total_sessions,
            "avg_pages_per_session": avg_pages_per_session,
            "longest_session_pages": longest_session_pages,
            "most_productive_day": most_productive_day,
            "reading_streak": reading_streak,
            "books_by_literary_type": books_by_literary_type,
            "reading_by_time_of_day": reading_by_time_of_day,
        }

        cache.set(cache_key, stats, self.CACHE_TTL)
        return Response(stats)


class UnifiedStreakView(APIView):
    """
    GET /api/v1/library/streak/

    Retorna o streak unificado de leitura + estudo do usuário.

    Response:
    {
        "current": 5,
        "longest": 12,
        "today_completed": true
    }
    """

    permission_classes = [IsAuthenticated]
    CACHE_TTL = 60  # 1 minuto

    def get(self, request):
        user = request.user
        cache_key = f"library_streak_{user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        reading_dates = set(
            Reading.objects.filter(
                owner__user=user, deleted_at__isnull=True
            ).values_list("reading_date", flat=True)
        )
        session_dates = set(
            CourseSession.objects.filter(
                owner__user=user, deleted_at__isnull=True
            ).values_list("session_date", flat=True)
        )
        all_dates = reading_dates | session_dates

        today = timezone.now().date()
        today_completed = today in all_dates

        current_streak = 0
        check_date = today
        while check_date in all_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

        longest_streak = 0
        if all_dates:
            sorted_dates = sorted(all_dates)
            streak = 1
            max_streak = 1
            for i in range(1, len(sorted_dates)):
                delta = (sorted_dates[i] - sorted_dates[i - 1]).days
                if delta == 1:
                    streak += 1
                    max_streak = max(max_streak, streak)
                elif delta > 1:
                    streak = 1
            longest_streak = max_streak

        result = {
            "current": current_streak,
            "longest": longest_streak,
            "today_completed": today_completed,
        }
        cache.set(cache_key, result, self.CACHE_TTL)
        return Response(result)


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

        params = self.request.query_params
        if book_id := params.get("book"):
            qs = qs.filter(book_id=book_id)
        if search := params.get("search"):
            qs = qs.filter(text__icontains=search)
        if highlight_type := params.get("highlight_type"):
            qs = qs.filter(highlight_type=highlight_type)
        if color := params.get("color"):
            qs = qs.filter(color=color)
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
            description_key="highlight.create",
            description_params={"name": highlight.book.title},
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
            description_key="highlight.update",
            description_params={"name": highlight.book.title},
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
            description_key="highlight.delete",
            description_params={"name": instance.book.title},
        )


class _MarkdownRenderer(BaseRenderer):
    """Renderer marcador para permitir `?format=markdown` sem 404 no
    content negotiation do DRF. A view sempre retorna um HttpResponse
    bruto, então `render()` nunca é de fato invocado."""

    media_type = "text/markdown"
    format = "markdown"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class _CSVRenderer(BaseRenderer):
    """Renderer marcador para permitir `?format=csv` sem 404 no content
    negotiation do DRF (view retorna HttpResponse bruto)."""

    media_type = "text/csv"
    format = "csv"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class BookHighlightExportView(APIView):
    """
    GET /api/v1/library/highlights/export/?book=<id>

    Exporta destaques de um livro (ou todos) em formato Markdown.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    throttle_classes = [ExportRateThrottle]
    queryset = BookHighlight.objects.all()
    renderer_classes = [
        JSONRenderer,
        BrowsableAPIRenderer,
        _MarkdownRenderer,
        _CSVRenderer,
    ]

    def get(self, request):
        from django.http import HttpResponse

        qs = BookHighlight.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        ).select_related("book", "summary")

        book_id = request.query_params.get("book")
        if book_id:
            qs = qs.filter(book_id=book_id)

        qs = qs.order_by("book__title", "page_number", "created_at")
        export_format = request.query_params.get("format", "markdown").lower()

        safe_book_suffix = ""
        if book_id:
            try:
                book_obj = Book.objects.get(
                    pk=book_id, owner__user=request.user
                )
                safe_book_suffix = "_" + book_obj.title[:40].replace(
                    " ", "_"
                ).replace("/", "-")
            except Book.DoesNotExist:
                pass

        if export_format == "json":
            data = [
                {
                    "book": h.book.title,
                    "type": h.get_highlight_type_display(),
                    "color": h.get_color_display(),
                    "page": h.page_number,
                    "chapter": h.chapter,
                    "text": h.text,
                    "created_at": h.created_at.isoformat(),
                }
                for h in qs
            ]
            content = json.dumps(data, ensure_ascii=False, indent=2)
            filename = f"destaques{safe_book_suffix}.json"
            response = HttpResponse(
                content, content_type="application/json; charset=utf-8"
            )
            response["Content-Disposition"] = (
                f'attachment; filename="{filename}"'
            )
            return response

        if export_format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(
                ["Livro", "Tipo", "Cor", "Página", "Capítulo", "Texto"]
            )
            for h in qs:
                writer.writerow(
                    [
                        h.book.title,
                        h.get_highlight_type_display(),
                        h.get_color_display(),
                        h.page_number or "",
                        h.chapter or "",
                        h.text,
                    ]
                )
            filename = f"destaques{safe_book_suffix}.csv"
            response = HttpResponse(
                output.getvalue(), content_type="text/csv; charset=utf-8"
            )
            response["Content-Disposition"] = (
                f'attachment; filename="{filename}"'
            )
            return response

        # Default: markdown
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
            location = (
                f" — {', '.join(location_parts)}" if location_parts else ""
            )

            lines.append(f"**[{type_label}{location}]**")
            lines.append("")
            lines.append(f"> {h.text}")
            lines.append("")

        content = "\n".join(lines)
        filename = f"destaques{safe_book_suffix}.md"
        response = HttpResponse(
            content, content_type="text/markdown; charset=utf-8"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


# ============================================================================
# KINDLE IMPORT VIEW
# ============================================================================


class KindleImportView(APIView):
    """
    POST /api/v1/library/highlights/kindle-import/

    Importa highlights do arquivo "My Clippings.txt" do Kindle.
    O arquivo deve ser enviado como multipart/form-data no campo 'file'.

    Formato esperado (cada entrada separada por "=========="):
      <Título do Livro> (Autor)
      - Seu destaque na página X | Posição Y-Z | Data, DD Mês AAAA

      <texto do highlight>

    Retorna: total_imported, total_skipped, errors[]
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    parser_classes = [MultiPartParser, FormParser]
    queryset = BookHighlight.objects.all()

    _SEPARATOR = "=========="
    _PAGE_RE = re.compile(r"página\s+(\d+)", re.IGNORECASE)

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {
                    "detail": (
                        "Envie o arquivo My Clippings.txt" " no campo 'file'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content = uploaded.read().decode("utf-8-sig", errors="replace")
        except Exception:
            return Response(
                {"detail": "Não foi possível ler o arquivo. Use UTF-8."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from members.models import Member

        try:
            member = Member.objects.get(user=request.user, is_deleted=False)
        except Member.DoesNotExist:
            return Response(
                {"detail": "Perfil de membro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        entries = [
            e.strip() for e in content.split(self._SEPARATOR) if e.strip()
        ]
        imported = 0
        skipped = 0
        errors = []

        for entry in entries:
            lines = [ln for ln in entry.splitlines() if ln.strip()]
            if len(lines) < 2:
                skipped += 1
                continue

            header_line = lines[0].strip()
            meta_line = lines[1].strip() if len(lines) > 1 else ""
            text_lines = lines[2:] if len(lines) > 2 else []
            text = " ".join(text_lines).strip()

            # Skip bookmarks (no text) and notes without content
            if not text or "- Seu marcador" in meta_line:
                skipped += 1
                continue

            # Extract page number
            page_match = self._PAGE_RE.search(meta_line)
            page_number = int(page_match.group(1)) if page_match else None

            # Extract book title (strip author in parentheses at end)
            book_title = re.sub(r"\s*\([^)]+\)\s*$", "", header_line).strip()
            if not book_title:
                skipped += 1
                continue

            # Try to find existing book by title
            book = (
                Book.objects.filter(
                    owner=member,
                    title__iexact=book_title,
                    is_deleted=False,
                ).first()
                or Book.objects.filter(
                    owner=member,
                    title__icontains=book_title[:30],
                    is_deleted=False,
                ).first()
            )

            if not book:
                skipped += 1
                continue

            # Deduplicate: skip if same text already exists for this book
            already = BookHighlight.objects.filter(
                owner=member, book=book, text=text
            ).exists()
            if already:
                skipped += 1
                continue

            try:
                BookHighlight.objects.create(
                    owner=member,
                    book=book,
                    text=text,
                    page_number=page_number,
                    highlight_type="quote",
                    color="yellow",
                    created_by=request.user,
                    updated_by=request.user,
                )
                imported += 1
            except Exception as exc:
                errors.append(f"Erro ao salvar highlight '{text[:40]}': {exc}")

        return Response(
            {
                "total_imported": imported,
                "total_skipped": skipped,
                "errors": errors[:20],
            },
            status=status.HTTP_200_OK,
        )


# ============================================================================
# COURSE VIEWS
# ============================================================================


class CourseListCreateView(BaseListCreateView):
    """Lista todos os cursos ou cria um novo."""

    queryset = Course.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Course.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")
        params = self.request.query_params
        if status_filter := params.get("status"):
            qs = qs.filter(status=status_filter)
        if category := params.get("category"):
            qs = qs.filter(category=category)
        if platform := params.get("platform"):
            qs = qs.filter(platform=platform)
        if search := params.get("search"):
            qs = qs.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CourseCreateUpdateSerializer
        return CourseSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class CourseRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um curso."""

    queryset = Course.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Course.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CourseCreateUpdateSerializer
        return CourseSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


# ============================================================================
# COURSE MODULE VIEWS
# ============================================================================


class CourseModuleListCreateView(BaseListCreateView):
    """Lista módulos de um curso ou cria um novo."""

    queryset = CourseModule.objects.all()

    def get_queryset(self):
        qs = CourseModule.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "course")
        if course_id := self.request.query_params.get("course"):
            qs = qs.filter(course_id=course_id)
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CourseModuleCreateUpdateSerializer
        return CourseModuleSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class CourseModuleRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um módulo."""

    queryset = CourseModule.objects.all()

    def get_queryset(self):
        return CourseModule.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "course")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CourseModuleCreateUpdateSerializer
        return CourseModuleSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


# ============================================================================
# COURSE LESSON VIEWS
# ============================================================================


class CourseLessonListCreateView(BaseListCreateView):
    """Lista aulas de um módulo ou cria uma nova."""

    queryset = CourseLesson.objects.all()

    def get_queryset(self):
        qs = CourseLesson.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "module", "module__course")
        if module_id := self.request.query_params.get("module"):
            qs = qs.filter(module_id=module_id)
        if course_id := self.request.query_params.get("course"):
            qs = qs.filter(module__course_id=course_id)
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CourseLessonCreateUpdateSerializer
        return CourseLessonSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class CourseLessonRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma aula."""

    queryset = CourseLesson.objects.all()

    def get_queryset(self):
        return CourseLesson.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "module")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CourseLessonCreateUpdateSerializer
        return CourseLessonSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class CourseLessonToggleView(APIView):
    """Alterna o estado de conclusão de uma aula."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = CourseLesson.objects.all()

    def patch(self, request, pk):
        try:
            lesson = CourseLesson.objects.get(
                pk=pk,
                owner__user=request.user,
                deleted_at__isnull=True,
            )
        except CourseLesson.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        lesson.toggle_completed()
        return Response(CourseLessonSerializer(lesson).data)


class CourseLessonBulkCompleteView(APIView):
    """
    POST /api/v1/library/course-lessons/bulk-complete/

    Marca múltiplas aulas como concluídas ou pendentes.
    Body: { "lesson_ids": [1, 2, 3], "is_completed": true }
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = CourseLesson.objects.all()

    def post(self, request):
        lesson_ids = request.data.get("lesson_ids", [])
        is_completed = request.data.get("is_completed", True)

        if not isinstance(lesson_ids, list) or not lesson_ids:
            return Response(
                {"error": "lesson_ids deve ser uma lista não-vazia."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lessons = CourseLesson.objects.filter(
            pk__in=lesson_ids,
            owner__user=request.user,
            deleted_at__isnull=True,
        )

        now = timezone.now()
        updated = []
        for lesson in lessons:
            if is_completed and not lesson.is_completed:
                lesson.is_completed = True
                lesson.completed_at = now
            elif not is_completed and lesson.is_completed:
                lesson.is_completed = False
                lesson.completed_at = None
            else:
                continue
            lesson.save(update_fields=["is_completed", "completed_at"])
            updated.append(lesson.id)

        return Response(
            {"updated": updated, "count": len(updated)},
            status=status.HTTP_200_OK,
        )


# ============================================================================
# COURSE SESSION VIEWS
# ============================================================================


class CourseSessionListCreateView(BaseListCreateView):
    """Lista sessões de estudo de um curso ou cria uma nova."""

    queryset = CourseSession.objects.all()

    def get_queryset(self):
        qs = CourseSession.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "course")
        if course_id := self.request.query_params.get("course"):
            qs = qs.filter(course_id=course_id)
        if date_from := self.request.query_params.get("date_from"):
            qs = qs.filter(session_date__gte=date_from)
        if date_to := self.request.query_params.get("date_to"):
            qs = qs.filter(session_date__lte=date_to)
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CourseSessionCreateUpdateSerializer
        return CourseSessionSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class CourseSessionRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma sessão de estudo."""

    queryset = CourseSession.objects.all()

    def get_queryset(self):
        return CourseSession.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner", "course")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CourseSessionCreateUpdateSerializer
        return CourseSessionSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


# ============================================================================
# SKILL VIEWS
# ============================================================================


class SkillListCreateView(BaseListCreateView):
    """Lista todas as habilidades ou cria uma nova."""

    queryset = Skill.objects.all()

    def get_queryset(self):
        qs = (
            Skill.objects.filter(
                owner__user=self.request.user, deleted_at__isnull=True
            )
            .select_related("owner")
            .prefetch_related("books", "courses")
        )
        params = self.request.query_params
        if category := params.get("category"):
            qs = qs.filter(category=category)
        if proficiency := params.get("proficiency"):
            qs = qs.filter(proficiency=proficiency)
        if skill_status := params.get("status"):
            qs = qs.filter(status=skill_status)
        if search := params.get("search"):
            qs = qs.filter(
                Q(name__icontains=search) | Q(notes__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SkillCreateUpdateSerializer
        return SkillSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class SkillRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta uma habilidade."""

    queryset = Skill.objects.all()

    def get_queryset(self):
        return Skill.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return SkillCreateUpdateSerializer
        return SkillSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


# ============================================================================
# KNOWLEDGE GRAPH VIEWS
# ============================================================================


class KnowledgeLinkListCreateView(BaseListCreateView):
    """Lista todos os links de conhecimento ou cria um novo."""

    queryset = KnowledgeLink.objects.all()

    def get_queryset(self):
        return KnowledgeLink.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return KnowledgeLinkCreateUpdateSerializer
        return KnowledgeLinkSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, updated_by=self.request.user
        )


class KnowledgeLinkRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um link de conhecimento."""

    queryset = KnowledgeLink.objects.all()

    def get_queryset(self):
        return KnowledgeLink.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        ).select_related("owner")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return KnowledgeLinkCreateUpdateSerializer
        return KnowledgeLinkSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class KnowledgeGraphView(APIView):
    """Retorna todos os nós e arestas do grafo de conhecimento."""

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = KnowledgeLink.objects.all()

    def get(self, request):
        member_qs = (
            request.user.member if hasattr(request.user, "member") else None
        )
        if not member_qs:
            return Response({"nodes": [], "links": []})

        include_highlights = (
            request.query_params.get("include_highlights", "false").lower()
            == "true"
        )

        nodes = []
        links = []

        # --- Authors ---
        authors = Author.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        )
        for a in authors:
            nodes.append(
                {
                    "id": f"author-{a.uuid}",
                    "type": "author",
                    "label": a.name,
                    "metadata": {
                        "nationality_display": a.get_nationality_display(),
                    },
                }
            )

        # --- Books ---
        books = Book.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        ).prefetch_related("authors")
        for b in books:
            nodes.append(
                {
                    "id": f"book-{b.uuid}",
                    "type": "book",
                    "label": b.title,
                    "metadata": {
                        "genre": b.genre,
                        "read_status": b.read_status,
                        "pages": b.pages,
                        "rating": b.rating,
                    },
                }
            )
            for author in b.authors.filter(deleted_at__isnull=True):
                links.append(
                    {
                        "source": f"book-{b.uuid}",
                        "target": f"author-{author.uuid}",
                        "type": "implicit",
                        "relation": "written_by",
                    }
                )

        # --- Summaries ---
        summaries = Summary.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        ).select_related("book")
        for s in summaries:
            nodes.append(
                {
                    "id": f"summary-{s.uuid}",
                    "type": "summary",
                    "label": s.title,
                    "metadata": {
                        "book_title": s.book.title if s.book else None,
                    },
                }
            )
            if s.book:
                links.append(
                    {
                        "source": f"book-{s.book.uuid}",
                        "target": f"summary-{s.uuid}",
                        "type": "implicit",
                        "relation": "has_summary",
                    }
                )

        # --- Highlights (optional) ---
        if include_highlights:
            highlights = BookHighlight.objects.filter(
                owner__user=request.user, deleted_at__isnull=True
            ).select_related("book", "summary")
            for h in highlights:
                label = h.text[:80] + ("…" if len(h.text) > 80 else "")
                nodes.append(
                    {
                        "id": f"highlight-{h.uuid}",
                        "type": "highlight",
                        "label": label,
                        "metadata": {
                            "highlight_type": h.highlight_type,
                            "color": h.color,
                            "page_number": h.page_number,
                        },
                    }
                )
                links.append(
                    {
                        "source": f"book-{h.book.uuid}",
                        "target": f"highlight-{h.uuid}",
                        "type": "implicit",
                        "relation": "has_highlight",
                    }
                )
                if h.summary:
                    links.append(
                        {
                            "source": f"highlight-{h.uuid}",
                            "target": f"summary-{h.summary.uuid}",
                            "type": "implicit",
                            "relation": "linked_to",
                        }
                    )

        # --- Courses ---
        courses = Course.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        )
        for c in courses:
            nodes.append(
                {
                    "id": f"course-{c.uuid}",
                    "type": "course",
                    "label": c.title,
                    "metadata": {
                        "platform": c.platform,
                        "category": c.category,
                        "status": c.status,
                        "progress_percentage": c.progress_percentage,
                    },
                }
            )

        # --- Skills ---
        skills = Skill.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        )
        for sk in skills:
            nodes.append(
                {
                    "id": f"skill-{sk.uuid}",
                    "type": "skill",
                    "label": sk.name,
                    "metadata": {
                        "category": sk.category,
                        "proficiency": sk.proficiency,
                        "status": sk.status,
                    },
                }
            )

        # --- Explicit KnowledgeLinks ---
        knowledge_links = KnowledgeLink.objects.filter(
            owner__user=request.user, deleted_at__isnull=True
        )
        for kl in knowledge_links:
            links.append(
                {
                    "source": f"{kl.source_type}-{kl.source_id}",
                    "target": f"{kl.target_type}-{kl.target_id}",
                    "type": "explicit",
                    "relation": kl.relation_label,
                    "relation_display": kl.get_relation_label_display(),
                    "link_id": kl.id,
                }
            )

        return Response({"nodes": nodes, "links": links})


# ============================================================================
# INTELLECT BADGE VIEWS
# ============================================================================


class IntellectBadgeListView(generics.ListAPIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = IntellectBadgeSerializer

    def get_queryset(self):
        from members.models import Member

        member = Member.objects.get(user=self.request.user)
        return IntellectBadge.objects.filter(
            owner=member, deleted_at__isnull=True
        ).order_by("-awarded_at")


# ============================================================================
# SKILL HISTORY VIEW
# ============================================================================


class SkillHistoryView(generics.ListAPIView):
    """Retorna o histórico de evolução de proficiência de uma habilidade."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    serializer_class = SkillHistorySerializer

    def get_queryset(self):
        skill_id = self.kwargs["pk"]
        return SkillHistory.objects.filter(
            skill_id=skill_id,
            owner__user=self.request.user,
            deleted_at__isnull=True,
        ).order_by("created_at")


# ============================================================================
# FLASHCARD VIEWS
# ============================================================================


class FlashCardListCreateView(BaseListCreateView):
    """Lista flashcards ou cria um novo."""

    queryset = FlashCard.objects.all()

    def get_queryset(self):
        qs = FlashCard.objects.filter(
            owner__user=self.request.user,
            deleted_at__isnull=True,
        ).select_related("book", "highlight")
        due_only = self.request.query_params.get("due")
        if due_only == "true":
            qs = qs.filter(next_review__lte=timezone.localdate())
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FlashCardCreateUpdateSerializer
        return FlashCardSerializer


class FlashCardDetailView(BaseRetrieveUpdateDestroyView):
    """Recupera, atualiza ou deleta um flashcard."""

    queryset = FlashCard.objects.all()

    def get_queryset(self):
        return FlashCard.objects.filter(
            owner__user=self.request.user, deleted_at__isnull=True
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return FlashCardCreateUpdateSerializer
        return FlashCardSerializer

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.save()


class FlashCardReviewView(APIView):
    """Aplica resultado de revisão (SM-2) ao flashcard."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = FlashCard.objects.all()

    def post(self, request, pk):
        try:
            card = FlashCard.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except FlashCard.DoesNotExist:
            return Response(
                {"error": "Flash card não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = FlashCardReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        card.apply_review(serializer.validated_data["rating"])
        return Response(FlashCardSerializer(card).data)


class FlashCardFromHighlightView(APIView):
    """Cria flashcards automaticamente a partir dos destaques de um livro."""

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = FlashCard.objects.all()

    def post(self, request, pk):
        try:
            book = Book.objects.get(
                pk=pk, owner__user=request.user, deleted_at__isnull=True
            )
        except Book.DoesNotExist:
            return Response(
                {"error": "Livro não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        member = request.user.member
        highlights = BookHighlight.objects.filter(
            book=book, owner=member, deleted_at__isnull=True
        )
        created = 0
        for highlight in highlights:
            if not FlashCard.objects.filter(
                highlight=highlight, deleted_at__isnull=True
            ).exists():
                FlashCard.objects.create(
                    book=book,
                    highlight=highlight,
                    front=highlight.text[:200],
                    back=(
                        f"Livro: {book.title}"
                        + (
                            f", p. {highlight.page_number}"
                            if highlight.page_number
                            else ""
                        )
                    ),
                    owner=member,
                    created_by=request.user,
                    updated_by=request.user,
                )
                created += 1
        return Response({"created": created})


# ============================================================================
# KNOWLEDGE GRAPH SUGGEST LINKS VIEW
# ============================================================================


class KnowledgeGraphSuggestLinksView(APIView):
    """
    Sugere links de conhecimento baseados em similaridade semântica via
    pgvector. Retorna até 10 pares de nós com maior similaridade que ainda
    não têm link.
    """

    permission_classes = [IsAuthenticated, GlobalDefaultPermission]
    queryset = KnowledgeLink.objects.all()

    def get(self, request):
        try:
            from agents.models import AgentEmbedding

            member = request.user.member

            # Buscar embeddings existentes do usuário no domínio library
            embeddings = list(
                AgentEmbedding.objects.filter(domain="library").values(
                    "id",
                    "source_type",
                    "source_id",
                    "source_title",
                    "embedding",
                )[:200]
            )

            if len(embeddings) < 2:
                return Response({"suggestions": []})

            # Buscar links já existentes para excluir
            existing_links = set(
                KnowledgeLink.objects.filter(
                    owner=member, deleted_at__isnull=True
                ).values_list("source_id", "target_id")
            )

            suggestions = []
            seen = set()

            for i, emb_a in enumerate(embeddings):
                for emb_b in embeddings[i + 1 :]:
                    pair = (str(emb_a["source_id"]), str(emb_b["source_id"]))
                    rev_pair = (
                        str(emb_b["source_id"]),
                        str(emb_a["source_id"]),
                    )
                    if pair in seen or rev_pair in seen:
                        continue
                    if pair in existing_links or rev_pair in existing_links:
                        continue
                    seen.add(pair)

                    # Calcular similaridade coseno em Python
                    if emb_a["embedding"] and emb_b["embedding"]:
                        vec_a = emb_a["embedding"]
                        vec_b = emb_b["embedding"]
                        dot = sum(a * b for a, b in zip(vec_a, vec_b))
                        mag_a = sum(a * a for a in vec_a) ** 0.5
                        mag_b = sum(b * b for b in vec_b) ** 0.5
                        sim = (
                            dot / (mag_a * mag_b)
                            if mag_a > 0 and mag_b > 0
                            else 0.0
                        )
                        if sim >= 0.75:
                            suggestions.append(
                                {
                                    "source_type": emb_a["source_type"],
                                    "source_id": str(emb_a["source_id"]),
                                    "source_title": emb_a["source_title"],
                                    "target_type": emb_b["source_type"],
                                    "target_id": str(emb_b["source_id"]),
                                    "target_title": emb_b["source_title"],
                                    "similarity": round(sim, 3),
                                }
                            )

            suggestions.sort(key=lambda x: x["similarity"], reverse=True)
            return Response({"suggestions": suggestions[:10]})

        except Exception:
            logger.exception("Erro ao sugerir links de conhecimento")
            return Response({"suggestions": []})


class GoodreadsImportView(APIView):
    """
    POST /library/goodreads-import/
    Recebe CSV exportado do Goodreads e importa livros para a biblioteca do
    usuário. Usa difflib para fuzzy-match (evita duplicatas, ratio >= 0.85).
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    parser_classes = (MultiPartParser, FormParser)
    queryset = Book.objects.all()

    SHELF_MAP = {
        "read": "read",
        "currently-reading": "reading",
        "to-read": "to_read",
    }

    def post(self, request):
        import difflib

        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"detail": "Arquivo CSV obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = request.user.member

        try:
            text = csv_file.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            text = csv_file.read().decode("latin-1")

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        existing_titles = list(
            Book.objects.filter(owner=member, is_deleted=False).values_list(
                "title", flat=True
            )
        )

        imported, skipped, errors = [], [], []

        for row in rows:
            title = (row.get("Title") or "").strip()
            if not title:
                continue

            # Fuzzy-match contra livros existentes (ratio >= 0.85 = duplicata)
            close = difflib.get_close_matches(
                title, existing_titles, n=1, cutoff=0.85
            )
            if close:
                skipped.append({"title": title, "reason": "já existe"})
                continue

            shelf = (row.get("Exclusive Shelf") or "to-read").strip().lower()
            read_status = self.SHELF_MAP.get(shelf, "to_read")

            try:
                pages = int(row.get("Number of Pages") or 1) or 1
            except (ValueError, TypeError):
                pages = 1

            try:
                rating_raw = row.get("My Rating") or "0"
                rating = int(float(rating_raw)) or None
                if rating == 0:
                    rating = None
            except (ValueError, TypeError):
                rating = None

            # Resolve publisher padrão para importação Goodreads
            publisher, _ = Publisher.objects.get_or_create(
                name="Desconhecida",
                owner=member,
                defaults={
                    "created_by": request.user,
                    "updated_by": request.user,
                },
            )

            # Resolve ou cria Author
            author_name = (row.get("Author") or "").strip() or "Desconhecido"
            author, _ = Author.objects.get_or_create(
                name=author_name,
                owner=member,
                defaults={
                    "created_by": request.user,
                    "updated_by": request.user,
                },
            )

            isbn = (
                row.get("ISBN") or row.get("ISBN13") or ""
            ).strip().replace('"', "") or None

            try:
                book = Book.objects.create(
                    title=title,
                    pages=pages,
                    rating=rating,
                    read_status=read_status,
                    isbn=isbn,
                    genre="non_fiction",
                    literarytype="book",
                    publisher=publisher,
                    synopsis="Importado do Goodreads.",
                    owner=member,
                    created_by=request.user,
                    updated_by=request.user,
                )
                book.authors.add(author)
                existing_titles.append(title)
                imported.append({"title": title, "read_status": read_status})
            except Exception as exc:
                errors.append({"title": title, "error": str(exc)})

        return Response(
            {
                "imported": len(imported),
                "skipped": len(skipped),
                "errors": len(errors),
                "details": {
                    "imported": imported,
                    "skipped": skipped,
                    "errors": errors,
                },
            },
            status=status.HTTP_200_OK,
        )


class MentorPlanView(APIView):
    """
    POST /library/mentor-plan/
    Gera um plano de mentoria personalizado usando o LLM, considerando
    as habilidades atuais, livros lidos e metas de leitura do usuário.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Skill.objects.all()

    def post(self, request):
        try:
            from agents.core.llm_client import LLMClient
        except ImportError:
            return Response(
                {"detail": "Módulo de IA não disponível."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        objective = (request.data.get("objective") or "").strip()
        focus_skills = request.data.get("focus_skills") or []
        weeks = int(request.data.get("weeks") or 8)

        if not objective:
            return Response(
                {"detail": "Campo 'objective' obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Agrega contexto do usuário
        member = request.user.member
        skills = list(
            Skill.objects.filter(owner=member, is_deleted=False).values(
                "name", "proficiency"
            )
        )
        recent_books = list(
            Book.objects.filter(
                owner=member, read_status="read", is_deleted=False
            )
            .order_by("-updated_at")
            .values("title")[:10]
        )
        to_read = list(
            Book.objects.filter(
                owner=member, read_status="to_read", is_deleted=False
            )
            .order_by("reading_priority")
            .values("title")[:5]
        )

        skills_text = (
            ", ".join(
                f"{s['name']} (nível {s['proficiency']})" for s in skills
            )
            or "nenhuma"
        )
        books_read_text = (
            ", ".join(b["title"] for b in recent_books) or "nenhum"
        )
        to_read_text = ", ".join(b["title"] for b in to_read) or "nenhum"
        focus_text = ", ".join(focus_skills) if focus_skills else "livre"

        json_schema = (
            '{"summary": "...", "weekly_plan": [{"week": 1, "focus": "...",'
            ' "activities": ["..."], "books": ["..."]}],'
            ' "key_milestones": ["..."], "success_metrics": ["..."]}'
        )
        prompt = (
            "Você é um mentor especialista em aprendizado contínuo e"
            " desenvolvimento de carreira.\n\n"
            f"Contexto do estudante:\n"
            f"- Objetivo: {objective}\n"
            f"- Foco em habilidades: {focus_text}\n"
            f"- Habilidades atuais: {skills_text}\n"
            f"- Livros lidos recentemente: {books_read_text}\n"
            f"- Fila de leitura: {to_read_text}\n"
            f"- Duração do plano: {weeks} semanas\n\n"
            "Crie um plano de mentoria estruturado em JSON com o formato:\n"
            f"{json_schema}\n\n"
            "Responda APENAS com o JSON, sem texto adicional."
        )

        try:
            llm = LLMClient.get_instance()
            raw = llm.chat(prompt, timeout=30)
            # Extrai JSON da resposta
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                plan = json.loads(raw[start:end])
            else:
                plan = {
                    "summary": raw,
                    "weekly_plan": [],
                    "key_milestones": [],
                    "success_metrics": [],
                }
        except json.JSONDecodeError:
            plan = {
                "summary": raw,
                "weekly_plan": [],
                "key_milestones": [],
                "success_metrics": [],
            }
        except Exception as exc:
            logger.warning("MentorPlanView LLM error: %s", exc)
            return Response(
                {"detail": "IA temporariamente indisponível."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"objective": objective, "weeks": weeks, "plan": plan})


class MonthlyLearningReportView(APIView):
    """
    GET /library/monthly-report/?month=6&year=2026
    Agrega métricas de leitura e cursos do mês e gera relatório via LLM.
    """

    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    queryset = Reading.objects.all()

    def get(self, request):
        from django.db.models import Count, Sum

        today = timezone.now().date()
        try:
            month = int(request.query_params.get("month") or today.month)
            year = int(request.query_params.get("year") or today.year)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Parâmetros 'month' e 'year' devem ser inteiros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = request.user.member

        # Leituras do mês
        readings = Reading.objects.filter(
            owner=member,
            reading_date__month=month,
            reading_date__year=year,
            is_deleted=False,
        )
        reading_stats = readings.aggregate(
            total_sessions=Count("id"),
            total_minutes=Sum("reading_time"),
            total_pages=Sum("pages_read"),
        )

        books_completed = Book.objects.filter(
            owner=member,
            read_status="read",
            updated_at__month=month,
            updated_at__year=year,
            is_deleted=False,
        ).count()

        # Sessões de curso do mês
        course_sessions = CourseSession.objects.filter(
            owner=member,
            session_date__month=month,
            session_date__year=year,
            is_deleted=False,
        )
        course_stats = course_sessions.aggregate(
            total_sessions=Count("id"),
            total_minutes=Sum("duration_minutes"),
        )

        # Skills com maior progressão no mês (aproximação: mais atualizado)
        top_skills = list(
            Skill.objects.filter(
                owner=member,
                is_deleted=False,
                updated_at__month=month,
                updated_at__year=year,
            )
            .order_by("-updated_at")
            .values("name", "proficiency")[:5]
        )

        metrics = {
            "period": {"month": month, "year": year},
            "reading": {
                "sessions": reading_stats["total_sessions"] or 0,
                "total_minutes": reading_stats["total_minutes"] or 0,
                "total_pages": reading_stats["total_pages"] or 0,
                "books_completed": books_completed,
            },
            "courses": {
                "sessions": course_stats["total_sessions"] or 0,
                "total_minutes": course_stats["total_minutes"] or 0,
            },
            "top_skills": top_skills,
        }

        # Gera texto de resumo via LLM (opcional — degradação graciosa)
        summary_text = None
        try:
            from agents.core.llm_client import LLMClient

            r = metrics["reading"]
            c = metrics["courses"]
            hours_reading = round(r["total_minutes"] / 60, 1)
            hours_courses = round(c["total_minutes"] / 60, 1)
            skills_text = ", ".join(s["name"] for s in top_skills) or "nenhuma"

            prompt = (
                "Gere um parágrafo motivacional e objetivo (máx. 3 frases)"
                " resumindo o desempenho de aprendizado do"
                f" mês {month}/{year}:\n"
                f"- {r['sessions']} sessões de leitura ({hours_reading}h),"
                f" {r['total_pages']} páginas,"
                f" {r['books_completed']} livros concluídos\n"
                f"- {c['sessions']} sessões de curso ({hours_courses}h)\n"
                f"- Habilidades em destaque: {skills_text}\n"
                "Escreva em português brasileiro, tom encorajador."
            )
            llm = LLMClient.get_instance()
            summary_text = llm.chat(prompt, timeout=15)
        except Exception:
            pass

        return Response({**metrics, "summary": summary_text})
