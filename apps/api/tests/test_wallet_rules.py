"""Regras da Carteira Móvel (CM): única por usuário, só recebe saques."""

from datetime import date, time
from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Account
from accounts.serializers import AccountSerializer
from revenues.serializers import RevenueSerializer
from transfers.serializers import TransferSerializer


def _account(name, account_type="CC", user=None):
    return Account.objects.create(
        account_name=name,
        institution_name="SIC",
        account_type=account_type,
        created_by=user,
    )


class WalletRulesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("wallet", password="x")
        self.bank = _account("Sicoob", user=self.user)
        self.other = _account("Nubank", user=self.user)
        self.wallet = _account("Carteira", "CM", self.user)

    def _transfer(self, category, origin, destiny):
        return TransferSerializer(
            data={
                "description": "t",
                "value": "10.00",
                "date": date.today(),
                "horary": time(10, 0),
                "category": category,
                "origin_account": origin.id,
                "destiny_account": destiny.id,
            }
        )

    def test_transfer_rules(self):
        self.assertTrue(
            self._transfer("withdrawal", self.bank, self.wallet).is_valid()
        )
        self.assertTrue(
            self._transfer("pix", self.bank, self.other).is_valid()
        )
        self.assertFalse(
            self._transfer("withdrawal", self.bank, self.other).is_valid()
        )
        self.assertFalse(
            self._transfer("pix", self.bank, self.wallet).is_valid()
        )
        self.assertFalse(
            self._transfer("pix", self.wallet, self.bank).is_valid()
        )

    def test_wallet_revenue_categories(self):
        def valid(category):
            return RevenueSerializer(
                data={
                    "description": "r",
                    "value": "10.00",
                    "date": date.today(),
                    "horary": time(10, 0),
                    "category": category,
                    "account": self.wallet.id,
                    "received": True,
                }
            ).is_valid()

        self.assertTrue(valid("deposit"))
        for category in ("ticket", "income", "cashback"):
            self.assertFalse(valid(category))

    def test_single_wallet_per_user(self):
        serializer = AccountSerializer(
            data={
                "account_name": "Outra",
                "institution": "SIC",
                "account_type": "CM",
            },
            context={"request": SimpleNamespace(user=self.user)},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("account_type", serializer.errors)
