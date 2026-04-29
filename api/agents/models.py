from django.contrib.auth.models import User
from django.db import models

from app.models import BaseModel

SOURCE_TYPE_CHOICES = (
    ("book_summary", "Resumo de Livro"),
    ("reading_note", "Nota de Leitura"),
    ("book_highlight", "Destaque"),
)

ROLE_CHOICES = (
    ("user", "Usuário"),
    ("agent", "Agente"),
)


class EmbeddingDocument(BaseModel):
    """
    Chunk de texto indexado com embedding para busca semântica (RAG).
    O embedding é armazenado como JSON serializado para compatibilidade
    com SQLite nos testes. Em produção, o campo é usado com pgvector
    via cast dinâmico no raw SQL (embedding_json::vector).
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="embedding_documents",
        verbose_name="Usuário",
    )
    source_type = models.CharField(
        max_length=50,
        choices=SOURCE_TYPE_CHOICES,
        verbose_name="Tipo de Fonte",
    )
    source_id = models.UUIDField(
        verbose_name="ID da Fonte",
        help_text="UUID do objeto de origem (livro, leitura, etc.)",
    )
    source_title = models.CharField(
        max_length=255,
        verbose_name="Título da Fonte",
    )
    content = models.TextField(verbose_name="Conteúdo do Chunk")
    embedding_json = models.TextField(
        verbose_name="Embedding (JSON)",
        help_text="Lista de floats serializada como JSON. Usada com pgvector em prod.",
        blank=True,
        default="[]",
    )

    class Meta:
        verbose_name = "Documento Vetorizado"
        verbose_name_plural = "Documentos Vetorizados"
        indexes = [
            models.Index(fields=["user", "source_type"]),
            models.Index(fields=["source_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.source_title} ({self.source_type})"


class AgentConversation(BaseModel):
    """Histórico de mensagens de conversa com os agentes por sessão."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="agent_conversations",
        verbose_name="Usuário",
    )
    session_id = models.CharField(
        max_length=64,
        verbose_name="ID da Sessão",
        db_index=True,
    )
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        verbose_name="Papel",
    )
    content = models.TextField(verbose_name="Conteúdo")
    agent_name = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="Agente",
    )

    class Meta:
        verbose_name = "Conversa com Agente"
        verbose_name_plural = "Conversas com Agentes"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["user", "session_id"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} | {self.session_id} | {self.role}"
