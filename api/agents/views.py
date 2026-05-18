import json
import re
import uuid
from collections.abc import Generator
from typing import cast

from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.core.base_agent import AgentContext
from agents.core.memory import ConversationMemory
from agents.core.router import AgentRouter
from agents.models import AgentConversation
from agents.serializers import (
    AgentAskSerializer,
    AgentConversationSerializer,
    AgentStatusSerializer,
)
from app.throttles import AgentRateThrottle

# Patterns that indicate prompt injection attempts.
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:previous|all|prior)\s+instructions?", re.I),
    re.compile(r"system\s*prompt", re.I),
    re.compile(r"you\s+are\s+now\s+(?:a\s+)?(?:dan|jailbreak|evil|unrestricted)", re.I),
    re.compile(r"disregard\s+(?:your|all|the)\s+(?:previous|system|prior)", re.I),
    re.compile(r"act\s+as\s+if\s+you\s+(?:have\s+no|are\s+not)", re.I),
]

_MAX_QUERY_LEN = 2000


def _sanitize_query(query: str) -> tuple[bool, str]:
    """Return (is_safe, cleaned_query). Strips control chars; rejects injection."""
    # Remove non-printable control characters (except newline/tab)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", query).strip()
    if len(cleaned) > _MAX_QUERY_LEN:
        cleaned = cleaned[:_MAX_QUERY_LEN]
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(cleaned):
            return False, cleaned
    return True, cleaned


class AgentAskView(APIView):
    """
    POST /api/v1/agents/ask/
    Recebe uma pergunta e retorna a resposta do agente mais adequado.
    """

    permission_classes = (IsAuthenticated,)
    throttle_classes = [AgentRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = AgentAskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = cast(User, request.user)
        data = serializer.validated_data
        session_id = data["session_id"]
        raw_query = data["query"]
        is_safe, query = _sanitize_query(raw_query)
        if not is_safe:
            return Response(
                {"error": "Consulta inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        query_id = uuid.uuid4()

        history = ConversationMemory.get(user.pk, session_id)

        ctx = AgentContext(
            user_id=user.pk,
            query=query,
            history=history,
            language=data.get("language", "pt-BR"),
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
                    query_id=query_id,
                    created_by=user,
                    updated_by=user,
                ),
                AgentConversation(
                    user=user,
                    session_id=session_id,
                    role="agent",
                    content=agent_response.content,
                    agent_name=agent_response.agent_name,
                    query_id=query_id,
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
                "query_id": str(query_id),
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
        from agents.core.llm_client import LLMClient, _cfg

        provider = _cfg("LLM_PROVIDER", "ollama")
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


@method_decorator(csrf_exempt, name="dispatch")
class AgentStreamView(APIView):
    """
    POST /api/v1/agents/stream/
    Streaming SSE endpoint — yields tokens as they arrive from the LLM.
    """

    permission_classes = (IsAuthenticated,)
    throttle_classes = [AgentRateThrottle]

    def post(self, request: Request) -> Response | StreamingHttpResponse:
        serializer = AgentAskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = cast(User, request.user)
        data = serializer.validated_data
        session_id = data["session_id"]
        raw_query = data["query"]
        is_safe, query = _sanitize_query(raw_query)
        if not is_safe:
            return Response(
                {"error": "Consulta inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        query_id = str(uuid.uuid4())

        history = ConversationMemory.get(user.pk, session_id)
        ctx = AgentContext(
            user_id=user.pk,
            query=query,
            history=history,
            language=data.get("language", "pt-BR"),
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

        agent = AgentRouter.select(ctx)

        def event_stream() -> Generator[str, None, None]:
            full_content = ""
            try:
                for token in agent.stream(ctx):
                    full_content += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

                sources = getattr(agent, "_stream_sources", [])
                done_payload = json.dumps(
                    {
                        "done": True,
                        "agent": agent.name,
                        "sources": sources,
                        "query_id": query_id,
                    }
                )
                yield f"data: {done_payload}\n\n"

                ConversationMemory.append(user.pk, session_id, query, full_content)
                AgentConversation.objects.bulk_create(
                    [
                        AgentConversation(
                            user=user,
                            session_id=session_id,
                            role="user",
                            content=query,
                            query_id=query_id,
                            created_by=user,
                            updated_by=user,
                        ),
                        AgentConversation(
                            user=user,
                            session_id=session_id,
                            role="agent",
                            content=full_content,
                            agent_name=agent.name,
                            query_id=query_id,
                            created_by=user,
                            updated_by=user,
                        ),
                    ]
                )
            except GeneratorExit:
                # Persiste o que foi acumulado antes da desconexão do cliente
                if full_content:
                    try:
                        ConversationMemory.append(
                            user.pk, session_id, query, full_content
                        )
                        AgentConversation.objects.bulk_create(
                            [
                                AgentConversation(
                                    user=user,
                                    session_id=session_id,
                                    role="user",
                                    content=query,
                                    query_id=query_id,
                                    created_by=user,
                                    updated_by=user,
                                ),
                                AgentConversation(
                                    user=user,
                                    session_id=session_id,
                                    role="agent",
                                    content=full_content,
                                    agent_name=agent.name,
                                    query_id=query_id,
                                    created_by=user,
                                    updated_by=user,
                                ),
                            ]
                        )
                    except Exception:
                        pass
                return

        response = StreamingHttpResponse(
            event_stream(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
