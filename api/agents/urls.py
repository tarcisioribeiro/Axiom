from django.urls import path

from agents.views import (
    AgentAskView,
    AgentConversationHistoryView,
    AgentNewSessionView,
    AgentStatusView,
    AgentStreamView,
    CategoryClassifyView,
    SemanticSearchView,
)

urlpatterns = [
    path("ask/", AgentAskView.as_view(), name="agent-ask"),
    path("stream/", AgentStreamView.as_view(), name="agent-stream"),
    path(
        "history/",
        AgentConversationHistoryView.as_view(),
        name="agent-history",
    ),
    path("sessions/", AgentNewSessionView.as_view(), name="agent-new-session"),
    path("status/", AgentStatusView.as_view(), name="agent-status"),
    path(
        "search/", SemanticSearchView.as_view(), name="agent-semantic-search"
    ),
    path(
        "classify-category/",
        CategoryClassifyView.as_view(),
        name="agent-classify-category",
    ),
]
