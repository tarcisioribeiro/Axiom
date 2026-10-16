"""
Bootstrap de produção: o ambiente tem um único usuário e ele vira o staff que
gerencia as permissões (e abre o cadastro público).

Só age quando há exatamente 1 usuário comum e nenhum staff ativo; em qualquer
outro banco (dev, testes, ambientes com mais usuários) não faz nada.
"""

from django.db import migrations


def promote_single_user(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserScreenAccess = apps.get_model("admin_panel", "UserScreenAccess")

    if User.objects.filter(
        is_staff=True, is_superuser=False, is_active=True
    ).exists():
        return
    common = User.objects.filter(is_staff=False, is_superuser=False)
    if common.count() != 1:
        return

    user = common.get()
    if not (user.email or "").strip():
        raise RuntimeError(
            f"O usuário '{user.username}' não tem email; staff exige email. "
            "Cadastre o email e rode a migração novamente."
        )
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    # Staff ignora o controle por tela; os acessos de usuário comum não valem
    UserScreenAccess.objects.filter(user=user).delete()


class Migration(migrations.Migration):
    dependencies = [("admin_panel", "0003_seed_screen_access")]

    operations = [
        migrations.RunPython(promote_single_user, migrations.RunPython.noop)
    ]
