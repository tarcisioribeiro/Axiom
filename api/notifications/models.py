from django.db import models

from app.models import BaseModel

NOTIFICATION_TYPE_CHOICES = (
    ("task_today", "Tarefa do Dia"),
    ("task_overdue", "Tarefa Atrasada"),
    ("payable_due_soon", "Valor a Pagar Próximo do Vencimento"),
    ("payable_overdue", "Valor a Pagar Atrasado"),
    ("loan_due_soon", "Empréstimo Próximo do Vencimento"),
    ("loan_overdue", "Empréstimo Atrasado"),
    ("bill_due_soon", "Fatura Próxima do Vencimento"),
    ("bill_overdue", "Fatura Atrasada"),
    ("budget_warning", "Alerta de Orçamento"),
    ("budget_exceeded", "Orçamento Estourado"),
    ("financial_goal_reached", "Meta Financeira Atingida"),
    ("financial_goal_approaching", "Meta Financeira Próxima do Prazo"),
    ("agent_insight", "Insight do Agente"),
    ("reading_goal_achieved", "Meta de Leitura Atingida"),
    ("reading_goal_behind", "Meta de Leitura Atrasada"),
    ("reconciliation_pending", "Reconciliação Bancária Pendente"),
)

NOTIFICATION_CHANNEL_CHOICES = (
    ("in_app", "Somente no App"),
    ("email", "Somente E-mail"),
    ("both", "App e E-mail"),
)


class Notification(BaseModel):
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.CASCADE,
        verbose_name="Proprietário",
        related_name="notifications",
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NOTIFICATION_TYPE_CHOICES,
        verbose_name="Tipo",
    )
    title = models.CharField(
        max_length=200,
        verbose_name="Título",
    )
    message = models.TextField(
        blank=True,
        default="",
        verbose_name="Mensagem",
    )
    is_read = models.BooleanField(
        default=False,
        verbose_name="Lida",
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Data de Vencimento",
    )
    content_type = models.CharField(
        max_length=50,
        verbose_name="Tipo de Conteúdo",
    )
    object_id = models.IntegerField(
        verbose_name="ID do Objeto",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notificação"
        verbose_name_plural = "Notificações"
        unique_together = (
            "owner",
            "notification_type",
            "content_type",
            "object_id",
        )
        indexes = [
            models.Index(fields=["owner", "is_read"]),
            models.Index(fields=["notification_type"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.owner}"


class NotificationPreference(BaseModel):
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.CASCADE,
        verbose_name="Proprietário",
        related_name="notification_preferences",
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NOTIFICATION_TYPE_CHOICES,
        verbose_name="Tipo",
    )
    channel = models.CharField(
        max_length=10,
        choices=NOTIFICATION_CHANNEL_CHOICES,
        default="in_app",
        verbose_name="Canal",
    )

    class Meta:
        ordering = ["notification_type"]
        verbose_name = "Preferência de Notificação"
        verbose_name_plural = "Preferências de Notificação"
        unique_together = ("owner", "notification_type")

    def __str__(self):
        return (
            f"{self.owner} — {self.get_notification_type_display()}"
            f" ({self.get_channel_display()})"
        )
