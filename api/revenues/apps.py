from django.apps import AppConfig


class RevenuesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "revenues"
    verbose_name = "Receitas"

    def ready(self):
        """
        Importa os signals quando o app é carregado.

        Este método é chamado automaticamente pelo Django quando
        o app é inicializado, garantindo que os signals de atualização
        de saldo das contas sejam registrados corretamente.
        """
        import accounts.signals  # noqa: F401
