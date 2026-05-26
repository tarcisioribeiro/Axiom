import uuid

from django.contrib.auth.models import User
from django.db import models

from pgvector.django import VectorField  # type: ignore[import-untyped]

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

DOMAIN_CHOICES = (
    ("finance", "Finanças"),
    ("budget", "Orçamento"),
    ("planning", "Planejamento"),
    ("library", "Biblioteca"),
    ("general", "Geral"),
)

AGENT_SOURCE_TYPE_CHOICES = (
    ("expense", "Despesa"),
    ("revenue", "Receita"),
    ("budget", "Orçamento"),
    ("task", "Tarefa"),
    ("goal", "Meta"),
    ("routine", "Rotina"),
    ("book_summary", "Resumo de Livro"),
    ("reading_note", "Nota de Leitura"),
    ("highlight", "Destaque"),
    ("credit_card_bill", "Fatura de Cartão"),
)


class AgentEmbedding(models.Model):
    """
    Embedding vetorial real (pgvector) por domínio e fonte.
    Substitui EmbeddingDocument para buscas semânticas em prod.
    Armazenado em vectors.agent_embeddings (schema dedicado no PostgreSQL).
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="ID",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="agent_embeddings",
        verbose_name="Usuário",
    )
    domain = models.CharField(
        max_length=20,
        choices=DOMAIN_CHOICES,
        verbose_name="Domínio",
    )
    source_type = models.CharField(
        max_length=50,
        choices=AGENT_SOURCE_TYPE_CHOICES,
        verbose_name="Tipo de Fonte",
    )
    source_id = models.UUIDField(verbose_name="ID da Fonte")
    source_title = models.CharField(
        max_length=255, verbose_name="Título da Fonte"
    )
    content = models.TextField(verbose_name="Conteúdo")
    embedding = VectorField(dimensions=768, verbose_name="Embedding")
    is_deleted = models.BooleanField(default=False, verbose_name="Excluído")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Criado em"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Atualizado em"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_agent_embeddings",
        verbose_name="Criado por",
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_agent_embeddings",
        verbose_name="Atualizado por",
    )
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deleted_agent_embeddings",
        verbose_name="Excluído por",
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Excluído em",
    )

    class Meta:
        verbose_name = "Embedding de Agente"
        verbose_name_plural = "Embeddings de Agentes"
        db_table = '"vectors"."agent_embeddings"'

    def __str__(self) -> str:
        return f"{self.source_title} ({self.domain}/{self.source_type})"


class EmbeddingDocument(BaseModel):
    """
    DEPRECATED: Substituído por AgentEmbedding (VectorField real,
    schema vectors).
    Mantido com managed=True para não quebrar o migration history.
    Não deve ser usado em novos fluxos — use AgentEmbedding.
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
        help_text=(
            "Lista de floats serializada como JSON."
            " Usada com pgvector em prod."
        ),
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
    query_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="ID da Consulta",
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
