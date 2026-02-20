from rest_framework import serializers

from library.models import Author, Book, Publisher, Reading, Summary

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

    class Meta:
        model = Author
        fields = [
            "id",
            "uuid",
            "name",
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
    genre_display = serializers.CharField(source="get_genre_display", read_only=True)
    literarytype_display = serializers.CharField(
        source="get_literarytype_display", read_only=True
    )
    media_type_display = serializers.CharField(
        source="get_media_type_display", read_only=True
    )
    read_status_display = serializers.CharField(
        source="get_read_status_display", read_only=True
    )

    authors_names = serializers.SerializerMethodField()
    publisher_name = serializers.CharField(source="publisher.name", read_only=True)
    has_summary = serializers.SerializerMethodField()
    total_pages_read = serializers.SerializerMethodField()
    reading_progress = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "uuid",
            "title",
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
            "has_summary",
            "total_pages_read",
            "reading_progress",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_authors_names(self, obj):
        return [author.name for author in obj.authors.all()]

    def get_has_summary(self, obj):
        return hasattr(obj, "summary")

    def get_total_pages_read(self, obj):
        total = sum(r.pages_read for r in obj.readings.filter(deleted_at__isnull=True))
        return total

    def get_reading_progress(self, obj):
        if obj.pages > 0:
            total_read = self.get_total_pages_read(obj)
            return round((total_read / obj.pages) * 100, 1)
        return 0.0


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
            "owner",
        ]

    def to_internal_value(self, data):
        """Converte strings vazias para None nos campos opcionais."""
        if "publish_date" in data and data["publish_date"] == "":
            data = data.copy()
            data["publish_date"] = None
        if "rating" in data and (data["rating"] == "" or data["rating"] is None):
            data = data.copy()
            data["rating"] = None
        return super().to_internal_value(data)


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
        - 'reading' -> 'read': quando total de páginas lidas >= páginas do livro
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
