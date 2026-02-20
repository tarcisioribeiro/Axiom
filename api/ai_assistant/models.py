"""
Models para o módulo AI Assistant.

Armazena histórico de conversas para análise e melhoria contínua.
"""

from django.db import models

from app.models import BaseModel


class ConversationHistory(BaseModel):
    """
    Histórico de conversas com o assistente de IA.

    Armazena perguntas, respostas e metadados para análise.
    """

    question = models.TextField(
        verbose_name="Pergunta", help_text="Pergunta feita pelo usuário"
    )
    detected_module = models.CharField(
        max_length=100,
        verbose_name="Módulo Detectado",
        null=True,
        blank=True,
        help_text="Módulo do sistema identificado na pergunta",
    )
    generated_sql = models.TextField(
        verbose_name="SQL Gerado",
        null=True,
        blank=True,
        help_text="Query SQL gerada (sem dados sensíveis)",
    )
    query_result_count = models.IntegerField(
        verbose_name="Quantidade de Resultados",
        default=0,
        help_text="Número de registros retornados pela query",
    )
    ai_response = models.TextField(
        verbose_name="Resposta da IA", help_text="Resposta gerada pelo Ollama"
    )
    display_type = models.CharField(
        max_length=50,
        verbose_name="Tipo de Exibição",
        default="text",
        help_text="Como a resposta foi formatada (text, table, list)",
    )
    response_time_ms = models.IntegerField(
        verbose_name="Tempo de Resposta (ms)",
        default=0,
        help_text="Tempo total para processar a pergunta",
    )
    success = models.BooleanField(
        verbose_name="Sucesso",
        default=True,
        help_text="Se a pergunta foi processada com sucesso",
    )
    error_message = models.TextField(
        verbose_name="Mensagem de Erro",
        null=True,
        blank=True,
        help_text="Detalhes do erro se houver falha",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="ai_conversations",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Histórico de Conversa"
        verbose_name_plural = "Histórico de Conversas"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "-created_at"]),
            models.Index(fields=["detected_module", "-created_at"]),
            models.Index(fields=["success", "-created_at"]),
        ]

    def __str__(self):
        return f"Conversa {self.id} - {self.question[:50]}..."
