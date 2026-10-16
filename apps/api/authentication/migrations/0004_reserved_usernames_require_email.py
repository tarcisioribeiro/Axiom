import os

from django.db import migrations

RESERVED_USERNAMES = ("admin", "administrator", "administrador", "root", "superuser")


def fix_reserved_users(apps, schema_editor):
    """Preenche o email do superusuário do .env e aponta o que exige ação manual.

    Não renomeia nem promove ninguém: isso fica a cargo de um administrador.
    """
    User = apps.get_model("auth", "User")
    env_username = (os.getenv("DJANGO_SUPERUSER_USERNAME") or "").lower()
    env_email = (os.getenv("DJANGO_SUPERUSER_EMAIL") or "").strip()

    for user in User.objects.all().only(
        "id", "username", "email", "is_staff", "is_superuser"
    ):
        if user.username.lower() not in RESERVED_USERNAMES:
            continue
        if not (user.is_staff or user.is_superuser):
            print(
                f"\n  [ATENÇÃO] '{user.username}' (id={user.id}) usa nome "
                "reservado sem ser staff/superuser — renomeie ou promova."
            )
        elif not user.email.strip():
            if user.username.lower() == env_username and env_email:
                user.email = env_email
                user.save(update_fields=["email"])
            else:
                print(
                    f"\n  [ATENÇÃO] '{user.username}' (id={user.id}) "
                    "é administrativo e está sem email — defina um."
                )


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("authentication", "0003_themepreference_ubuntu_themes"),
    ]

    operations = [
        migrations.RunPython(fix_reserved_users, migrations.RunPython.noop),
    ]
