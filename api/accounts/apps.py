from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
    verbose_name = "Contas"

    def ready(self) -> None:
        """
        Importa os signals quando o app é carregado.

        Este método é chamado automaticamente pelo Django quando
        o app é inicializado, garantindo que os signals sejam
        registrados corretamente.
        """
        import accounts.signals  # noqa: F401
