from django.contrib import admin

from library.models import (
    Author,
    Book,
    BookHighlight,
    Course,
    CourseLesson,
    CourseModule,
    CourseSession,
    LiteraryTypeGoal,
    Publisher,
    Reading,
    ReadingGoal,
    Skill,
    Summary,
)


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ["name", "nationality", "birth_year", "owner", "created_at"]
    search_fields = ["name"]
    list_filter = ["nationality"]


@admin.register(Publisher)
class PublisherAdmin(admin.ModelAdmin):
    list_display = ["name", "country", "founded_year", "owner", "created_at"]
    search_fields = ["name"]
    list_filter = ["country"]


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "genre",
        "language",
        "read_status",
        "rating",
        "owner",
        "created_at",
    ]
    search_fields = ["title", "isbn", "series_name"]
    list_filter = ["genre", "language", "read_status", "media_type"]
    filter_horizontal = ["authors"]


@admin.register(Summary)
class SummaryAdmin(admin.ModelAdmin):
    list_display = ["title", "book", "is_vectorized", "owner", "created_at"]
    search_fields = ["title", "book__title"]
    list_filter = ["is_vectorized"]


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = [
        "book",
        "reading_date",
        "pages_read",
        "reading_time",
        "owner",
    ]
    search_fields = ["book__title"]
    list_filter = ["reading_date"]


@admin.register(ReadingGoal)
class ReadingGoalAdmin(admin.ModelAdmin):
    list_display = ["year", "books_goal", "pages_goal", "owner", "created_at"]
    list_filter = ["year"]


@admin.register(LiteraryTypeGoal)
class LiteraryTypeGoalAdmin(admin.ModelAdmin):
    list_display = [
        "reading_goal",
        "literary_type",
        "goal_count",
        "created_at",
    ]
    list_filter = ["literary_type"]


@admin.register(BookHighlight)
class BookHighlightAdmin(admin.ModelAdmin):
    list_display = [
        "book",
        "highlight_type",
        "color",
        "page_number",
        "owner",
        "created_at",
    ]
    search_fields = ["text", "book__title"]
    list_filter = ["highlight_type", "color"]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "platform",
        "category",
        "status",
        "owner",
        "created_at",
    ]
    search_fields = ["title"]
    list_filter = ["platform", "category", "status"]


@admin.register(CourseModule)
class CourseModuleAdmin(admin.ModelAdmin):
    list_display = ["title", "course", "order", "owner", "created_at"]
    search_fields = ["title", "course__title"]
    list_filter = ["course"]


@admin.register(CourseLesson)
class CourseLessonAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "module",
        "order",
        "is_completed",
        "owner",
        "created_at",
    ]
    search_fields = ["title", "module__title"]
    list_filter = ["is_completed"]


@admin.register(CourseSession)
class CourseSessionAdmin(admin.ModelAdmin):
    list_display = [
        "course",
        "session_date",
        "duration_minutes",
        "owner",
        "created_at",
    ]
    search_fields = ["course__title"]
    list_filter = ["session_date"]


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "category",
        "proficiency",
        "status",
        "owner",
        "created_at",
    ]
    search_fields = ["name"]
    list_filter = ["category", "proficiency", "status"]
