from importlib import import_module

from django.apps import apps
from django.contrib.auth.models import User
from django.test import TestCase

from admin_panel.models import UserScreenAccess

promote_single_user = import_module(
    "admin_panel.migrations.0004_promote_single_user_to_staff"
).promote_single_user


def run_migration() -> None:
    promote_single_user(apps, None)


class PromoteSingleUserMigrationTest(TestCase):
    def test_single_user_becomes_staff(self):
        User.objects.create_superuser("adm", "adm@test.com", "pw")
        user = User.objects.create_user("unico", "unico@test.com", "pw")
        self.assertTrue(UserScreenAccess.objects.filter(user=user).exists())

        run_migration()

        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertFalse(UserScreenAccess.objects.filter(user=user).exists())

    def test_two_users_nothing_changes(self):
        User.objects.create_user("um", "um@test.com", "pw")
        User.objects.create_user("dois", "dois@test.com", "pw")
        run_migration()
        self.assertFalse(User.objects.filter(is_staff=True).exists())

    def test_existing_staff_nothing_changes(self):
        User.objects.create_user("stf", "stf@test.com", "pw", is_staff=True)
        user = User.objects.create_user("unico", "unico@test.com", "pw")
        run_migration()
        user.refresh_from_db()
        self.assertFalse(user.is_staff)

    def test_user_without_email_fails(self):
        user = User.objects.create_user("semmail", "", "pw")
        with self.assertRaises(RuntimeError):
            run_migration()
        user.refresh_from_db()
        self.assertFalse(user.is_staff)


class DjangoAdminSiteTest(TestCase):
    def test_staff_cannot_use_django_admin(self):
        staff = User.objects.create_user(
            "stf", "stf@test.com", "pw", is_staff=True
        )
        self.client.force_login(staff)
        response = self.client.get("/admin/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_superuser_can_use_django_admin(self):
        admin = User.objects.create_superuser("adm", "adm@test.com", "pw")
        self.client.force_login(admin)
        self.assertEqual(self.client.get("/admin/").status_code, 200)
