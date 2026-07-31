#!/bin/python
import os

import django
from django.contrib.auth import get_user_model

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

User = get_user_model()

django_username = os.getenv("DJANGO_SUPERUSER_USERNAME")
email = os.getenv("DJANGO_SUPERUSER_EMAIL") or ""
password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

if django_username:
    if not password:
        raise SystemExit(
            "DJANGO_SUPERUSER_PASSWORD é obrigatório quando "
            "DJANGO_SUPERUSER_USERNAME está definido."
        )

    user, created = User.objects.get_or_create(
        username=django_username,
        defaults={"email": email, "is_staff": True, "is_superuser": True},
    )
    if created:
        user.set_password(password)
        user.save()
        print("Superusuário criado.")
    elif not user.check_password(password):
        # Mantém a senha do usuário sincronizada com DJANGO_SUPERUSER_PASSWORD.
        # Sem isso, rotacionar a variável de ambiente não tem efeito algum no
        # usuário já existente, e a senha real do banco fica presa ao valor
        # usado na primeira criação — causa do incidente de smoke test em
        # que STAGING_SUPERUSER_PASSWORD divergiu da senha real do "admin".
        user.set_password(password)
        user.save()
        print("Senha do superusuário sincronizada.")
    else:
        print("Superusuário já existe.")
