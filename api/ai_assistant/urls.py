"""
URL routes para o módulo AI Assistant.
"""

from django.urls import path

from . import views

urlpatterns = [
    path("pergunta/", views.pergunta, name="ai-pergunta"),
    path("historico/", views.historico, name="ai-historico"),
    path("health/", views.health, name="ai-health"),
    path("agents/", views.list_agents, name="ai-agents"),
]
