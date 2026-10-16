"""Leitura e concessão de acessos por tela (ver `admin_panel.screens`)."""

from django.contrib.auth.models import User

from admin_panel.models import ScreenDefault, UserScreenAccess
from admin_panel.screens import effective_actions


def get_user_actions(user: User) -> dict[str, set[str]]:
    grants = dict(
        UserScreenAccess.objects.filter(user=user).values_list(
            "screen", "actions"
        )
    )
    return effective_actions(grants)


def can_view_any(user: User, screens: tuple[str, ...]) -> bool:
    """Usuário vê alguma das telas? Staff e superuser veem todas."""
    if user.is_staff or user.is_superuser:
        return True
    actions = get_user_actions(user)
    return any(screen in actions for screen in screens)


def apply_screen_defaults(user: User) -> None:
    """Concede ao usuário os padrões de tela definidos no painel."""
    UserScreenAccess.objects.bulk_create(
        [
            UserScreenAccess(user=user, screen=d.screen, actions=d.actions)
            for d in ScreenDefault.objects.all()
        ],
        ignore_conflicts=True,
    )
