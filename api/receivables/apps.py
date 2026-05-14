from django.apps import AppConfig


class ReceivablesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "receivables"
    verbose_name = "Valores a Receber"

    def ready(self):
        import receivables.signals  # noqa
