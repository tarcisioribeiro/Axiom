from collections.abc import Iterable
from typing import Any

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save
from django.dispatch import receiver

# Nomes reservados para contas administrativas (is_staff/is_superuser)
RESERVED_USERNAMES = frozenset(
    {"admin", "administrator", "administrador", "root", "superuser"}
)
_GUARDED_FIELDS = {"username", "email", "is_staff", "is_superuser"}


def is_reserved_username(username: str | None) -> bool:
    return (username or "").strip().lower() in RESERVED_USERNAMES


@receiver(pre_save, sender=User)
def enforce_reserved_usernames(
    sender: type[User],
    instance: User,
    update_fields: Iterable[str] | None = None,
    **kwargs: Any,
) -> None:
    # Saves parciais que não tocam esses campos (ex.: last_login) passam direto
    if update_fields is not None and not _GUARDED_FIELDS & set(update_fields):
        return
    if not is_reserved_username(instance.username):
        return
    if not (instance.is_staff or instance.is_superuser):
        raise ValidationError(
            f"O nome de usuário '{instance.username}' é reservado "
            "para administradores."
        )
    if not (instance.email or "").strip():
        raise ValidationError(
            f"O usuário administrativo '{instance.username}' precisa de email."
        )


@receiver(pre_save, sender=User)
def require_email_for_new_admins(
    sender: type[User], instance: User, raw: bool = False, **kwargs: Any
) -> None:
    # Só na criação: contas antigas sem email continuam podendo salvar.
    # Usuário comum é criado pelo cadastro, que já exige email.
    if raw or not instance._state.adding:
        return
    if (instance.is_staff or instance.is_superuser) and not (
        instance.email or ""
    ).strip():
        raise ValidationError(
            f"O usuário administrativo '{instance.username}' precisa de email."
        )
