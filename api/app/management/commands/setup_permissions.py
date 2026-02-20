"""
Django management command to setup default permissions for the members group.
This ensures all users in the members group have the necessary permissions.
"""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Setup default permissions for the members group"

    def handle(self, *args, **options):
        # Get or create the members group
        members_group, created = Group.objects.get_or_create(name="members")

        if created:
            self.stdout.write(self.style.SUCCESS('Created "members" group'))
        else:
            self.stdout.write(self.style.WARNING('Group "members" already exists'))

        # Define all the models that members should have full access to
        app_models = {
            "accounts": ["account"],
            "expenses": ["expense", "fixedexpense", "fixedexpensegenerationlog"],
            "revenues": ["revenue"],
            "credit_cards": [
                "creditcard",
                "creditcardbill",
                "creditcardexpense",
                "creditcardpurchase",
                "creditcardinstallment",
            ],
            "transfers": ["transfer"],
            "loans": ["loan"],
            "payables": ["payable"],
            "members": ["member"],
            "library": ["author", "publisher", "book", "summary", "reading"],
            "security": [
                "password",
                "storedcreditcard",
                "storedbankaccount",
                "archive",
                "activitylog",
            ],
            "personal_planning": [
                "routinetask",
                "taskinstance",
                "goal",
                "dailyreflection",
            ],
            "vaults": ["vault", "vaulttransaction", "financialgoal"],
            "ai_assistant": ["conversationhistory"],
            "notifications": ["notification"],
        }

        # Define the permissions: view, add, change, delete (full CRUD)
        permission_types = ["view", "add", "change", "delete"]

        total_permissions = 0

        for app_label, models in app_models.items():
            for model_name in models:
                try:
                    content_type = ContentType.objects.get(
                        app_label=app_label, model=model_name
                    )

                    for perm_type in permission_types:
                        codename = f"{perm_type}_{model_name}"

                        try:
                            permission = Permission.objects.get(
                                codename=codename, content_type=content_type
                            )

                            # Add permission to group if not already there
                            if not members_group.permissions.filter(
                                id=permission.id
                            ).exists():
                                members_group.permissions.add(permission)
                                total_permissions += 1
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f"✓ Added: {app_label}.{codename}"
                                    )
                                )

                        except Permission.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"✗ Permission not found: "
                                    f"{app_label}.{codename}"
                                )
                            )

                except ContentType.DoesNotExist:
                    self.stdout.write(
                        self.style.ERROR(
                            f"✗ ContentType not found: " f"{app_label}.{model_name}"
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Setup complete! Added {total_permissions} permissions "
                f'to the "members" group'
            )
        )

        # Show current permissions count
        current_perms = members_group.permissions.count()
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Group "members" now has {current_perms} total permissions'
            )
        )

        # Auto-add all users to members group if they're not already in it
        from django.contrib.auth import get_user_model

        User = get_user_model()
        users_added = 0

        for user in User.objects.all():
            if not user.groups.filter(id=members_group.id).exists():
                user.groups.add(members_group)
                users_added += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Added user "{user.username}" to "members" group'
                    )
                )

        if users_added == 0:
            self.stdout.write(
                self.style.SUCCESS('✓ All users are already in the "members" group')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Added {users_added} user(s) to the "members" group'
                )
            )
