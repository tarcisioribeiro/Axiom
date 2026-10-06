"""
Unicidade de instituição + número da conta, por usuário.
"""

import os
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APITestCase

from cryptography.fernet import Fernet
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, compute_account_number_hash


class AccountNumberUniquenessTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_superuser(
            username="acc-owner", password="x", email="o@x.com"
        )
        cls.other = User.objects.create_superuser(
            username="acc-other", password="x", email="p@x.com"
        )

    def setUp(self):
        if not os.getenv("ENCRYPTION_KEY"):
            os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _payload(self, **overrides):
        data = {
            "account_name": "Conta",
            "account_type": "CC",
            "institution": "NUB",
            "account_number": "12345-6",
            "balance": "0.00",
            "overdraft_limit": "0.00",
        }
        data.update(overrides)
        return data

    def test_duplicate_institution_and_number_is_rejected(self):
        first = self.client.post(
            "/api/v1/accounts/", self._payload(), format="json"
        )
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(
            "/api/v1/accounts/", self._payload(), format="json"
        )

        self.assertEqual(second.status_code, 400)
        self.assertIn("account_number", second.data)
        self.assertEqual(
            Account.objects.filter(created_by=self.user).count(), 1
        )

    def test_number_is_normalized_before_comparing(self):
        self.client.post("/api/v1/accounts/", self._payload(), format="json")

        response = self.client.post(
            "/api/v1/accounts/",
            self._payload(account_number="123456"),
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_same_number_in_another_institution_is_allowed(self):
        self.client.post("/api/v1/accounts/", self._payload(), format="json")

        response = self.client.post(
            "/api/v1/accounts/",
            self._payload(institution="SIC"),
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

    def test_same_number_for_another_user_is_allowed(self):
        self.client.post("/api/v1/accounts/", self._payload(), format="json")
        refresh = RefreshToken.for_user(self.other)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

        response = self.client.post(
            "/api/v1/accounts/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, 201, response.data)

    def test_deleted_account_does_not_block_reuse(self):
        first = self.client.post(
            "/api/v1/accounts/", self._payload(), format="json"
        )
        self.client.delete(f"/api/v1/accounts/{first.data['id']}/")

        response = self.client.post(
            "/api/v1/accounts/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, 201, response.data)

    def test_update_to_existing_number_is_rejected(self):
        self.client.post("/api/v1/accounts/", self._payload(), format="json")
        second = self.client.post(
            "/api/v1/accounts/",
            self._payload(account_number="999"),
            format="json",
        )

        response = self.client.patch(
            f"/api/v1/accounts/{second.data['id']}/",
            {"account_number": "12345-6"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_editing_account_keeping_its_own_number_is_allowed(self):
        first = self.client.post(
            "/api/v1/accounts/", self._payload(), format="json"
        )

        response = self.client.patch(
            f"/api/v1/accounts/{first.data['id']}/",
            {"account_name": "Renomeada"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)


class AccountNumberConstraintTests(TestCase):
    """Garante a regra no banco, mesmo fora da API."""

    def setUp(self):
        if not os.getenv("ENCRYPTION_KEY"):
            os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()
        self.user = User.objects.create_user(
            username="constraint-owner", password="x"
        )

    def _create(self, number):
        account = Account(
            account_name="Conta",
            institution_name="CEF",
            account_type="CC",
            current_balance=Decimal("0.00"),
            created_by=self.user,
        )
        account.account_number = number
        account.save()
        return account

    def test_hash_is_stored_on_save(self):
        account = self._create("1234")

        self.assertEqual(
            account.account_number_hash,
            compute_account_number_hash("1234", os.environ["ENCRYPTION_KEY"]),
        )

    def test_database_rejects_duplicate(self):
        self._create("1234")

        with self.assertRaises(IntegrityError), transaction.atomic():
            self._create("1234")
