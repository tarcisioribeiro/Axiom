"""
Regression tests for the vault <-> account balance separation.

Covers:
- Vault deposits/withdrawals no longer mutate ``Account.current_balance``
  (which is derived from revenues - expenses) but are reflected in
  ``Account.available_balance``.
- Applied yield is booked as an ``income`` Revenue on the associated account
  (consolidated per month) so the full vault balance stays reserved and the
  available balance is unaffected.
- ``accumulated_yield`` is cleared when the vault is emptied and never
  exceeds ``current_balance`` after a partial withdrawal.
- The yield "clock" (``last_yield_date``) is reset when a vault is emptied,
  so a later deposit does not accrue retroactive yield.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member
from vaults.models import Vault, VaultTransaction


class VaultBalanceSeparationTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="vaultsep",
            email="vaultsep@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Vault Sep User",
            document_hash="s" * 64,
            phone="11988880123",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Sep Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        self.vault = Vault.objects.create(
            description="Sep Vault",
            account=self.account,
            annual_yield_rate=Decimal("0.1500"),
            is_active=True,
            created_by=self.user,
        )

    def _deposit(self, amount):
        return self.client.post(
            reverse("vault-deposit", args=[self.vault.pk]),
            {"amount": str(amount)},
        )

    def _withdraw(self, amount):
        return self.client.post(
            reverse("vault-withdraw", args=[self.vault.pk]),
            {"amount": str(amount)},
        )

    def test_deposit_keeps_total_balance_but_reduces_available(self):
        resp = self._deposit("400.00")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("1000.00"))
        self.assertEqual(self.account.deposited_in_vaults, Decimal("400.00"))
        self.assertEqual(self.account.available_balance, Decimal("600.00"))

    def test_withdraw_restores_available_balance(self):
        self._deposit("400.00")
        self._withdraw("150.00")

        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, Decimal("1000.00"))
        self.assertEqual(self.account.deposited_in_vaults, Decimal("250.00"))
        self.assertEqual(self.account.available_balance, Decimal("750.00"))

    def test_deposit_rejected_when_exceeds_available_balance(self):
        self._deposit("900.00")
        resp = self._deposit("200.00")  # only 100 available
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def _age_yield_clock(self, days):
        self.vault.refresh_from_db()
        self.vault.last_yield_date = timezone.now().date() - timedelta(
            days=days
        )
        self.vault.save()

    def test_applied_yield_is_reserved_and_booked_as_revenue(self):
        from revenues.models import Revenue

        self._deposit("500.00")
        self._age_yield_clock(30)

        self.account.refresh_from_db()
        available_before = self.account.available_balance

        applied = self.vault.apply_yield()
        self.assertGreater(applied, Decimal("0.00"))

        self.vault.refresh_from_db()
        self.account.refresh_from_db()

        # The yield sits in the vault and the full balance is reserved.
        self.assertEqual(self.vault.accumulated_yield, applied)
        self.assertEqual(
            self.account.deposited_in_vaults, self.vault.current_balance
        )

        # A consolidated income revenue was booked on the account...
        rev = Revenue.objects.get(
            related_vault=self.vault, category="income", is_deleted=False
        )
        self.assertEqual(rev.value, applied)
        self.assertTrue(rev.received)

        # ...so the account balance grew by the yield and the balance
        # available for spending is unchanged.
        self.assertEqual(self.account.available_balance, available_before)

    def test_applied_yield_is_consolidated_per_month(self):
        from revenues.models import Revenue

        self._deposit("500.00")
        self._age_yield_clock(30)
        self.vault.apply_yield()

        self._age_yield_clock(10)
        second = self.vault.apply_yield()
        self.assertGreater(second, Decimal("0.00"))

        revs = Revenue.objects.filter(
            related_vault=self.vault, category="income", is_deleted=False
        )
        self.assertEqual(revs.count(), 1)
        self.vault.refresh_from_db()
        self.assertEqual(revs.first().value, self.vault.accumulated_yield)

    def test_partial_withdraw_caps_and_reduces_yield_revenue(self):
        from revenues.models import Revenue

        self._deposit("500.00")
        self._age_yield_clock(30)
        applied = self.vault.apply_yield()
        self.vault.refresh_from_db()
        total = self.vault.current_balance

        self._withdraw(str(total - Decimal("2.00")))

        self.vault.refresh_from_db()
        self.assertEqual(self.vault.current_balance, Decimal("2.00"))
        self.assertEqual(self.vault.accumulated_yield, Decimal("2.00"))

        # The consumed yield (applied - 2.00) is removed from the revenue,
        # which now equals the yield still sitting in the vault.
        active = Revenue.objects.filter(
            related_vault=self.vault, category="income", is_deleted=False
        )
        self.assertEqual(
            sum((r.value for r in active), Decimal("0.00")), Decimal("2.00")
        )
        self.assertGreater(applied, Decimal("2.00"))

    def test_empty_vault_deposit_resets_yield_clock(self):
        # Backdate the clock as if the vault had held money long ago.
        stale = timezone.now().date() - timedelta(days=120)
        self.vault.last_yield_date = stale
        self.vault.current_balance = Decimal("0.00")
        self.vault.save()

        self._deposit("600.00")
        # A second deposit the same day triggers apply_yield again.
        self._deposit("400.00")

        self.vault.refresh_from_db()
        self.assertEqual(self.vault.last_yield_date, timezone.now().date())
        # No retroactive yield was accrued over the stale period.
        yields = VaultTransaction.objects.filter(
            vault=self.vault, transaction_type="yield", is_deleted=False
        )
        self.assertEqual(yields.count(), 0)
        self.assertEqual(self.vault.current_balance, Decimal("1000.00"))

    def test_withdraw_to_zero_clears_yield_clock_and_revenue(self):
        from revenues.models import Revenue

        self._deposit("300.00")
        self._age_yield_clock(30)
        self.vault.apply_yield()
        self.vault.refresh_from_db()
        self.assertGreater(self.vault.accumulated_yield, Decimal("0.00"))

        self.account.refresh_from_db()
        balance_before_yield_cycle = Decimal("1000.00")

        self._withdraw(str(self.vault.current_balance))

        self.vault.refresh_from_db()
        self.account.refresh_from_db()
        self.assertEqual(self.vault.current_balance, Decimal("0.00"))
        self.assertEqual(self.vault.accumulated_yield, Decimal("0.00"))
        self.assertIsNone(self.vault.last_yield_date)

        # The emptied vault leaves no yield revenue behind and the account
        # balance returns to what it was before any yield accrued.
        self.assertFalse(
            Revenue.objects.filter(
                related_vault=self.vault,
                category="income",
                is_deleted=False,
            ).exists()
        )
        self.assertEqual(
            self.account.current_balance, balance_before_yield_cycle
        )

    def test_account_serializer_exposes_new_fields(self):
        self._deposit("250.00")
        resp = self.client.get(reverse("account-create-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        row = next(
            r for r in resp.data["results"] if r["id"] == self.account.id
        )
        self.assertEqual(row["deposited_in_vaults"], "250.00")
        self.assertEqual(row["available_balance"], "750.00")
