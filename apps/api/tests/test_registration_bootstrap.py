from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

PAYLOAD = {
    "username": "novousuario",
    "password": "Str0ngPass#2026",
    "name": "Novo Usuario",
    "document": "529.982.247-25",
    "phone": "11988887777",
    "email": "novo@test.com",
}


class RegistrationBootstrapTest(APITestCase):
    def setUp(self):
        cache.clear()  # zera o throttle de cadastro

    def test_closed_without_staff(self):
        # Superuser também tem is_staff=True, mas não abre o cadastro
        User.objects.create_superuser("adm", "adm@test.com", "pw")
        self.assertFalse(
            self.client.get(reverse("registration-status")).data["open"]
        )
        response = self.client.post(reverse("register-user"), PAYLOAD)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_staff_keeps_it_closed(self):
        User.objects.create_user(
            "stf", "stf@test.com", "pw", is_staff=True, is_active=False
        )
        self.assertFalse(
            self.client.get(reverse("registration-status")).data["open"]
        )

    def test_open_with_active_staff(self):
        User.objects.create_user("stf", "stf@test.com", "pw", is_staff=True)
        self.assertTrue(
            self.client.get(reverse("registration-status")).data["open"]
        )
        response = self.client.post(reverse("register-user"), PAYLOAD)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="novousuario")
        self.assertFalse(user.is_staff)

    def test_email_is_required(self):
        User.objects.create_user("stf", "stf@test.com", "pw", is_staff=True)
        payload = {**PAYLOAD, "email": ""}
        response = self.client.post(reverse("register-user"), payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Email e obrigatorio", response.data["details"])

    def test_admin_accounts_require_email(self):
        with self.assertRaises(ValidationError):
            User.objects.create_superuser("adm", "", "pw")
        with self.assertRaises(ValidationError):
            User.objects.create_user("stf", "", "pw", is_staff=True)


class StaffManagementTest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("adm", "adm@test.com", "pw")
        self.client.force_authenticate(self.admin)

    def test_superuser_creates_staff_with_member(self):
        response = self.client.post(reverse("admin-staff-list"), PAYLOAD)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        staff = User.objects.get(username="novousuario")
        self.assertTrue(staff.is_staff)
        self.assertFalse(staff.is_superuser)
        self.assertTrue(hasattr(staff, "member"))
        listed = self.client.get(reverse("admin-staff-list")).data
        self.assertEqual([u["username"] for u in listed], ["novousuario"])

    def test_superuser_toggles_staff(self):
        staff = User.objects.create_user(
            "stf", "stf@test.com", "pw", is_staff=True
        )
        url = reverse("admin-staff-detail", args=[staff.pk])
        response = self.client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        staff.refresh_from_db()
        self.assertFalse(staff.is_active)

    def test_staff_cannot_manage_staff(self):
        staff = User.objects.create_user(
            "stf", "stf@test.com", "pw", is_staff=True
        )
        self.client.force_authenticate(staff)
        self.assertEqual(
            self.client.get(reverse("admin-staff-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        url = reverse("admin-staff-detail", args=[staff.pk])
        response = self.client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
