from django.contrib import admin

from agents.models import AgentConversation


@admin.register(AgentConversation)
class AgentConversationAdmin(admin.ModelAdmin):
    list_display = ("user", "session_id", "role", "agent_name", "created_at")
    list_filter = ("role", "agent_name")
    search_fields = ("user__username", "session_id", "content")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
