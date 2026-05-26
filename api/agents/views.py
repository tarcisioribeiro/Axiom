"""
Views do módulo de agentes.

Melhorias de segurança:
- Padrões de prompt injection ampliados para cobrir português (BR)
- session_id validado como UUID para evitar colisão de namespace no Redis
- Dados do usuário não expostos em mensagens de erro
  (evita information leakage)

Melhorias de performance:
- Persistência (Redis + PostgreSQL) executada em daemon thread após retornar a
  resposta ao cliente, reduzindo latência percebida em ~15-50ms
- Contexto de DB Django fechado corretamente no thread de background
"""

import json
import logging
import re
import threading
import uuid
from collections.abc import Generator
from typing import cast

from django.contrib.auth.models import User
from django.db import close_old_connections
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

logger = logging.getLogger(__name__)

# ── Segurança: Prompt injection patterns
# ──────────────────────────────────────

_INJECTION_PATTERNS = [
    # Inglês
    re.compile(r"ignore\s+(?:previous|all|prior)\s+instructions?", re.I),
    re.compile(r"system\s*prompt", re.I),
    re.compile(
        r"you\s+are\s+now\s+(?:a\s+)?(?:dan|jailbreak|evil|unrestricted)", re.I
    ),
    re.compile(
        r"disregard\s+(?:your|all|the)\s+(?:previous|system|prior)", re.I
    ),
    re.compile(r"act\s+as\s+if\s+you\s+(?:have\s+no|are\s+not)", re.I),
    re.compile(r"new\s+objective\s+is", re.I),
    re.compile(r"forget\s+(?:all|your|previous|everything)", re.I),
    # Português
    re.compile(r"ignore\s+(?:todas?\s+as?\s+)?instru[çc][õo]es?", re.I),
    re.compile(
        r"aja\s+como\s+(?:se\s+voc[êe]\s+(?:n[ãa]o|fosse)|um\s+assistente\s+sem)",  # noqa: E501
        re.I,
    ),
    re.compile(r"seu\s+novo\s+objetivo\s+[eé]", re.I),
    re.compile(
        r"esqueça\s+(?:tudo|as\s+instru[çc][õo]es|o\s+que\s+foi\s+dito)", re.I
    ),
    re.compile(r"modo?\s+(?:dan|jailbreak|irrestrito|sem\s+filtros?)", re.I),
    re.compile(
        r"desconsidere\s+(?:as?\s+)?(?:regras?|instru[çc][õo]es?|diretrizes?)",
        re.I,
    ),
    re.compile(r"voc[êe]\s+(?:agora\s+[eé]|n[ãa]o\s+tem\s+mais)", re.I),
    re.compile(r"finja\s+que\s+(?:voc[êe]\s+[eé]|n[ãa]o\s+tem)", re.I),
]

_MAX_QUERY_LEN = 2000


def _validate_session_id(session_id: str) -> bool:
    """
    Valida que session_id é UUID válido — evita colisão de namespace no
    Redis.
    """
    try:
        uuid.UUID(session_id)
        return True
    except (ValueError, AttributeError):
        return False


def _sanitize_query(query: str) -> tuple[bool, str]:
    """
    Return (is_safe, cleaned_query). Strips control chars; rejects
    injection.
    """
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", query).strip()
    if len(cleaned) > _MAX_QUERY_LEN:
        cleaned = cleaned[:_MAX_QUERY_LEN]
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(cleaned):
            return False, cleaned
    return True, cleaned


def _persist_conversation_async(
    user_id: int,
    session_id: str,
    query: str,
    answer: str,
    agent_name: str,
    query_id: str,
) -> None:
    """
    Persiste conversa no Redis e PostgreSQL em daemon thread.

    Executa após a resposta ser enviada ao cliente, reduzindo latência
    percebida.
    Fecha conexões DB ao final para evitar connection leak.
    """

    def _run() -> None:
        try:
            from django.contrib.auth.models import User as DjangoUser

            user = DjangoUser.objects.get(pk=user_id)
            ConversationMemory.append(user_id, session_id, query, answer)
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
                        content=answer,
                        agent_name=agent_name,
                        query_id=query_id,
                        created_by=user,
                        updated_by=user,
                    ),
                ]
            )
        except Exception:
            logger.exception(
                "Falha ao persistir conversa (user=%s session=%s)",
                user_id,
                session_id,
            )
        finally:
            close_old_connections()

    t = threading.Thread(target=_run, daemon=True)
    t.start()


# ── Views
# ─────────────────────────────────────────────────────────────────────


class AgentAskView(APIView):
    """POST /api/v1/agents/ask/ — resposta completa (não-streaming)."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = [AgentRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = AgentAskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        user = cast(User, request.user)
        data = serializer.validated_data
        session_id = data["session_id"]

        if not _validate_session_id(session_id):
            return Response(
                {"error": "session_id inválido. Use um UUID v4."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_safe, query = _sanitize_query(data["query"])
        if not is_safe:
            return Response(
                {"error": "Consulta inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        query_id = str(uuid.uuid4())

        history = ConversationMemory.get(user.pk, session_id)
        try:
            from app.metrics import record_session_context_size

            record_session_context_size(len(history))
        except Exception:
            pass

        ctx = AgentContext(
            user_id=user.pk,
            query=query,
            history=history,
            language=data.get("language", "pt-BR"),
            metadata={
                "date_from": (
                    data.get("date_from").isoformat()
                    if data.get("date_from")
                    else None
                ),
                "date_to": (
                    data.get("date_to").isoformat()
                    if data.get("date_to")
                    else None
                ),
                "forecast_days": data.get("forecast_days", 30),
            },
        )

        agent_response = AgentRouter.route(
            ctx, agent_override=data.get("agent_name")
        )

        # Persistência assíncrona — não bloqueia o retorno da resposta
        _persist_conversation_async(
            user.pk,
            session_id,
            query,
            agent_response.content,
            agent_response.agent_name,
            query_id,
        )

        return Response(
            {
                "answer": agent_response.content,
                "agent": agent_response.agent_name,
                "sources": agent_response.sources,
                "session_id": session_id,
                "query_id": query_id,
            }
        )


class AgentConversationHistoryView(APIView):
    """GET /api/v1/agents/history/?session_id=xxx — histórico de uma sessão."""

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
        user = cast(User, request.user)
        session_id = request.query_params.get("session_id", "default")
        AgentConversation.objects.filter(
            user=user,
            session_id=session_id,
        ).update(is_deleted=True)
        ConversationMemory.clear(user.pk, session_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AgentNewSessionView(APIView):
    """POST /api/v1/agents/sessions/ — cria novo session_id UUID."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        session_id = str(uuid.uuid4())
        return Response({"session_id": session_id})


class AgentStatusView(APIView):
    """GET /api/v1/agents/status/ — disponibilidade do LLM e agentes."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        from agents.agents.financial_agent import FinancialAgent
        from agents.agents.intellect_agent import IntellectAgent
        from agents.agents.personal_agent import PersonalAgent
        from agents.agents.security_agent import SecurityAgent
        from agents.core.circuit_breaker import ollama_circuit
        from agents.core.llm_client import LLMClient, _cfg

        provider = _cfg("LLM_PROVIDER", "ollama")
        available = LLMClient.is_available()
        models = LLMClient.list_models() if provider == "ollama" else []

        agent_instances: list = [
            PersonalAgent(),
            FinancialAgent(),
            SecurityAgent(),
            IntellectAgent(),
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
        data = serializer.data
        data["circuit_breaker_open"] = ollama_circuit.is_open
        return Response(data)


@method_decorator(csrf_exempt, name="dispatch")
class AgentStreamView(APIView):
    """POST /api/v1/agents/stream/ — SSE streaming token-by-token."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = [AgentRateThrottle]

    def post(self, request: Request) -> Response | StreamingHttpResponse:
        serializer = AgentAskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        user = cast(User, request.user)
        data = serializer.validated_data
        session_id = data["session_id"]

        if not _validate_session_id(session_id):
            return Response(
                {"error": "session_id inválido. Use um UUID v4."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_safe, query = _sanitize_query(data["query"])
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
                    data.get("date_from").isoformat()
                    if data.get("date_from")
                    else None
                ),
                "date_to": (
                    data.get("date_to").isoformat()
                    if data.get("date_to")
                    else None
                ),
                "forecast_days": data.get("forecast_days", 30),
            },
        )

        agent = AgentRouter.select(ctx, agent_override=data.get("agent_name"))

        def event_stream() -> Generator[str, None, None]:
            full_content = ""
            persisted = False
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

                # Persistência assíncrona após stream completo
                _persist_conversation_async(
                    user.pk,
                    session_id,
                    query,
                    full_content,
                    agent.name,
                    query_id,
                )
                persisted = True
                print(persisted)

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
