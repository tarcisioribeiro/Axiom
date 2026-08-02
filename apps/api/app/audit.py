from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class ChangeLog(models.Model):
    user = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Usuário",
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    object_id = models.CharField(max_length=36, verbose_name="ID do Objeto")
    content_object = GenericForeignKey("content_type", "object_id")
    action = models.CharField(
        max_length=10,
        choices=[
            ("create", "Criação"),
            ("update", "Atualização"),
            ("delete", "Exclusão"),
        ],
        verbose_name="Ação",
    )
    changes = models.JSONField(default=dict, verbose_name="Mudanças")
    timestamp = models.DateTimeField(
        auto_now_add=True, verbose_name="Data/Hora"
    )
    ip_address = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="IP"
    )

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Log de Auditoria"
        verbose_name_plural = "Logs de Auditoria"
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["-timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} by {self.user} at {self.timestamp}"
