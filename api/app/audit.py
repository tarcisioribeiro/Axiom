from typing import TYPE_CHECKING, Any, Optional

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

if TYPE_CHECKING:
    from rest_framework.request import Request


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


class AuditableMixin:
    """Mixin for DRF generic views to record create/update/delete
    in ChangeLog."""

    request: "Request"

    def _get_ip(self) -> Optional[str]:
        request = self.request
        x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return str(x_forwarded.split(",")[0].strip())
        remote = request.META.get("REMOTE_ADDR")
        return str(remote) if remote else None

    def _record(
        self, action: str, instance: Any, old_data: Optional[dict] = None
    ) -> None:
        from django.contrib.contenttypes.models import ContentType

        ct = ContentType.objects.get_for_model(instance)
        changes: dict = {}
        if old_data and action == "update":
            for field, old_val in old_data.items():
                new_val = getattr(instance, field, None)
                if str(old_val) != str(new_val):
                    changes[field] = [str(old_val), str(new_val)]
        ChangeLog.objects.create(
            user=(
                self.request.user
                if self.request.user.is_authenticated
                else None
            ),
            content_type=ct,
            object_id=str(getattr(instance, "uuid", instance.pk)),
            action=action,
            changes=changes,
            ip_address=self._get_ip(),
        )

    def perform_create(self, serializer: Any) -> None:
        super().perform_create(serializer)  # type: ignore[misc]
        self._record("create", serializer.instance)

    def perform_update(self, serializer: Any) -> None:
        old_data = {
            f.name: getattr(serializer.instance, f.name)
            for f in serializer.instance._meta.fields
        }
        super().perform_update(serializer)  # type: ignore[misc]
        self._record("update", serializer.instance, old_data)

    def perform_destroy(self, instance: Any) -> None:
        self._record("delete", instance)
        super().perform_destroy(instance)  # type: ignore[misc]
