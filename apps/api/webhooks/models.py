import hashlib
import hmac

from django.db import models

from app.models import BaseModel

WEBHOOK_EVENT_CHOICES = (
    ("expense.created", "Despesa criada"),
    ("expense.updated", "Despesa atualizada"),
    ("expense.deleted", "Despesa excluída"),
    ("revenue.created", "Receita criada"),
    ("revenue.updated", "Receita atualizada"),
    ("revenue.deleted", "Receita excluída"),
    ("transfer.created", "Transferência criada"),
    ("loan.created", "Empréstimo criado"),
    ("loan.updated", "Empréstimo atualizado"),
    ("budget.exceeded", "Orçamento excedido"),
    ("vault.deposit", "Depósito em cofre"),
    ("vault.withdrawal", "Saque de cofre"),
    ("notification.created", "Notificação criada"),
    ("health_score.updated", "Score de saúde atualizado"),
)

DELIVERY_STATUS_CHOICES = (
    ("pending", "Pendente"),
    ("success", "Sucesso"),
    ("failed", "Falhou"),
    ("retrying", "Tentando novamente"),
)


class Webhook(BaseModel):
    """Webhook outbound configurado pelo usuário."""

    name = models.CharField(max_length=100, verbose_name="Nome")
    url = models.URLField(max_length=500, verbose_name="URL de destino")
    secret = models.CharField(
        max_length=128,
        verbose_name="Secret",
        help_text=(
            "Assina o payload via HMAC-SHA256 (header X-Axiom-Signature)"
        ),
    )
    events = models.JSONField(
        default=list,
        verbose_name="Eventos",
        help_text="Lista de eventos que disparam este webhook",
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativo")
    timeout_seconds = models.PositiveSmallIntegerField(
        default=10,
        verbose_name="Timeout (segundos)",
    )
    max_retries = models.PositiveSmallIntegerField(
        default=3,
        verbose_name="Máximo de tentativas",
    )

    class Meta:
        verbose_name = "Webhook"
        verbose_name_plural = "Webhooks"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} → {self.url}"

    def sign_payload(self, body: bytes) -> str:
        """Retorna assinatura HMAC-SHA256 do payload."""
        return hmac.new(
            self.secret.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()


class WebhookDelivery(BaseModel):
    """Registro de cada tentativa de entrega de um webhook."""

    webhook = models.ForeignKey(
        Webhook,
        on_delete=models.CASCADE,
        related_name="deliveries",
        verbose_name="Webhook",
    )
    event = models.CharField(max_length=50, verbose_name="Evento")
    payload = models.JSONField(verbose_name="Payload enviado")
    status = models.CharField(
        max_length=20,
        choices=DELIVERY_STATUS_CHOICES,
        default="pending",
        verbose_name="Status",
    )
    response_status_code = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="HTTP status da resposta"
    )
    response_body = models.TextField(
        null=True, blank=True, verbose_name="Corpo da resposta"
    )
    attempt_number = models.PositiveSmallIntegerField(
        default=1, verbose_name="Tentativa nº"
    )
    duration_ms = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Duração (ms)"
    )
    error_message = models.TextField(
        null=True, blank=True, verbose_name="Mensagem de erro"
    )

    class Meta:
        verbose_name = "Entrega de Webhook"
        verbose_name_plural = "Entregas de Webhooks"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["webhook", "status"]),
            models.Index(fields=["event", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.webhook.name} | {self.event} | {self.status}"
