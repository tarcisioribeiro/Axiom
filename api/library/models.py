from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from app.models import BaseModel

# ============================================================================
# CHOICE CONSTANTS
# ============================================================================

NATIONALITY_CHOICES = (
    ("ALE", "Alemã"),
    ("USA", "Americana"),
    ("ARG", "Argentina"),
    ("AUL", "Australiana"),
    ("AUS", "Austríaca"),
    ("BEL", "Belga"),
    ("BRA", "Brasileira"),
    ("CAN", "Canadense"),
    ("CZE", "Checa"),
    ("CHL", "Chilena"),
    ("CHN", "Chinesa"),
    ("COL", "Colombiana"),
    ("CUB", "Cubana"),
    ("DEN", "Dinamarquesa"),
    ("EGI", "Egípcia"),
    ("SCO", "Escocesa"),
    ("ESP", "Espanhola"),
    ("FIN", "Finlandesa"),
    ("FRA", "Francesa"),
    ("GRE", "Grega"),
    ("NLD", "Holandesa"),
    ("HUN", "Húngara"),
    ("IND", "Indiana"),
    ("ING", "Inglesa"),
    ("IRL", "Irlandesa"),
    ("ISR", "Israelense"),
    ("ITA", "Italiana"),
    ("JPN", "Japonesa"),
    ("MEX", "Mexicana"),
    ("NGA", "Nigeriana"),
    ("NOR", "Norueguesa"),
    ("PER", "Peruana"),
    ("POL", "Polonesa"),
    ("POR", "Portuguesa"),
    ("ROM", "Romana"),
    ("RUS", "Russa"),
    ("SUE", "Sueca"),
    ("SUI", "Suíça"),
    ("TUR", "Turca"),
    ("UKR", "Ucraniana"),
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
    ("paused", "Pausado"),
)

TIME_OF_DAY_CHOICES = (
    ("morning", "Manhã"),
    ("afternoon", "Tarde"),
    ("evening", "Noite"),
    ("dawn", "Madrugada"),
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


def book_file_upload_to(instance, filename):
    """Armazena em pasta exclusiva por pk, preservando o nome original
    do arquivo."""
    return f"library/books/{instance.pk}/{filename}"


HIGHLIGHT_TYPE_CHOICES = (
    ("quote", "Citação"),
    ("note", "Nota"),
    ("idea", "Ideia"),
)

HIGHLIGHT_COLOR_CHOICES = (
    ("yellow", "Amarelo"),
    ("green", "Verde"),
    ("blue", "Azul"),
    ("pink", "Rosa"),
    ("orange", "Laranja"),
)

# ============================================================================
# COURSE / SKILL CHOICE CONSTANTS
# ============================================================================

COURSE_STATUS_CHOICES = (
    ("not_started", "Não iniciado"),
    ("in_progress", "Em andamento"),
    ("completed", "Concluído"),
    ("paused", "Pausado"),
)

COURSE_PLATFORM_CHOICES = (
    ("udemy", "Udemy"),
    ("coursera", "Coursera"),
    ("youtube", "YouTube"),
    ("linkedin", "LinkedIn Learning"),
    ("alura", "Alura"),
    ("pluralsight", "Pluralsight"),
    ("other", "Outro"),
)

INTELLECT_CATEGORY_CHOICES = (
    ("technology", "Tecnologia"),
    ("languages", "Idiomas"),
    ("design", "Design"),
    ("business", "Negócios"),
    ("science", "Ciências"),
    ("arts", "Artes"),
    ("other", "Outro"),
)

SKILL_PROFICIENCY_CHOICES = (
    ("beginner", "Iniciante"),
    ("basic", "Básico"),
    ("intermediate", "Intermediário"),
    ("advanced", "Avançado"),
    ("expert", "Especialista"),
)

KNOWLEDGE_NODE_TYPE_CHOICES = (
    ("book", "Livro"),
    ("course", "Curso"),
    ("skill", "Habilidade"),
    ("highlight", "Destaque"),
    ("summary", "Sumário"),
    ("author", "Autor"),
)

KNOWLEDGE_LINK_RELATION_CHOICES = (
    ("relates", "Relaciona"),
    ("supports", "Apoia"),
    ("contradicts", "Contradiz"),
    ("deepens", "Aprofunda"),
    ("derived_from", "Derivado de"),
    ("applies", "Aplica"),
)

SKILL_STATUS_CHOICES = (
    ("learning", "Aprendendo"),
    ("evolving", "Evoluindo"),
    ("mastered", "Dominando"),
)


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
        max_length=2,
        choices=ERA_CHOICES,
        default="DC",
        verbose_name="Era (Nascimento)",
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
    biography = models.TextField(
        null=True, blank=True, verbose_name="Biografia"
    )
    photo = models.ImageField(
        upload_to="library/authors/",
        null=True,
        blank=True,
        verbose_name="Foto",
    )
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
        max_length=100,
        choices=COUNTRIES,
        blank=True,
        null=True,
        verbose_name="País",
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

    title = models.CharField(max_length=200, verbose_name="Título")
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
        max_length=200,
        choices=GENRES,
        null=False,
        blank=False,
        verbose_name="Gênero",
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
        max_length=50,
        null=False,
        blank=False,
        default="I",
        verbose_name="Edição",
    )
    media_type = models.CharField(
        verbose_name="Mídia", blank=True, null=True, choices=MEDIA_TYPE
    )
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True, default=None, verbose_name="Avaliação"
    )
    cover = models.ImageField(
        upload_to="library/covers/",
        null=True,
        blank=True,
        verbose_name="Capa",
    )
    book_file = models.FileField(
        upload_to=book_file_upload_to,
        null=True,
        blank=True,
        verbose_name="Arquivo do Livro",
    )
    read_status = models.CharField(
        max_length=20,
        choices=READ_STATUS_CHOICES,
        default="to_read",
        verbose_name="Status de Leitura",
    )
    isbn = models.CharField(
        max_length=13,
        blank=True,
        null=True,
        verbose_name="ISBN",
    )
    series_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        verbose_name="Série",
    )
    series_order = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="Volume da Série",
    )
    reading_priority = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Prioridade de Leitura",
    )
    pause_reason = models.TextField(
        null=True,
        blank=True,
        verbose_name="Motivo da Pausa",
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
        constraints = [
            models.UniqueConstraint(
                fields=["title", "owner"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_book_title_owner_active",
            )
        ]

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
        null=False,
        blank=False,
        default="Resumo",
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.PROTECT,
        related_name="summaries",
        verbose_name="Livro",
    )
    text = models.TextField(
        verbose_name="Texto", help_text="Resumo em formato Markdown"
    )
    is_vectorized = models.BooleanField(
        default=False, verbose_name="Vetorizado"
    )
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
        unique_together = [["title", "book", "owner"]]

    def __str__(self):
        return f"{self.title} — {self.book.title}"


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
        null=False,
        blank=False,
        default=timezone.now,
        verbose_name="Data da Leitura",
    )
    reading_time = models.PositiveIntegerField(
        null=False,
        blank=False,
        default=30,
        verbose_name="Tempo de leitura (minutos)",
    )
    pages_read = models.PositiveIntegerField(
        null=False,
        blank=False,
        default=1,
        verbose_name="Páginas Lidas",
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Observações")
    current_page = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Página Atual",
    )
    current_cfi = models.TextField(
        null=True,
        blank=True,
        verbose_name="Posição EPUB (CFI)",
    )
    time_of_day = models.CharField(
        max_length=20,
        choices=TIME_OF_DAY_CHOICES,
        null=True,
        blank=True,
        verbose_name="Período do Dia",
    )
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

            total_read_pages = sum(
                reading.pages_read for reading in previous_readings
            )
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


# ============================================================================
# READING GOAL MODEL
# ============================================================================


class ReadingGoal(BaseModel):
    """Meta anual de leitura."""

    year = models.PositiveIntegerField(verbose_name="Ano")
    name = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Nome da Meta",
    )
    books_goal = models.PositiveIntegerField(
        verbose_name="Meta de Livros", default=12
    )
    pages_goal = models.PositiveIntegerField(
        verbose_name="Meta de Páginas", default=0, blank=True
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="reading_goals",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Meta de Leitura"
        verbose_name_plural = "Metas de Leitura"
        ordering = ["-year"]

    def __str__(self):
        return f"Meta {self.year}: {self.books_goal} livros"

    @property
    def books_read_this_year(self):
        """Livros com read_status='read' e pelo menos uma sessão de leitura
        no ano."""
        return (
            Book.objects.filter(
                owner=self.owner,
                read_status="read",
                literarytype="book",
                deleted_at__isnull=True,
                readings__deleted_at__isnull=True,
                readings__reading_date__year=self.year,
            )
            .distinct()
            .count()
        )

    @property
    def pages_read_this_year(self):
        """Total de páginas lidas no ano."""
        result = Reading.objects.filter(
            owner=self.owner,
            deleted_at__isnull=True,
            reading_date__year=self.year,
        ).aggregate(total=Sum("pages_read"))
        return result["total"] or 0

    @property
    def progress_percentage(self):
        """Porcentagem de progresso em direção à meta."""
        if self.books_goal == 0:
            return 0.0
        return round(
            min((self.books_read_this_year / self.books_goal) * 100, 100.0), 1
        )

    @property
    def pages_progress_percentage(self):
        """Porcentagem de progresso em direção à meta de páginas."""
        if self.pages_goal == 0:
            return 0.0
        return round(
            min((self.pages_read_this_year / self.pages_goal) * 100, 100.0), 1
        )


# ============================================================================
# LITERARY TYPE GOAL MODEL
# ============================================================================


class LiteraryTypeGoal(BaseModel):
    """Meta anual por tipo literário, vinculada a uma ReadingGoal."""

    reading_goal = models.ForeignKey(
        ReadingGoal,
        on_delete=models.CASCADE,
        related_name="literary_type_goals",
        verbose_name="Meta de Leitura",
    )
    literary_type = models.CharField(
        max_length=200,
        choices=LITERARY_TYPES,
        verbose_name="Tipo Literário",
    )
    goal_count = models.PositiveIntegerField(
        verbose_name="Meta (quantidade)",
        default=1,
    )

    class Meta:
        verbose_name = "Meta por Tipo Literário"
        verbose_name_plural = "Metas por Tipo Literário"
        constraints = [
            models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=("reading_goal", "literary_type"),
                name="unique_literary_type_goal_active",
            )
        ]
        ordering = ["literary_type"]

    def __str__(self):
        return (
            f"Meta {self.reading_goal.year} — "
            f"{self.get_literary_type_display()}: {self.goal_count}"
        )

    @property
    def books_read_this_year(self):
        return (
            Book.objects.filter(
                owner=self.reading_goal.owner,
                read_status="read",
                literarytype=self.literary_type,
                deleted_at__isnull=True,
                readings__deleted_at__isnull=True,
                readings__reading_date__year=self.reading_goal.year,
            )
            .distinct()
            .count()
        )

    @property
    def progress_percentage(self):
        if self.goal_count == 0:
            return 0.0
        return round(
            min((self.books_read_this_year / self.goal_count) * 100, 100.0), 1
        )


# ============================================================================
# BOOK HIGHLIGHT MODEL
# ============================================================================


class BookHighlight(BaseModel):
    """Modelo para destaques, citações e notas de livros."""

    book = models.ForeignKey(
        Book,
        on_delete=models.PROTECT,
        related_name="highlights",
        verbose_name="Livro",
    )
    text = models.TextField(verbose_name="Texto")
    page_number = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Página"
    )
    chapter = models.CharField(
        max_length=200, null=True, blank=True, verbose_name="Capítulo"
    )
    highlight_type = models.CharField(
        max_length=10,
        choices=HIGHLIGHT_TYPE_CHOICES,
        default="quote",
        verbose_name="Tipo",
    )
    color = models.CharField(
        max_length=10,
        choices=HIGHLIGHT_COLOR_CHOICES,
        default="yellow",
        verbose_name="Cor",
    )
    summary = models.ForeignKey(
        Summary,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="highlights",
        verbose_name="Resumo",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="book_highlights",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Destaque"
        verbose_name_plural = "Destaques"
        ordering = ["page_number", "created_at"]

    def __str__(self):
        page = f" (p. {self.page_number})" if self.page_number else ""
        return f"{self.get_highlight_type_display()} de '{self.book}'{page}"


# ============================================================================
# COURSE MODEL
# ============================================================================


class Course(BaseModel):
    """Modelo para cursos online."""

    title = models.CharField(max_length=200, verbose_name="Título")
    platform = models.CharField(
        max_length=20,
        choices=COURSE_PLATFORM_CHOICES,
        default="other",
        verbose_name="Plataforma",
    )
    category = models.CharField(
        max_length=20,
        choices=INTELLECT_CATEGORY_CHOICES,
        default="technology",
        verbose_name="Categoria",
    )
    description = models.TextField(
        null=True, blank=True, verbose_name="Descrição"
    )
    url = models.URLField(null=True, blank=True, verbose_name="Link")
    estimated_hours = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        null=True,
        blank=True,
        verbose_name="Carga horária estimada (h)",
    )
    status = models.CharField(
        max_length=20,
        choices=COURSE_STATUS_CHOICES,
        default="not_started",
        verbose_name="Status",
    )
    start_date = models.DateField(
        null=True, blank=True, verbose_name="Data de início"
    )
    end_date = models.DateField(
        null=True, blank=True, verbose_name="Data de conclusão"
    )
    completion_certificate = models.FileField(
        upload_to="courses/certificates/",
        null=True,
        blank=True,
        verbose_name="Comprovante de conclusão",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="courses",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Curso"
        verbose_name_plural = "Cursos"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def total_lessons(self):
        return CourseLesson.objects.filter(
            module__course=self, deleted_at__isnull=True
        ).count()

    @property
    def completed_lessons(self):
        return CourseLesson.objects.filter(
            module__course=self, is_completed=True, deleted_at__isnull=True
        ).count()

    @property
    def progress_percentage(self):
        total = self.total_lessons
        if total == 0:
            return 0.0
        return round((self.completed_lessons / total) * 100, 1)

    @property
    def invested_hours(self):
        result = CourseSession.objects.filter(
            course=self, deleted_at__isnull=True
        ).aggregate(total=Sum("duration_minutes"))
        minutes = result["total"] or 0
        return round(minutes / 60, 1)


# ============================================================================
# COURSE MODULE MODEL
# ============================================================================


class CourseModule(BaseModel):
    """Módulo (seção) de um curso."""

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="modules",
        verbose_name="Curso",
    )
    title = models.CharField(max_length=200, verbose_name="Título")
    order = models.PositiveIntegerField(default=1, verbose_name="Ordem")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="course_modules",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Módulo"
        verbose_name_plural = "Módulos"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.course.title} — {self.title}"


# ============================================================================
# COURSE LESSON MODEL
# ============================================================================


class CourseLesson(BaseModel):
    """Aula de um módulo de curso."""

    module = models.ForeignKey(
        CourseModule,
        on_delete=models.CASCADE,
        related_name="lessons",
        verbose_name="Módulo",
    )
    title = models.CharField(max_length=200, verbose_name="Título")
    order = models.PositiveIntegerField(default=1, verbose_name="Ordem")
    is_completed = models.BooleanField(default=False, verbose_name="Concluída")
    completed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Concluída em"
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="course_lessons",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Aula"
        verbose_name_plural = "Aulas"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.module.title} — {self.title}"

    def toggle_completed(self):
        self.is_completed = not self.is_completed
        self.completed_at = timezone.now() if self.is_completed else None
        self.save(update_fields=["is_completed", "completed_at", "updated_at"])


# ============================================================================
# COURSE SESSION MODEL
# ============================================================================


class CourseSession(BaseModel):
    """Sessão de estudo de um curso."""

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="sessions",
        verbose_name="Curso",
    )
    session_date = models.DateField(
        default=timezone.now, verbose_name="Data da Sessão"
    )
    duration_minutes = models.PositiveIntegerField(
        verbose_name="Duração (minutos)", default=60
    )
    notes = models.TextField(null=True, blank=True, verbose_name="Anotações")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="course_sessions",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Sessão de Estudo"
        verbose_name_plural = "Sessões de Estudo"
        ordering = ["-session_date", "-created_at"]

    def __str__(self):
        return (
            f"{self.course.title} — {self.session_date}"
            f" ({self.duration_minutes}min)"
        )


# ============================================================================
# SKILL MODEL
# ============================================================================


class Skill(BaseModel):
    """Habilidade mapeada pelo usuário."""

    name = models.CharField(max_length=200, verbose_name="Nome")
    category = models.CharField(
        max_length=20,
        choices=INTELLECT_CATEGORY_CHOICES,
        default="technology",
        verbose_name="Categoria",
    )
    proficiency = models.CharField(
        max_length=20,
        choices=SKILL_PROFICIENCY_CHOICES,
        default="beginner",
        verbose_name="Proficiência",
    )
    status = models.CharField(
        max_length=20,
        choices=SKILL_STATUS_CHOICES,
        default="learning",
        verbose_name="Status",
    )
    notes = models.TextField(null=True, blank=True, verbose_name="Observações")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="skills",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Habilidade"
        verbose_name_plural = "Habilidades"
        ordering = ["category", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "owner"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_skill_name_owner_active",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.get_proficiency_display()})"


# ============================================================================
# KNOWLEDGE LINK MODEL
# ============================================================================


class KnowledgeLink(BaseModel):
    """Conexão explícita entre dois nós do grafo de conhecimento."""

    source_type = models.CharField(
        max_length=20,
        choices=KNOWLEDGE_NODE_TYPE_CHOICES,
        verbose_name="Tipo de origem",
    )
    source_id = models.UUIDField(verbose_name="ID de origem")
    target_type = models.CharField(
        max_length=20,
        choices=KNOWLEDGE_NODE_TYPE_CHOICES,
        verbose_name="Tipo de destino",
    )
    target_id = models.UUIDField(verbose_name="ID de destino")
    relation_label = models.CharField(
        max_length=20,
        choices=KNOWLEDGE_LINK_RELATION_CHOICES,
        default="relates",
        verbose_name="Tipo de relação",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="knowledge_links",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Link de Conhecimento"
        verbose_name_plural = "Links de Conhecimento"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "source_type",
                    "source_id",
                    "target_type",
                    "target_id",
                    "owner",
                ],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_knowledge_link_active",
            )
        ]

    def __str__(self):
        return (
            f"{self.source_type}:{self.source_id}"
            f" → {self.target_type}:{self.target_id}"
        )
