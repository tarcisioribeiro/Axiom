from django.apps import AppConfig


class CreditCardsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "credit_cards"
    verbose_name = "Cartões de Crédito"

    def ready(self):
        """Importa os signals quando a aplicação está pronta."""
        import credit_cards.signals  # noqa
