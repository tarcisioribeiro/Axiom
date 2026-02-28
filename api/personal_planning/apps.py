from django.apps import AppConfig


class PersonalPlanningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "personal_planning"
    verbose_name = "Planejamento Pessoal"

    def ready(self):
        import personal_planning.signals  # noqa
