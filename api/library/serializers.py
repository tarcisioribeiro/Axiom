from datetime import date, timedelta

from django.db.models import Count, Sum
from rest_framework import serializers

from library.models import (
    Author,
    Book,
    BookHighlight,
    Course,
    CourseLesson,
    CourseModule,
    CourseSession,
    KnowledgeLink,
    LiteraryTypeGoal,
    Publisher,
    Reading,
    ReadingGoal,
    Skill,
    Summary,
)

# ============================================================================
# BOOK REORDER SERIALIZER
# ============================================================================


class BookReorderItemSerializer(serializers.Serializer):
    """Item de reordenação da fila de leitura."""

    id = serializers.IntegerField()
    priority = serializers.IntegerField(min_value=1)


# ============================================================================
# AUTHOR SERIALIZERS
# ============================================================================


class AuthorSerializer(serializers.ModelSerializer):
    """Serializer para visualização de autores."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    nationality_display = serializers.CharField(
        source="get_nationality_display", read_only=True
    )
    birth_era_display = serializers.CharField(
        source="get_birth_era_display", read_only=True
    )
    death_era_display = serializers.CharField(
        source="get_death_era_display", read_only=True
    )
    books_count = serializers.SerializerMethodField()
    birth_display = serializers.SerializerMethodField()
    death_display = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Author
        fields = [
            "id",
            "uuid",
            "name",
            "photo",
            "birth_year",
            "birth_era",
            "birth_era_display",
            "death_year",
            "death_era",
            "death_era_display",
            "birth_display",
            "death_display",
            "nationality",
            "nationality_display",
            "biography",
            "books_count",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_photo(self, obj):
        if not obj.photo:
            return None
        return f"/api/v1/library/authors/{obj.pk}/photo/"

    def get_books_count(self, obj):
        return obj.books.filter(deleted_at__isnull=True).count()

    def get_birth_display(self, obj):
        """Retorna o ano de nascimento formatado (ex: '384 AC')."""
        if obj.birth_year:
            era = obj.birth_era or "DC"
            return f"{obj.birth_year} {era}"
        return None

    def get_death_display(self, obj):
        """Retorna o ano de falecimento formatado (ex: '322 AC')."""
        if obj.death_year:
            era = obj.death_era or "DC"
            return f"{obj.death_year} {era}"
        return None


class AuthorCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de autores."""

    class Meta:
        model = Author
        fields = [
            "id",
            "name",
            "photo",
            "birth_year",
            "birth_era",
            "death_year",
            "death_era",
            "nationality",
            "biography",
            "owner",
        ]


# ============================================================================
# PUBLISHER SERIALIZERS
# ============================================================================


class PublisherSerializer(serializers.ModelSerializer):
    """Serializer para visualização de editoras."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    country_display = serializers.CharField(
        source="get_country_display", read_only=True
    )
    books_count = serializers.SerializerMethodField()

    class Meta:
        model = Publisher
        fields = [
            "id",
            "uuid",
            "name",
            "description",
            "website",
            "country",
            "country_display",
            "founded_year",
            "books_count",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_books_count(self, obj):
        return obj.books.filter(deleted_at__isnull=True).count()


class PublisherCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de editoras."""

    class Meta:
        model = Publisher
        fields = [
            "id",
            "name",
            "description",
            "website",
            "country",
            "founded_year",
            "owner",
        ]


# ============================================================================
# BOOK SERIALIZERS
# ============================================================================


class BookSerializer(serializers.ModelSerializer):
    """Serializer para visualização de livros."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    language_display = serializers.CharField(
        source="get_language_display", read_only=True
    )
    genre_display = serializers.CharField(
        source="get_genre_display", read_only=True
    )
    literarytype_display = serializers.CharField(
        source="get_literarytype_display", read_only=True
    )
    media_type_display = serializers.CharField(
        source="get_media_type_display", read_only=True
    )
    read_status_display = serializers.CharField(
        source="get_read_status_display", read_only=True
    )

    authors: serializers.Field = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True
    )
    authors_names = serializers.SerializerMethodField()
    publisher_name = serializers.CharField(
        source="publisher.name", read_only=True
    )
    has_summary = serializers.SerializerMethodField()
    total_pages_read = serializers.SerializerMethodField()
    reading_progress = serializers.SerializerMethodField()
    general_avg_pages_per_day = serializers.SerializerMethodField()
    book_avg_pages_per_day = serializers.SerializerMethodField()
    estimated_completion_general = serializers.SerializerMethodField()
    estimated_completion_book = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "uuid",
            "title",
            "isbn",
            "series_name",
            "series_order",
            "cover",
            "authors",
            "authors_names",
            "pages",
            "publisher",
            "publisher_name",
            "language",
            "language_display",
            "genre",
            "genre_display",
            "literarytype",
            "literarytype_display",
            "publish_date",
            "synopsis",
            "edition",
            "media_type",
            "media_type_display",
            "rating",
            "read_status",
            "read_status_display",
            "pause_reason",
            "reading_priority",
            "book_file",
            "has_summary",
            "total_pages_read",
            "reading_progress",
            "general_avg_pages_per_day",
            "book_avg_pages_per_day",
            "estimated_completion_general",
            "estimated_completion_book",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_cover(self, obj):
        if not obj.cover:
            return None
        return f"/api/v1/library/books/{obj.pk}/cover/"

    def get_authors_names(self, obj):
        return [author.name for author in obj.authors.all()]

    def get_has_summary(self, obj):
        return obj.summaries.filter(deleted_at__isnull=True).exists()

    def get_total_pages_read(self, obj):
        total = sum(
            r.pages_read for r in obj.readings.filter(deleted_at__isnull=True)
        )
        return total

    def get_reading_progress(self, obj):
        if obj.pages > 0:
            total_read = self.get_total_pages_read(obj)
            return round((total_read / obj.pages) * 100, 1)
        return 0.0

    def _calc_avg_pages_per_day(self, readings_qs):
        """Calcula média de páginas por dia baseado em dias distintos
        de leitura."""
        agg = readings_qs.aggregate(
            total_pages=Sum("pages_read"),
            distinct_days=Count("reading_date", distinct=True),
        )
        distinct_days = agg["distinct_days"] or 0
        total_pages = agg["total_pages"] or 0
        if distinct_days == 0:
            return 0.0
        return round(total_pages / distinct_days, 2)

    def get_general_avg_pages_per_day(self, obj):
        """Média geral do membro: todas as leituras de todos os livros."""
        if not obj.owner_id:
            return 0.0
        readings_qs = Reading.objects.filter(
            owner=obj.owner,
            deleted_at__isnull=True,
        )
        return self._calc_avg_pages_per_day(readings_qs)

    def get_book_avg_pages_per_day(self, obj):
        """Média específica deste livro: apenas leituras deste livro."""
        readings_qs = obj.readings.filter(deleted_at__isnull=True)
        return self._calc_avg_pages_per_day(readings_qs)

    def _estimated_completion(self, obj, avg_pages_per_day):
        """Retorna a data estimada de conclusão ou None."""
        if obj.read_status == "read" or avg_pages_per_day <= 0:
            return None
        total_read = self.get_total_pages_read(obj)
        remaining = obj.pages - total_read
        if remaining <= 0:
            return None
        days_needed = remaining / avg_pages_per_day
        estimated_date = date.today() + timedelta(days=days_needed)
        return estimated_date.isoformat()

    def get_estimated_completion_general(self, obj):
        avg = self.get_general_avg_pages_per_day(obj)
        return self._estimated_completion(obj, avg)

    def get_estimated_completion_book(self, obj):
        avg = self.get_book_avg_pages_per_day(obj)
        return self._estimated_completion(obj, avg)


class BookCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de livros."""

    authors = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Author.objects.filter(deleted_at__isnull=True)
    )
    publish_date = serializers.DateField(required=False, allow_null=True)
    rating = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=5
    )

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "isbn",
            "series_name",
            "series_order",
            "cover",
            "book_file",
            "authors",
            "pages",
            "publisher",
            "language",
            "genre",
            "literarytype",
            "publish_date",
            "synopsis",
            "edition",
            "media_type",
            "rating",
            "read_status",
            "pause_reason",
            "reading_priority",
            "owner",
        ]

    def to_internal_value(self, data):
        """Converte strings vazias para None nos campos opcionais."""
        if "publish_date" in data and data["publish_date"] == "":
            data = data.copy()
            data["publish_date"] = None
        if "rating" in data and (
            data["rating"] == "" or data["rating"] is None
        ):
            data = data.copy()
            data["rating"] = None
        return super().to_internal_value(data)

    def validate(self, data):
        title = data.get("title", getattr(self.instance, "title", None))
        owner = data.get("owner", getattr(self.instance, "owner", None))
        if title and owner:
            qs = Book.objects.filter(
                title=title, owner=owner, deleted_at__isnull=True
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"title": "Você já possui um livro com este título."}
                )
        return data


# ============================================================================
# SUMMARY SERIALIZERS
# ============================================================================


class SummarySerializer(serializers.ModelSerializer):
    """Serializer para visualização de resumos."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    book_title = serializers.CharField(source="book.title", read_only=True)

    class Meta:
        model = Summary
        fields = [
            "id",
            "uuid",
            "title",
            "book",
            "book_title",
            "text",
            "is_vectorized",
            "vectorization_date",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "uuid",
            "is_vectorized",
            "vectorization_date",
            "created_at",
            "updated_at",
        ]


class SummaryCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de resumos."""

    class Meta:
        model = Summary
        fields = ["id", "title", "book", "text", "owner"]


# ============================================================================
# READING SERIALIZERS
# ============================================================================


class ReadingSerializer(serializers.ModelSerializer):
    """Serializer para visualização de leituras."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    book_title = serializers.CharField(source="book.title", read_only=True)
    time_of_day_display = serializers.CharField(
        source="get_time_of_day_display", read_only=True
    )

    class Meta:
        model = Reading
        fields = [
            "id",
            "uuid",
            "book",
            "book_title",
            "reading_date",
            "reading_time",
            "pages_read",
            "notes",
            "current_page",
            "current_cfi",
            "time_of_day",
            "time_of_day_display",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class ReadingCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de leituras."""

    class Meta:
        model = Reading
        fields = [
            "id",
            "book",
            "reading_date",
            "reading_time",
            "pages_read",
            "notes",
            "current_page",
            "current_cfi",
            "time_of_day",
            "owner",
        ]

    def validate(self, data):
        """Validação customizada para páginas lidas."""
        instance = self.instance
        if instance:
            # Cria uma instância temporária para validação
            temp_instance = Reading(**data)
            temp_instance.pk = instance.pk
        else:
            temp_instance = Reading(**data)

        temp_instance.clean()  # Chama o método clean() do model
        return data

    def create(self, validated_data):
        """Cria a leitura e atualiza o status do livro automaticamente."""
        reading = super().create(validated_data)
        self._update_book_status(reading.book)
        return reading

    def update(self, instance, validated_data):
        """Atualiza a leitura e recalcula o status do livro."""
        reading = super().update(instance, validated_data)
        self._update_book_status(reading.book)
        return reading

    def _update_book_status(self, book):
        """
        Atualiza o status do livro baseado nas leituras:
        - 'to_read' -> 'reading': quando a primeira leitura é cadastrada
        - 'reading' -> 'read': quando total de páginas lidas >=
          páginas do livro
        """
        # Calcula o total de páginas lidas
        total_pages_read = sum(
            r.pages_read for r in book.readings.filter(deleted_at__isnull=True)
        )

        # Se atingiu ou ultrapassou o total de páginas, marca como lido
        if total_pages_read >= book.pages:
            if book.read_status != "read":
                book.read_status = "read"
                book.save(update_fields=["read_status", "updated_at"])
        # Se tem leituras e está como "para ler", muda para "lendo"
        elif book.read_status == "to_read" and total_pages_read > 0:
            book.read_status = "reading"
            book.save(update_fields=["read_status", "updated_at"])


# ============================================================================
# READING GOAL SERIALIZERS
# ============================================================================


class LiteraryTypeGoalSerializer(serializers.ModelSerializer):
    """Serializer para visualização de metas por tipo literário."""

    literary_type_display = serializers.CharField(
        source="get_literary_type_display", read_only=True
    )
    books_read_this_year = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = LiteraryTypeGoal
        fields = [
            "id",
            "uuid",
            "literary_type",
            "literary_type_display",
            "goal_count",
            "books_read_this_year",
            "progress_percentage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_books_read_this_year(self, obj):
        return obj.books_read_this_year

    def get_progress_percentage(self, obj):
        return obj.progress_percentage


class LiteraryTypeGoalCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de metas por tipo literário."""

    class Meta:
        model = LiteraryTypeGoal
        fields = ["id", "reading_goal", "literary_type", "goal_count"]
        validators: list = []

    def validate(self, data):
        reading_goal = data.get("reading_goal")
        literary_type = data.get("literary_type")
        instance = self.instance

        if literary_type == "book":
            raise serializers.ValidationError(
                {
                    "literary_type": (
                        "Livros são contabilizados pela meta principal."
                        " Selecione outro tipo literário."
                    )
                }
            )

        if reading_goal and literary_type:
            qs = LiteraryTypeGoal.objects.filter(
                reading_goal=reading_goal,
                literary_type=literary_type,
                deleted_at__isnull=True,
            )
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "literary_type": (
                            f"Já existe uma meta para '{literary_type}'"
                            " nessa meta de leitura."
                        )
                    }
                )
        return data


class ReadingGoalSerializer(serializers.ModelSerializer):
    """Serializer para visualização de metas de leitura."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    books_read_this_year = serializers.SerializerMethodField()
    pages_read_this_year = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    pages_progress_percentage = serializers.SerializerMethodField()
    literary_type_goals = serializers.SerializerMethodField()

    def get_literary_type_goals(self, obj):
        qs = obj.literary_type_goals.filter(deleted_at__isnull=True)
        return LiteraryTypeGoalSerializer(qs, many=True).data

    class Meta:
        model = ReadingGoal
        fields = [
            "id",
            "uuid",
            "year",
            "name",
            "books_goal",
            "pages_goal",
            "books_read_this_year",
            "pages_read_this_year",
            "progress_percentage",
            "pages_progress_percentage",
            "literary_type_goals",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_books_read_this_year(self, obj):
        return obj.books_read_this_year

    def get_pages_read_this_year(self, obj):
        return obj.pages_read_this_year

    def get_progress_percentage(self, obj):
        return obj.progress_percentage

    def get_pages_progress_percentage(self, obj):
        return obj.pages_progress_percentage


class ReadingGoalCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de metas de leitura."""

    class Meta:
        model = ReadingGoal
        fields = ["id", "year", "name", "books_goal", "pages_goal", "owner"]


# ============================================================================
# BOOK HIGHLIGHT SERIALIZERS
# ============================================================================


class BookHighlightSerializer(serializers.ModelSerializer):
    """Serializer para visualização de destaques de livros."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    book_title = serializers.CharField(source="book.title", read_only=True)
    summary_title = serializers.SerializerMethodField()
    highlight_type_display = serializers.CharField(
        source="get_highlight_type_display", read_only=True
    )
    color_display = serializers.CharField(
        source="get_color_display", read_only=True
    )

    class Meta:
        model = BookHighlight
        fields = [
            "id",
            "uuid",
            "book",
            "book_title",
            "text",
            "page_number",
            "chapter",
            "highlight_type",
            "highlight_type_display",
            "color",
            "color_display",
            "summary",
            "summary_title",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_summary_title(self, obj):
        return obj.summary.title if obj.summary else None


class BookHighlightCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de destaques."""

    class Meta:
        model = BookHighlight
        fields = [
            "id",
            "book",
            "text",
            "page_number",
            "chapter",
            "highlight_type",
            "color",
            "summary",
            "owner",
        ]


# ============================================================================
# MARK AS READ SERIALIZER
# ============================================================================


class MarkAsReadSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=True)
    end_date = serializers.DateField(required=True)

    def validate(self, data):
        if data["end_date"] < data["start_date"]:
            raise serializers.ValidationError(
                {
                    "end_date": (
                        "A data de fim deve ser igual ou posterior"
                        " à data de início."
                    )
                }
            )
        return data


# ============================================================================
# COURSE SERIALIZERS
# ============================================================================


class CourseSerializer(serializers.ModelSerializer):
    """Serializer para visualização de cursos."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    platform_display = serializers.CharField(
        source="get_platform_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    total_lessons = serializers.IntegerField(read_only=True)
    completed_lessons = serializers.IntegerField(read_only=True)
    progress_percentage = serializers.FloatField(read_only=True)
    invested_hours = serializers.FloatField(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "uuid",
            "title",
            "platform",
            "platform_display",
            "category",
            "category_display",
            "description",
            "url",
            "estimated_hours",
            "status",
            "status_display",
            "start_date",
            "end_date",
            "total_lessons",
            "completed_lessons",
            "progress_percentage",
            "invested_hours",
            "owner",
            "owner_name",
            "completion_certificate",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de cursos."""

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "platform",
            "category",
            "description",
            "url",
            "estimated_hours",
            "status",
            "start_date",
            "end_date",
            "completion_certificate",
            "owner",
        ]


# ============================================================================
# COURSE MODULE SERIALIZERS
# ============================================================================


class CourseLessonSerializer(serializers.ModelSerializer):
    """Serializer para visualização de aulas."""

    module_title = serializers.CharField(source="module.title", read_only=True)
    owner_name = serializers.CharField(source="owner.name", read_only=True)

    class Meta:
        model = CourseLesson
        fields = [
            "id",
            "uuid",
            "module",
            "module_title",
            "title",
            "order",
            "is_completed",
            "completed_at",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at", "completed_at"]


class CourseLessonCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de aulas."""

    class Meta:
        model = CourseLesson
        fields = ["id", "module", "title", "order", "is_completed", "owner"]


class CourseModuleSerializer(serializers.ModelSerializer):
    """Serializer para visualização de módulos com suas aulas."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    lessons = serializers.SerializerMethodField()
    total_lessons = serializers.SerializerMethodField()
    completed_lessons = serializers.SerializerMethodField()

    class Meta:
        model = CourseModule
        fields = [
            "id",
            "uuid",
            "course",
            "course_title",
            "title",
            "order",
            "lessons",
            "total_lessons",
            "completed_lessons",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_lessons(self, obj):
        lessons = obj.lessons.filter(deleted_at__isnull=True).order_by("order")
        return CourseLessonSerializer(lessons, many=True).data

    def get_total_lessons(self, obj):
        return obj.lessons.filter(deleted_at__isnull=True).count()

    def get_completed_lessons(self, obj):
        return obj.lessons.filter(
            is_completed=True, deleted_at__isnull=True
        ).count()


class CourseModuleCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de módulos."""

    class Meta:
        model = CourseModule
        fields = ["id", "course", "title", "order", "owner"]


# ============================================================================
# COURSE SESSION SERIALIZERS
# ============================================================================


class CourseSessionSerializer(serializers.ModelSerializer):
    """Serializer para visualização de sessões de estudo."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    duration_hours = serializers.SerializerMethodField()

    class Meta:
        model = CourseSession
        fields = [
            "id",
            "uuid",
            "course",
            "course_title",
            "session_date",
            "duration_minutes",
            "duration_hours",
            "notes",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_duration_hours(self, obj):
        return round(obj.duration_minutes / 60, 1)


class CourseSessionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de sessões de estudo."""

    class Meta:
        model = CourseSession
        fields = [
            "id",
            "course",
            "session_date",
            "duration_minutes",
            "notes",
            "owner",
        ]


# ============================================================================
# SKILL SERIALIZERS
# ============================================================================


class SkillSerializer(serializers.ModelSerializer):
    """Serializer para visualização de habilidades."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    proficiency_display = serializers.CharField(
        source="get_proficiency_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    proficiency_level = serializers.SerializerMethodField()

    class Meta:
        model = Skill
        fields = [
            "id",
            "uuid",
            "name",
            "category",
            "category_display",
            "proficiency",
            "proficiency_display",
            "proficiency_level",
            "status",
            "status_display",
            "notes",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_proficiency_level(self, obj):
        levels = {
            "beginner": 1,
            "basic": 2,
            "intermediate": 3,
            "advanced": 4,
            "expert": 5,
        }
        return levels.get(obj.proficiency, 1)


class SkillCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de habilidades."""

    def validate(self, data):
        owner = data.get("owner") or (
            self.instance.owner if self.instance else None
        )
        name = data.get("name") or (
            self.instance.name if self.instance else None
        )
        if owner and name:
            qs = Skill.objects.filter(
                name__iexact=name, owner=owner, deleted_at__isnull=True
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"name": "Já existe uma habilidade com esse nome."}
                )
        return data

    class Meta:
        model = Skill
        fields = [
            "id",
            "name",
            "category",
            "proficiency",
            "status",
            "notes",
            "owner",
        ]


# ============================================================================
# KNOWLEDGE LINK SERIALIZERS
# ============================================================================


class KnowledgeLinkSerializer(serializers.ModelSerializer):
    """Serializer para visualização de links de conhecimento."""

    relation_label_display = serializers.CharField(
        source="get_relation_label_display", read_only=True
    )
    source_type_display = serializers.CharField(
        source="get_source_type_display", read_only=True
    )
    target_type_display = serializers.CharField(
        source="get_target_type_display", read_only=True
    )

    class Meta:
        model = KnowledgeLink
        fields = [
            "id",
            "uuid",
            "source_type",
            "source_type_display",
            "source_id",
            "target_type",
            "target_type_display",
            "target_id",
            "relation_label",
            "relation_label_display",
            "owner",
            "created_at",
            "updated_at",
        ]


class KnowledgeLinkCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de links de conhecimento."""

    class Meta:
        model = KnowledgeLink
        fields = [
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            "relation_label",
            "owner",
        ]
