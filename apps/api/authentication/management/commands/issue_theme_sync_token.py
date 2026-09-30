from argparse import ArgumentParser
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from authentication.models import ThemePreference


class Command(BaseCommand):
    help = (
        "Gera (ou regenera) o token de sync de tema do usuário e o imprime "
        "uma única vez. O token anterior deixa de funcionar."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("username")

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            user = User.objects.get(username=options["username"])
        except User.DoesNotExist as exc:
            raise CommandError(
                f"Usuário '{options['username']}' não existe."
            ) from exc
        pref, _ = ThemePreference.objects.get_or_create(user=user)
        self.stdout.write(pref.issue_sync_token())
