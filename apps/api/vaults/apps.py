from django.apps import AppConfig


class VaultsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "vaults"
    verbose_name = "Cofres"

    def ready(self) -> None:
        """
        Importa os signals quando o app é carregado.

        Este método é chamado automaticamente pelo Django quando
        o app é inicializado, garantindo que os signals sejam
        registrados corretamente.
        """
        import vaults.signals  # noqa: F401
