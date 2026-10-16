import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")

app = Celery("axiom")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Agendamento periódico: CELERY_BEAT_SCHEDULE em app/settings.py (fonte única;
# app.conf.beat_schedule aqui seria sobrescrito pelas settings).
