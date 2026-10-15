"""Webhooks entraram no menu de todos os usuários: o grupo `members` recebe o
CRUD dos models (cada usuário só vê os próprios webhooks, filtrados por dono).
Bancos novos recebem o mesmo pelo `setup_permissions`."""

from django.db import migrations

MODELS = ("webhook", "webhookdelivery")
ACTIONS = ("view", "add", "change", "delete")


def grant(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    group = Group.objects.filter(name="members").first()
    if group is None:
        return
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    # Permissões nascem no post_migrate; aqui podem ainda não existir
    for model in MODELS:
        ct, _ = ContentType.objects.get_or_create(
            app_label="webhooks", model=model
        )
        for action in ACTIONS:
            perm, _ = Permission.objects.get_or_create(
                content_type=ct,
                codename=f"{action}_{model}",
                defaults={"name": f"Can {action} {model}"},
            )
            group.permissions.add(perm)


class Migration(migrations.Migration):
    dependencies = [
        (
            "webhooks",
            "0002_rename_webhooks_we_webhook_status_idx_webhooks_we_webhook_322278_idx_and_more",
        ),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [migrations.RunPython(grant, migrations.RunPython.noop)]
