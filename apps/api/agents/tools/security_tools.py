"""
Tools de segurança — metadados apenas, NUNCA expõe valores criptografados.
Segue a regra: o agente de segurança jamais retorna senhas, PINs ou chaves.
"""

from typing import Any

from django.contrib.auth.models import User

from agents.providers import security_provider


def get_security_overview(user: User) -> dict[str, Any]:
    """Contagens e metadados gerais do módulo de segurança."""
    try:
        return security_provider.security_counts(user)
    except Exception:
        return {
            "passwords": 0,
            "stored_cards": 0,
            "stored_accounts": 0,
            "archives": 0,
            "old_passwords": 0,
            "recently_updated": 0,
        }


def get_recent_activity(user: User, limit: int = 15) -> list[dict[str, Any]]:
    """Últimos N eventos de segurança do usuário (sem dados sensíveis)."""
    try:
        logs = security_provider.recent_activity_logs(user, limit)
        return [
            {
                "action": log["action"],
                "model": log["model_name"] or "",
                "description": (log["description"] or "")[:120],
                "ip": log["ip_address"] or "",
                "when": (
                    log["created_at"].strftime("%d/%m/%Y %H:%M")
                    if log["created_at"]
                    else ""
                ),
            }
            for log in logs
        ]
    except Exception:
        return []


def get_password_categories(user: User) -> list[dict[str, Any]]:
    """
    Distribuição de senhas por categoria (contagens apenas, sem conteúdo).
    """
    try:
        cats = security_provider.password_category_counts(user)
        return [
            {"category": c["category"] or "Sem categoria", "count": c["count"]}
            for c in cats
        ]
    except Exception:
        return []
