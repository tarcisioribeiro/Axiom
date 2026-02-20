from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from app.models import BaseModel

# ============================================================================
# CHOICE CONSTANTS
# ============================================================================

NATIONALITY_CHOICES = (
    ("USA", "Americana"),
    ("BRA", "Brasileira"),
    ("SUI", "Suíça"),
    ("ALE", "Alemã"),
    ("CZE", "Checa"),
    ("ISR", "Israelense"),
    ("AUS", "Austríaca"),
    ("ROM", "Romana"),
    ("GRE", "Grega"),
    ("FRA", "Francesa"),
    ("ING", "Inglesa"),
    ("CUB", "Cubana"),
    ("MEX", "Mexicana"),
    ("ESP", "Espanhola"),
)

COUNTRIES = (
    ("BRA", "Brasil"),
    ("USA", "Estados Unidos da América"),
    ("UK", "Reino Unido"),
    ("POR", "Portugal"),
)

LANGUAGES = (("Por", "Português"), ("Ing", "Inglês"), ("Esp", "Espanhol"))

READ_STATUS_CHOICES = (
    ("to_read", "Para ler"),
    ("reading", "Lendo"),
    ("read", "Lido"),
)

GENRES = (
    ("Philosophy", "Filosofia"),
    ("History", "História"),
    ("Psychology", "Psicologia"),
    ("Fiction", "Ficção"),
    ("Policy", "Política"),
    ("Technology", "Tecnologia"),
    ("Theology", "Teologia"),
)

LITERARY_TYPES = (
    ("book", "Livro"),
    ("collection", "Coletânea"),
    ("magazine", "Revista"),
    ("article", "Artigo"),
    ("essay", "Ensaio"),
)

MEDIA_TYPE = (("Dig", "Digital"), ("Phi", "Física"))


# ============================================================================
# AUTHOR MODEL
# ============================================================================

ERA_CHOICES = (
    ("AC", "Antes de Cristo"),
    ("DC", "Depois de Cristo"),
)


class Author(BaseModel):
    """Modelo para autores de livros."""

    name = models.CharField(max_length=200, verbose_name="Nome", unique=True)
    birth_year = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Ano de Nascimento"
    )
    birth_era = models.CharField(
        max_length=2, choices=ERA_CHOICES, default="DC", verbose_name="Era (Nascimento)"
    )
    death_year = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Ano de Falecimento"
    )
    death_era = models.CharField(
        max_length=2,
        choices=ERA_CHOICES,
        null=True,
        blank=True,
        verbose_name="Era (Falecimento)",
    )
    nationality = models.CharField(
        max_length=100,
        choices=NATIONALITY_CHOICES,
        blank=True,
        null=True,
        verbose_name="Nacionalidade",
    )
    biography = models.TextField(null=True, blank=True, verbose_name="Biografia")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="authors",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Autor"
        verbose_name_plural = "Autores"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ============================================================================
# PUBLISHER MODEL
# ============================================================================


class Publisher(BaseModel):
    """Modelo para editoras."""

    name = models.CharField(max_length=200, verbose_name="Nome", unique=True)
    description = models.TextField(
        max_length=1000, blank=True, null=True, verbose_name="Descrição"
    )
    website = models.URLField(blank=True, null=True, verbose_name="Website")
    country = models.CharField(
        max_length=100, choices=COUNTRIES, blank=True, null=True, verbose_name="País"
    )
    founded_year = models.PositiveIntegerField(
        blank=True, null=True, verbose_name="Ano de fundação"
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="publishers",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Editora"
        verbose_name_plural = "Editoras"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ============================================================================
# BOOK MODEL
# ============================================================================


class Book(BaseModel):
    """Modelo para livros."""

    title = models.CharField(max_length=200, verbose_name="Título", unique=True)
    authors = models.ManyToManyField(
        Author, related_name="books", verbose_name="Autor(es)"
    )
    pages = models.PositiveIntegerField(verbose_name="Páginas", default=1)
    publisher = models.ForeignKey(
        Publisher,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Editora",
        related_name="books",
    )
    language = models.CharField(
        max_length=200,
        choices=LANGUAGES,
        blank=False,
        null=False,
        default="Por",
        verbose_name="Idioma",
    )
    genre = models.CharField(
        max_length=200, choices=GENRES, null=False, blank=False, verbose_name="Gênero"
    )
    literarytype = models.CharField(
        max_length=200,
        choices=LITERARY_TYPES,
        null=False,
        blank=False,
        verbose_name="Tipo Literário",
    )
    publish_date = models.DateField(
        null=True, blank=True, verbose_name="Data de Publicação"
    )
    synopsis = models.TextField(
        null=False,
        blank=False,
        default="Sem sinopse disponível.",
        verbose_name="Sinopse",
    )
    edition = models.CharField(
        max_length=50, null=False, blank=False, default="I", verbose_name="Edição"
    )
    media_type = models.CharField(
        verbose_name="Mídia", blank=True, null=True, choices=MEDIA_TYPE
    )
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True, default=None, verbose_name="Avaliação"
    )
    read_status = models.CharField(
        max_length=20,
        choices=READ_STATUS_CHOICES,
        default="to_read",
        verbose_name="Status de Leitura",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="books",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Livro"
        verbose_name_plural = "Livros"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


# ============================================================================
# SUMMARY MODEL
# ============================================================================


class Summary(BaseModel):
    """Modelo para resumos de livros."""

    title = models.CharField(
        max_length=200,
        verbose_name="Título",
        unique=True,
        null=False,
        blank=False,
        default="Livro",
    )
    book = models.OneToOneField(
        Book,
        on_delete=models.PROTECT,
        related_name="summary",
        verbose_name="Livro",
        unique=True,
    )
    text = models.TextField(
        verbose_name="Texto", help_text="Resumo em formato Markdown"
    )
    is_vectorized = models.BooleanField(default=False, verbose_name="Vetorizado")
    vectorization_date = models.DateTimeField(
        null=True, blank=True, verbose_name="Data de Vetorização"
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="summaries",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Resumo"
        verbose_name_plural = "Resumos"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Resumo de '{self.title}'"


# ============================================================================
# READING MODEL
# ============================================================================


class Reading(BaseModel):
    """Modelo para sessões de leitura."""

    book = models.ForeignKey(
        Book,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Livro",
        related_name="readings",
    )
    reading_date = models.DateField(
        null=False, blank=False, default=timezone.now, verbose_name="Data da Leitura"
    )
    reading_time = models.PositiveIntegerField(
        null=False, blank=False, default=30, verbose_name="Tempo de leitura (minutos)"
    )
    pages_read = models.PositiveIntegerField(
        null=False,
        blank=False,
        default=1,
        verbose_name="Páginas Lidas",
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Observações")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="readings",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Leitura"
        verbose_name_plural = "Leituras"
        ordering = ["-reading_date"]

    def clean(self):
        """Valida que o total de páginas lidas não exceda o total do livro."""
        super().clean()

        if self.book and self.pages_read:
            total_book_pages = self.book.pages
            previous_readings = Reading.objects.filter(
                book=self.book,
                deleted_at__isnull=True,  # Considera apenas não-deletados
            )

            if self.pk:
                previous_readings = previous_readings.exclude(pk=self.pk)

            total_read_pages = sum(reading.pages_read for reading in previous_readings)
            remaining_pages = total_book_pages - total_read_pages

            if self.pages_read > remaining_pages:
                raise ValidationError(
                    {
                        "pages_read": (
                            f"O livro '{self.book}' tem"
                            f" {total_book_pages} páginas no total. "
                            f"Já foram lidas {total_read_pages} páginas. "
                            f"Você só pode registrar no máximo"
                            f" {remaining_pages} páginas nesta leitura."
                        )
                    }
                )

    def __str__(self):
        return f"Leitura da obra '{self.book}' - {self.reading_date}"
