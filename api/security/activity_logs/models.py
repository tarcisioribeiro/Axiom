from django.contrib.auth.models import User
from django.db import models

ACTION_TYPES = (
    ("view", "Visualização"),
    ("create", "Criação"),
    ("update", "Atualização"),
    ("delete", "Exclusão"),
    ("reveal", "Revelação de Senha/Credencial"),
    ("download", "Download de Arquivo"),
    ("login", "Login"),
    ("logout", "Logout"),
    ("failed_login", "Tentativa de Login Falha"),
    ("other", "Outro"),
    ("purge", "Purga de Dados (LGPD/GDPR)"),
)


class ActivityLog(models.Model):
    """
    Modelo para registro de logs de atividades de segurança.
    Registra todas as ações sensíveis realizadas no sistema.

    Não herda de BaseModel pois logs não devem ser editados ou excluídos.
    """

    action = models.CharField(max_length=100, choices=ACTION_TYPES, verbose_name="Ação")
    model_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Modelo",
        help_text="Nome do modelo afetado (ex: Password, StoredCreditCard)",
    )
    object_id = models.IntegerField(
        blank=True,
        null=True,
        verbose_name="ID do Objeto",
        help_text="ID do objeto afetado",
    )
    description = models.TextField(
        verbose_name="Descrição", help_text="Descrição detalhada da ação realizada"
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name="Endereço IP",
        help_text="IP de origem da requisição",
    )
    user_agent = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="User Agent",
        help_text="Informações do navegador/cliente",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        verbose_name="Usuário",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data/Hora")

    class Meta:
        verbose_name = "Log de Atividade"
        verbose_name_plural = "Logs de Atividades"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "action"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["model_name", "object_id"]),
        ]
        # Logs não podem ser editados ou excluídos (usar permissões default do Django)

    def __str__(self):
        user_str = self.user.username if self.user else "Anônimo"
        return (
            f"{user_str} - {self.action} - {self.created_at.strftime('%d/%m/%Y %H:%M')}"
        )

    @classmethod
    def log_action(
        cls,
        user,
        action,
        description,
        model_name=None,
        object_id=None,
        ip_address=None,
        user_agent=None,
    ):
        """
        Método helper para registrar uma ação.

        Args:
            user: Usuário que realizou a ação
            action: Tipo de ação (escolha de ACTION_TYPES)
            description: Descrição detalhada
            model_name: Nome do modelo afetado (opcional)
            object_id: ID do objeto afetado (opcional)
            ip_address: IP de origem (opcional)
            user_agent: User agent (opcional)

        Returns:
            ActivityLog: O log criado
        """
        return cls.objects.create(
            user=user,
            action=action,
            description=description,
            model_name=model_name,
            object_id=object_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
