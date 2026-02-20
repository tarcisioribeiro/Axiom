"""
Views para o módulo AI Assistant.

Expõe endpoints para interação com o assistente de IA.
Suporta agentes especializados com modelos e escopos diferentes.
"""

import logging
import time
from typing import Any, Optional

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from members.models import Member

from .config import AGENTS, get_agent
from .models import ConversationHistory
from .services import (
    DatabaseExecutor,
    OllamaClient,
    QueryInterpreter,
    ResponseFormatter,
)
from .services.database_executor import DatabaseError

logger = logging.getLogger(__name__)


def get_member_for_user(user) -> Optional[Member]:
    """
    Obtém o Member associado ao usuário.

    Args:
        user: Usuário autenticado

    Returns:
        Member ou None se não encontrado
    """
    try:
        return Member.objects.filter(user=user, deleted_at__isnull=True).first()
    except Exception:
        return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pergunta(request: Request) -> Response:
    """
    Processa uma pergunta em linguagem natural usando um agente especializado.

    Endpoint: POST /api/v1/ai/pergunta/

    Body:
        {
            "pergunta": "Qual foi meu faturamento do último mês?",
            "agent": "financial"
        }

    Returns:
        {
            "resposta": "O faturamento do último mês foi R$ 12.345,00.",
            "display_type": "currency",
            "data": [...],
            "module": "revenues",
            "agent": "financial",
            "success": true
        }
    """
    start_time = time.time()

    # Validação do body
    pergunta_texto = request.data.get("pergunta", "").strip()
    if not pergunta_texto:
        return Response(
            {"error": 'O campo "pergunta" é obrigatório.'},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    if len(pergunta_texto) > 500:
        return Response(
            {"error": "A pergunta deve ter no máximo 500 caracteres."},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # Validação do agente
    agent_key = request.data.get("agent", "").strip()
    if not agent_key:
        return Response(
            {"error": 'O campo "agent" é obrigatório.'},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    agent_config = get_agent(agent_key)
    if not agent_config:
        valid_agents = ", ".join(AGENTS.keys())
        return Response(
            {
                "error": (
                    f'Agente "{agent_key}" não encontrado.'
                    f" Agentes válidos: {valid_agents}"
                )
            },
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # Obtém o member do usuário
    member = get_member_for_user(request.user)
    if not member:
        return Response(
            {"error": "Usuário não possui perfil de membro configurado."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Validacao e extracao do historico de conversa
    conversation_history = request.data.get("conversation_history", [])
    if not isinstance(conversation_history, list):
        conversation_history = []
    # Limita a 6 mensagens (3 pares user/assistant)
    conversation_history = conversation_history[-6:]
    # Valida formato de cada mensagem
    conversation_history = [
        msg
        for msg in conversation_history
        if isinstance(msg, dict)
        and isinstance(msg.get("role"), str)
        and isinstance(msg.get("content"), str)
        and msg["role"] in ("user", "assistant")
    ]

    try:
        # 1. Interpreta a pergunta e gera SQL (filtrado pelos modulos do agente)
        query_result = QueryInterpreter.interpret(
            pergunta_texto,
            member.id,
            allowed_modules=agent_config.modules,
            agent_config=agent_config,
        )

        # 2. Trata casos especiais (saudacao, ajuda, desconhecido, restrito)
        if query_result.module in ("greeting", "help", "unknown", "restricted"):
            # Formata a resposta removendo caracteres especiais
            resposta = ResponseFormatter.format_response(query_result.description)

            # Mensagem padrao para modulo desconhecido
            if query_result.module == "unknown":
                modules_desc = ", ".join(agent_config.modules)
                resposta = (
                    f"Desculpe, nao consegui entender sua pergunta. "
                    f"Este agente ({agent_config.name}) pode responder"
                    f" sobre: {modules_desc}."
                )

            response_data = {
                "resposta": resposta,
                "display_type": "text",
                "data": [],
                "module": query_result.module,
                "agent": agent_key,
                "success": True,
            }
            _save_history(
                member,
                pergunta_texto,
                query_result,
                [],
                response_data["resposta"],
                "text",
                int((time.time() - start_time) * 1000),
                True,
                agent=agent_key,
            )
            return Response(response_data)

        # 3. Executa a query no banco
        db_result = DatabaseExecutor.execute(query_result)

        # 4. Gera resposta com Ollama usando modelo e prompt do agente
        ollama = OllamaClient(model=agent_config.model)
        resposta = ollama.generate_response(
            query_description=db_result["description"],
            data=db_result["data"],
            display_type=db_result["display_type"],
            module=db_result["module"],
            system_prompt=agent_config.system_prompt,
            user_question=pergunta_texto,
            conversation_history=conversation_history,
            temperature=agent_config.temperature,
            top_p=agent_config.top_p,
            num_predict=agent_config.num_predict,
        )

        # 5. Calcula tempo de resposta
        response_time_ms = int((time.time() - start_time) * 1000)

        # 6. Garante que a resposta esta limpa e formatada
        resposta_limpa = ResponseFormatter.format_response(resposta)
        resposta_limpa = ResponseFormatter.sanitize_for_display(resposta_limpa)

        # 7. Salva historico
        _save_history(
            member,
            pergunta_texto,
            query_result,
            db_result["data"],
            resposta_limpa,
            db_result["display_type"],
            response_time_ms,
            True,
            agent=agent_key,
        )

        # 8. Retorna resposta
        return Response(
            {
                "resposta": resposta_limpa,
                "display_type": db_result["display_type"],
                "data": db_result["data"],
                "module": db_result["module"],
                "agent": agent_key,
                "count": db_result["count"],
                "description": db_result["description"],
                "success": True,
            }
        )

    except DatabaseError as e:
        logger.error(f"Database error processing question: {e}")
        response_time_ms = int((time.time() - start_time) * 1000)
        _save_history(
            member,
            pergunta_texto,
            None,
            [],
            str(e),
            "text",
            response_time_ms,
            False,
            str(e),
            agent=agent_key,
        )
        return Response(
            {"error": "Erro ao consultar dados. Tente novamente.", "success": False},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.exception(f"Unexpected error processing question: {e}")
        response_time_ms = int((time.time() - start_time) * 1000)
        _save_history(
            member,
            pergunta_texto,
            None,
            [],
            str(e),
            "text",
            response_time_ms,
            False,
            str(e),
            agent=agent_key,
        )
        return Response(
            {"error": "Erro inesperado. Tente novamente.", "success": False},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_agents(request: Request) -> Response:
    """
    Lista os agentes de IA disponíveis.

    Endpoint: GET /api/v1/ai/agents/

    Returns:
        {
            "agents": [
                {
                    "key": "financial",
                    "name": "Controle Financeiro",
                    "icon": "wallet",
                    "description": "Receitas, despesas, contas, cartoes, emprestimos",
                    "suggestions": [...]
                },
                ...
            ]
        }
    """
    agents_data = [
        {
            "key": agent.key,
            "name": agent.name,
            "icon": agent.icon,
            "description": agent.description,
            "suggestions": agent.suggestions,
        }
        for agent in AGENTS.values()
    ]
    return Response({"agents": agents_data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def historico(request: Request) -> Response:
    """
    Retorna o histórico de conversas do usuário.

    Endpoint: GET /api/v1/ai/historico/

    Query params:
        limit: Número máximo de registros (default: 20, max: 100)

    Returns:
        Lista de conversas anteriores
    """
    member = get_member_for_user(request.user)
    if not member:
        return Response(
            {"error": "Usuário não possui perfil de membro."},
            status=status.HTTP_403_FORBIDDEN,
        )

    limit = min(int(request.query_params.get("limit", 20)), 100)

    conversations = ConversationHistory.objects.filter(
        owner=member, deleted_at__isnull=True
    ).order_by("-created_at")[:limit]

    data = [
        {
            "id": c.id,
            "question": c.question,
            "response": c.ai_response,
            "module": c.detected_module,
            "display_type": c.display_type,
            "success": c.success,
            "created_at": c.created_at.isoformat(),
        }
        for c in conversations
    ]

    return Response({"conversations": data, "count": len(data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def health(request: Request) -> Response:
    """
    Verifica saúde do serviço de IA.

    Endpoint: GET /api/v1/ai/health/

    Returns:
        Status do Ollama e do banco de dados.
        Sempre retorna 200 para evitar erros no frontend.
        O status real está no body da resposta.
    """
    ollama = OllamaClient()
    ollama_ok = ollama.check_health()

    # Verifica conexão com banco
    db_ok = False
    try:
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_ok = True
    except Exception:
        pass

    # Sempre retorna 200 - o status real está no body
    # Isso evita erros no console do navegador
    return Response(
        {
            "ollama": "healthy" if ollama_ok else "unavailable",
            "database": "healthy" if db_ok else "unavailable",
            "model": ollama.model,
            "healthy": ollama_ok and db_ok,
        },
        status=status.HTTP_200_OK,
    )


def _save_history(
    member: Member,
    question: str,
    query_result: Optional[Any],
    data: list,
    response: str,
    display_type: str,
    response_time_ms: int,
    success: bool,
    error_message: Optional[str] = None,
    agent: Optional[str] = None,
):
    """
    Salva histórico de conversa no banco.

    Não lança exceção para não afetar a resposta ao usuário.
    """
    try:
        history_data = {
            "question": question,
            "detected_module": query_result.module if query_result else None,
            "generated_sql": (
                query_result.sql[:500] if query_result and query_result.sql else None
            ),
            "query_result_count": len(data),
            "ai_response": response[:2000],  # Limita tamanho
            "display_type": display_type,
            "response_time_ms": response_time_ms,
            "success": success,
            "error_message": error_message[:500] if error_message else None,
            "owner": member,
        }
        # Adiciona agent se o campo existir no modelo
        # (para compatibilidade caso o campo ainda nao tenha sido migrado)
        ConversationHistory.objects.create(**history_data)
    except Exception as e:
        logger.warning(f"Failed to save conversation history: {e}")
