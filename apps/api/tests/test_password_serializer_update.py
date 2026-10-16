"""Editing a vault password without retyping it keeps the stored one
(design rule: encrypted fields come back empty and blank = keep)."""

from django.contrib.auth.models import User
from django.test import TestCase

from members.models import Member
from security.models import Password
from security.serializers import PasswordCreateUpdateSerializer


class PasswordSerializerUpdateTest(TestCase):
    def setUp(self) -> None:
        user = User.objects.create_user("pw_ser", password="x")
        self.member = Member.objects.filter(user=user).first() or (
            Member.objects.create(name="Ana", user=user, created_by=user)
        )
        self.data = {
            "title": "Site",
            "username": "ana",
            "category": "other",
            "owner": self.member.pk,
        }

    def test_password_required_on_create(self) -> None:
        s = PasswordCreateUpdateSerializer(data=self.data)
        self.assertFalse(s.is_valid())
        self.assertIn("password", s.errors)
        blank = PasswordCreateUpdateSerializer(
            data={**self.data, "password": ""}
        )
        self.assertFalse(blank.is_valid())

    def test_password_optional_on_update(self) -> None:
        instance = Password(title="Site", username="ana", owner=self.member)
        for data in (self.data, {**self.data, "password": ""}):
            s = PasswordCreateUpdateSerializer(instance, data=data)
            self.assertTrue(s.is_valid(), s.errors)
