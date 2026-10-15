from importlib import import_module

from django.contrib.auth.models import Group, User
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase

grant = import_module("webhooks.migrations.0003_grant_members_group").grant


class WebhooksMembersPermissionTest(TestCase):
    def test_members_group_gets_webhook_crud(self):
        group = Group.objects.create(name="members")
        # Estado histórico real da migração (o mesmo do `migrate`)
        state = MigrationExecutor(connection).loader.project_state(
            ("webhooks", "0003_grant_members_group")
        )
        grant(state.apps, None)
        codenames = set(group.permissions.values_list("codename", flat=True))
        self.assertTrue(
            {"view_webhook", "add_webhook", "delete_webhookdelivery"}
            <= codenames
        )
        user = User.objects.create_user("u", "u@test.com", "pw")
        user.groups.add(group)
        self.assertTrue(user.has_perm("webhooks.add_webhook"))
