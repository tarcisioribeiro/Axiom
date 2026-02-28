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
        unique_together = ("owner", "notification_type", "content_type", "object_id")
        indexes = [
            models.Index(fields=["owner", "is_read"]),
            models.Index(fields=["notification_type"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.owner}"
