from typing import Any

from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from admin_panel.access import apply_screen_defaults


@receiver(post_save, sender=User)
def grant_screen_defaults(
    sender: type[User],
    instance: User,
    created: bool,
    raw: bool = False,
    **kwargs: Any,
) -> None:
    if (
        created
        and not raw
        and not (instance.is_staff or instance.is_superuser)
    ):
        apply_screen_defaults(instance)
