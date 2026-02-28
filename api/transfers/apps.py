from django.apps import AppConfig


class TransfersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "transfers"
    verbose_name = "Transferências"

    def ready(self):
        """
        Importa os signals quando a aplicação é inicializada.

        Este método é chamado automaticamente pelo Django quando
        a aplicação está pronta, garantindo que os signals sejam
        registrados corretamente.
        """
        import transfers.signals  # noqa
