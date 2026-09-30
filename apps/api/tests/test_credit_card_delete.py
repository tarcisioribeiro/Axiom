from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from credit_cards.models import CreditCard, CreditCardBill


class CreditCardDeleteTest(APITestCase):
    def setUp(self):
        from app.encryption import FieldEncryption

        cache.clear()  # throttle state
        self.user = User.objects.create_superuser("u", "u@u.com", "pass12345")
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        account = Account.objects.create(
            account_name="NUB", account_type="CC", created_by=self.user
        )
        self.card = CreditCard(
            name="Nubank",
            on_card_name="TEST",
            flag="MSC",
            associated_account=account,
            credit_limit=Decimal("10000.00"),
            max_limit=Decimal("10000.00"),
            validation_date=date(2035, 1, 1),
            created_by=self.user,
        )
        self.card._security_code = FieldEncryption.encrypt_data("123")
        self.card._card_number = FieldEncryption.encrypt_data(
            "5555444433331111"
        )
        self.card.save()
        self.url = reverse("credit-card-detail-view", args=[self.card.pk])

    def _bill(self, status):
        bill = CreditCardBill.objects.create(
            credit_card=self.card,
            year="2026",
            month="Sep",
            invoice_beginning_date=date(2026, 9, 1),
            invoice_ending_date=date(2026, 9, 30),
            due_date=date(2026, 10, 10),
            total_amount=Decimal("100"),
            minimum_payment=Decimal("0"),
            paid_amount=Decimal("0"),
            status="open",
            closed=False,
            created_by=self.user,
        )
        # O sinal força status "open" na criação; ajusta depois.
        CreditCardBill.objects.filter(pk=bill.pk).update(
            status=status, closed=status != "open"
        )
        return bill

    def _delete(self, number="5555 4444 3333 1111", cvv="123"):
        return self.client.delete(
            self.url,
            {"card_number": number, "security_code": cvv},
            format="json",
        )

    def test_wrong_number_or_cvv_is_rejected(self):
        for number, cvv in [
            ("5555444433332222", "123"),
            ("5555444433331111", "999"),
            ("", ""),
        ]:
            response = self._delete(number, cvv)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data["code"], "invalid_credentials")
        self.assertTrue(CreditCard.objects.filter(pk=self.card.pk).exists())

    def test_unpaid_bill_blocks_deletion(self):
        for status in ("open", "closed", "overdue"):
            bill = self._bill(status)
            response = self._delete()
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data["code"], "pending_bills")
            self.assertEqual(response.data["pending_bills"][0]["id"], bill.pk)
            bill.delete()
        self.assertTrue(CreditCard.objects.filter(pk=self.card.pk).exists())

    def test_soft_deletes_and_keeps_linked_records(self):
        bill = self._bill("paid")
        response = self._delete()
        self.assertEqual(response.status_code, 204, response.data)

        self.assertFalse(CreditCard.objects.filter(pk=self.card.pk).exists())
        card = CreditCard.all_objects.get(pk=self.card.pk)
        self.assertTrue(card.is_deleted)
        self.assertEqual(card.deleted_by, self.user)
        self.assertIsNotNone(card.deleted_at)

        bill.refresh_from_db()
        self.assertEqual(bill.credit_card_id, self.card.pk)
        self.assertFalse(bill.is_deleted)
