from django.apps import AppConfig


class AdminPanelConfig(AppConfig):
    name = "admin_panel"
    verbose_name = "Painel Administrativo"

    def ready(self) -> None:
        from django.db.models.signals import post_migrate

        import admin_panel.signals  # noqa: F401

        post_migrate.connect(_populate_defaults, sender=self)


def _populate_defaults(sender: object, **kwargs: object) -> None:
    try:
        from admin_panel.defaults import populate_default_configs

        populate_default_configs()
    except Exception:
        pass
