import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Webhook",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True, verbose_name="UUID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                ("name", models.CharField(max_length=100, verbose_name="Nome")),
                ("url", models.URLField(max_length=500, verbose_name="URL de destino")),
                ("secret", models.CharField(help_text="Usado para assinar o payload via HMAC-SHA256", max_length=128, verbose_name="Secret")),
                ("events", models.JSONField(default=list, verbose_name="Eventos")),
                ("is_active", models.BooleanField(default=True, verbose_name="Ativo")),
                ("timeout_seconds", models.PositiveSmallIntegerField(default=10, verbose_name="Timeout (segundos)")),
                ("max_retries", models.PositiveSmallIntegerField(default=3, verbose_name="Máximo de tentativas")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhook_created", to=settings.AUTH_USER_MODEL, verbose_name="Criado por")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhook_updated", to=settings.AUTH_USER_MODEL, verbose_name="Atualizado por")),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhook_deleted", to=settings.AUTH_USER_MODEL, verbose_name="Excluído por")),
            ],
            options={
                "verbose_name": "Webhook",
                "verbose_name_plural": "Webhooks",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="WebhookDelivery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True, verbose_name="UUID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                ("is_deleted", models.BooleanField(default=False, verbose_name="Excluído")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Excluído em")),
                ("event", models.CharField(max_length=50, verbose_name="Evento")),
                ("payload", models.JSONField(verbose_name="Payload enviado")),
                ("status", models.CharField(choices=[("pending", "Pendente"), ("success", "Sucesso"), ("failed", "Falhou"), ("retrying", "Tentando novamente")], default="pending", max_length=20, verbose_name="Status")),
                ("response_status_code", models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="HTTP status da resposta")),
                ("response_body", models.TextField(blank=True, null=True, verbose_name="Corpo da resposta")),
                ("attempt_number", models.PositiveSmallIntegerField(default=1, verbose_name="Tentativa nº")),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True, verbose_name="Duração (ms)")),
                ("error_message", models.TextField(blank=True, null=True, verbose_name="Mensagem de erro")),
                ("webhook", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="deliveries", to="webhooks.webhook", verbose_name="Webhook")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhookdelivery_created", to=settings.AUTH_USER_MODEL, verbose_name="Criado por")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhookdelivery_updated", to=settings.AUTH_USER_MODEL, verbose_name="Atualizado por")),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhookdelivery_deleted", to=settings.AUTH_USER_MODEL, verbose_name="Excluído por")),
            ],
            options={
                "verbose_name": "Entrega de Webhook",
                "verbose_name_plural": "Entregas de Webhooks",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["webhook", "status"], name="webhooks_we_webhook_status_idx"),
                    models.Index(fields=["event", "-created_at"], name="webhooks_we_event_created_idx"),
                ],
            },
        ),
    ]
