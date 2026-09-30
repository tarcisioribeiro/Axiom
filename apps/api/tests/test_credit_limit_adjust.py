import os
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from cryptography.fernet import Fernet
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from credit_cards.models import CreditCard, CreditCardBill
from credit_cards.serializers import CreditCardSerializer
from expenses.models import FixedExpense
from expenses.services import bulk_generate_fixed_expenses


@patch.dict(os.environ, {"ENCRYPTION_KEY": Fernet.generate_key().decode()})
class CreditLimitAdjustTest(APITestCase):
    def setUp(self):
        from app.encryption import FieldEncryption

        self.user = User.objects.create_superuser("u", "u@u.com", "pass12345")
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.account = account = Account.objects.create(
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
        self.card.save()
        self.url = reverse("credit-card-detail-view", args=[self.card.pk])

    def _patch(self, value):
        with patch.object(
            CreditCardSerializer, "get_used_credit", return_value=4000.0
        ):
            return self.client.patch(
                self.url, {"credit_limit": value}, format="json"
            )

    def test_adjust_within_range_keeps_max_limit(self):
        response = self._patch("6000.00")
        self.assertEqual(response.status_code, 200, response.data)
        self.card.refresh_from_db()
        self.assertEqual(self.card.credit_limit, Decimal("6000.00"))
        self.assertEqual(self.card.max_limit, Decimal("10000.00"))

    def test_adjust_down_to_used_credit_is_allowed(self):
        self.assertEqual(self._patch("4000.00").status_code, 200)

    def test_below_used_credit_is_rejected(self):
        response = self._patch("3999.99")
        self.assertEqual(response.status_code, 400)
        self.assertIn("credit_limit", response.data)

    def test_above_max_limit_is_rejected(self):
        response = self._patch("10000.01")
        self.assertEqual(response.status_code, 400)
        self.assertIn("credit_limit", response.data)

    def _purchase(self, value, purchase_date="2026-09-01"):
        return self.client.post(
            reverse("credit_card-purchase-create-list"),
            {
                "description": "Compra",
                "total_value": value,
                "purchase_date": purchase_date,
                "purchase_time": "12:00",
                "category": "food and drink",
                "card": self.card.pk,
                "total_installments": 1,
            },
            format="json",
        )

    def test_purchase_uses_current_limit_not_max_limit(self):
        # Limite máximo 10.000, atual ajustado para 5.000, 4.000 já utilizados
        self.card.credit_limit = Decimal("5000.00")
        self.card.save()
        self.assertEqual(self._purchase("4000.00").status_code, 201)

        rejected = self._purchase("1000.01")
        self.assertEqual(rejected.status_code, 400)
        self.assertIn("total_value", rejected.data)
        self.assertEqual(self._purchase("1000.00").status_code, 201)

    def _fixed(self, description, value, card=True):
        return FixedExpense.objects.create(
            description=description,
            default_value=Decimal(value),
            category="entertainment",
            credit_card=self.card if card else None,
            account=None if card else self.account,
            due_day=5,
            created_by=self.user,
        )

    def test_bulk_generate_blocks_only_cards_without_limit(self):
        # Disponível: 5.000 - 4.000 = 1.000; cartão no lote soma 1.100
        self.card.credit_limit = Decimal("5000.00")
        self.card.save()
        self.assertEqual(self._purchase("4000.00").status_code, 201)
        streaming = self._fixed("Streaming", "600.00")
        gym = self._fixed("Academia", "500.00")
        rent = self._fixed("Aluguel", "100.00", card=False)

        result = bulk_generate_fixed_expenses(
            "2026-10",
            [
                {"fixed_expense_id": fe.pk, "value": fe.default_value}
                for fe in (streaming, gym, rent)
            ],
            self.user,
        )

        self.assertEqual(result["created_count"], 1)  # só a despesa da conta
        [blocked] = result["blocked_cards"]
        self.assertEqual(blocked["required"], 1100.0)
        self.assertEqual(blocked["available"], 1000.0)
        self.assertEqual(blocked["missing"], 100.0)
        # Bloqueadas continuam pendentes no mês, para lançar após o ajuste
        streaming.refresh_from_db()
        rent.refresh_from_db()
        self.assertNotEqual(streaming.last_generated_month, "2026-10")
        self.assertEqual(rent.last_generated_month, "2026-10")

    def test_renegotiation_raises_current_limit_to_used(self):
        # Máximo 10.000, atual 5.000, 4.000 gastos (1.000 na fatura de set)
        self.card.credit_limit = Decimal("5000.00")
        self.card.save()
        bill = CreditCardBill.objects.create(
            credit_card=self.card,
            year="2026",
            month="Sep",
            invoice_beginning_date=date(2026, 9, 1),
            invoice_ending_date=date(2026, 9, 30),
            due_date=date(2026, 10, 10),
            total_amount=Decimal("0"),
            minimum_payment=Decimal("0"),
            paid_amount=Decimal("0"),
            status="open",
            closed=False,
            created_by=self.user,
        )
        self.assertEqual(
            self._purchase("3000.00", "2026-08-01").status_code, 201
        )
        self.assertEqual(
            self._purchase("1000.00", "2026-09-10").status_code, 201
        )
        bill.refresh_from_db()
        self.assertEqual(bill.total_amount, Decimal("1000.00"))

        # Fatura de 1.000 renegociada em 2.500 -> utilizado 5.500
        response = self.client.post(
            reverse("credit-card-bill-renegotiate", args=[bill.pk]),
            {"total_with_interest": "2500.00", "installments": 5},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.card.refresh_from_db()
        self.assertEqual(self.card.credit_limit, Decimal("5500.00"))
        self.assertEqual(self.card.max_limit, Decimal("10000.00"))
        self.assertEqual(
            response.data["limit_adjustment"]["new_credit_limit"], "5500.00"
        )
