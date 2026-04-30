import os
import uuid
from typing import cast

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.core.base_agent import AgentContext
from agents.core.memory import ConversationMemory
from agents.core.router import AgentRouter
from agents.models import AgentConversation, EmbeddingDocument
from agents.serializers import (
    AgentAskSerializer,
    AgentConversationSerializer,
    AgentStatusSerializer,
    EmbeddingDocumentSerializer,
)


class AgentAskView(APIView):
    """
    POST /api/v1/agents/ask/
    Recebe uma pergunta e retorna a resposta do agente mais adequado.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        serializer = AgentAskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = cast(User, request.user)
        data = serializer.validated_data
        session_id = data["session_id"]
        query = data["query"]

        history = ConversationMemory.get(user.pk, session_id)

        ctx = AgentContext(
            user_id=user.pk,
            query=query,
            history=history,
            metadata={
                "date_from": (
                    data.get("date_from").isoformat() if data.get("date_from") else None
                ),
                "date_to": (
                    data.get("date_to").isoformat() if data.get("date_to") else None
                ),
                "forecast_days": data.get("forecast_days", 30),
            },
        )

        agent_response = AgentRouter.route(ctx)

        # Persiste no Redis
        ConversationMemory.append(user.pk, session_id, query, agent_response.content)

        # Persiste no banco para histórico permanente
        AgentConversation.objects.bulk_create(
            [
                AgentConversation(
                    user=user,
                    session_id=session_id,
                    role="user",
                    content=query,
                    created_by=user,
                    updated_by=user,
                ),
                AgentConversation(
                    user=user,
                    session_id=session_id,
                    role="agent",
                    content=agent_response.content,
                    agent_name=agent_response.agent_name,
                    created_by=user,
                    updated_by=user,
                ),
            ]
        )

        return Response(
            {
                "answer": agent_response.content,
                "agent": agent_response.agent_name,
                "sources": agent_response.sources,
                "session_id": session_id,
            }
        )


class AgentConversationHistoryView(APIView):
    """
    GET /api/v1/agents/history/?session_id=xxx
    Retorna o histórico de uma sessão.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        session_id = request.query_params.get("session_id", "default")
        conversations = AgentConversation.objects.filter(
            user=user,
            session_id=session_id,
            is_deleted=False,
        ).order_by("created_at")[:100]

        serializer = AgentConversationSerializer(conversations, many=True)
        return Response({"results": serializer.data, "session_id": session_id})

    def delete(self, request: Request) -> Response:
        """Limpa o histórico de uma sessão."""
        user = cast(User, request.user)
        session_id = request.query_params.get("session_id", "default")
        AgentConversation.objects.filter(
            user=user,
            session_id=session_id,
        ).update(is_deleted=True)
        ConversationMemory.clear(user.pk, session_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AgentNewSessionView(APIView):
    """
    POST /api/v1/agents/sessions/
    Cria um novo session_id para o usuário.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        session_id = str(uuid.uuid4())[:16]
        return Response({"session_id": session_id})


class AgentStatusView(APIView):
    """
    GET /api/v1/agents/status/
    Verifica disponibilidade do LLM.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        from agents.agents.budget_agent import BudgetAgent
        from agents.agents.finance_agent import FinanceAgent
        from agents.agents.forecast_agent import ForecastAgent
        from agents.agents.insight_agent import InsightAgent
        from agents.agents.library_agent import LibraryAgent
        from agents.agents.planning_agent import PlanningAgent
        from agents.core.llm_client import LLMClient

        provider = os.getenv("LLM_PROVIDER", "ollama")
        available = LLMClient.is_available()
        models = LLMClient.list_models() if provider == "ollama" else []

        agent_instances: list = [
            FinanceAgent(),
            BudgetAgent(),
            ForecastAgent(),
            PlanningAgent(),
            LibraryAgent(),
            InsightAgent(),
        ]
        agents_info = [
            {
                "name": a.name,
                "description": a.description,
                "model": a.get_model(),
            }
            for a in agent_instances
        ]

        serializer = AgentStatusSerializer(
            {
                "available": available,
                "provider": provider,
                "models": models,
                "agents": agents_info,
            }
        )
        return Response(serializer.data)


class EmbeddingDocumentListView(APIView):
    """
    GET /api/v1/agents/embeddings/
    Lista documentos vetorizados do usuário (para diagnóstico).
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        docs = EmbeddingDocument.objects.filter(user=user, is_deleted=False).values(
            "source_type", "source_title", "created_at"
        )
        serializer = EmbeddingDocumentSerializer(docs, many=True)
        return Response({"results": serializer.data, "count": docs.count()})
