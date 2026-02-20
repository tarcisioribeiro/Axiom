"""
Admin configuration for AI Assistant module.
"""

from django.contrib import admin

from .models import ConversationHistory


@admin.register(ConversationHistory)
class ConversationHistoryAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "question_short",
        "detected_module",
        "success",
        "response_time_ms",
        "created_at",
    ]
    list_filter = ["detected_module", "success", "display_type", "created_at"]
    search_fields = ["question", "ai_response"]
    readonly_fields = [
        "uuid",
        "question",
        "detected_module",
        "generated_sql",
        "query_result_count",
        "ai_response",
        "display_type",
        "response_time_ms",
        "success",
        "error_message",
        "owner",
        "created_at",
        "updated_at",
    ]
    ordering = ["-created_at"]
    date_hierarchy = "created_at"

    def question_short(self, obj):
        return obj.question[:50] + "..." if len(obj.question) > 50 else obj.question

    question_short.short_description = "Pergunta"  # type: ignore[attr-defined]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
