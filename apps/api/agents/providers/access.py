"""Controle de acesso por tela nos dados que os agentes leem.

Cada função de provider declara as telas que dão acesso ao dado; sem nenhuma
delas, devolve o valor vazio (como se não houvesse dados). Staff e superuser
têm acesso total, igual ao `ScreenAccessMiddleware`.
"""

import copy
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from django.contrib.auth.models import User

from admin_panel.access import can_view_any

F = TypeVar("F", bound=Callable[..., Any])


def _find_user(args: tuple[Any, ...], kwargs: dict[str, Any]) -> User:
    if isinstance(kwargs.get("user"), User):
        return kwargs["user"]  # type: ignore[no-any-return]
    return next(a for a in args if isinstance(a, User))


def requires_screen(*screens: str, empty: Any) -> Callable[[F], F]:
    def decorator(fn: F) -> F:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if not can_view_any(_find_user(args, kwargs), screens):
                return copy.copy(empty)
            return fn(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator


# Módulo (admin_panel.screens.MODULES) de cada agente; o Insight cruza dois
AGENT_MODULES: dict[str, tuple[str, ...]] = {
    "personal": ("planning",),
    "planning": ("planning",),
    "financial": ("finance",),
    "finance": ("finance",),
    "budget": ("finance",),
    "forecast": ("finance",),
    "security": ("security",),
    "intellect": ("intellect",),
    "library": ("intellect",),
    "insight": ("finance", "planning"),
}


def agent_allowed(user: User, agent_name: str) -> bool:
    """O usuário tem alguma tela de um módulo atendido pelo agente?"""
    from admin_panel.screens import SCREENS

    modules = AGENT_MODULES.get(agent_name, ())
    screens = tuple(k for k, v in SCREENS.items() if v["module"] in modules)
    return can_view_any(user, screens)


# Telas que dão acesso a cada domínio de embeddings (busca semântica/RAG)
DOMAIN_SCREENS: dict[str, tuple[str, ...]] = {
    "library": ("intellect.books",),
    "planning": ("planning.tasks_goals",),
    "finance": ("finance.transactions",),
    "budget": ("finance.budgets",),
}


def domain_allowed(user: User, domain: str) -> bool:
    screens = DOMAIN_SCREENS.get(domain)
    return can_view_any(user, screens) if screens else True
