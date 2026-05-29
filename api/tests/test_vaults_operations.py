"""
Tests for vaults/views.py: deposit/withdraw error paths, vault filtering,
VaultTransaction update/delete, and VaultTransactionListView filters.
Drives coverage of the financial vault operation layer.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member


class BaseVaultOperationsTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="vaultopstest",
            email="vaultops@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Vault Ops User",
            document_hash="o" * 64,
            phone="11988880007",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Vault Ops Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("50000.00"),
        )

    def _create_vault(self, yield_rate="0.009", balance=None):
        """Helper to create a vault via API."""
        url = reverse("vault-list-create")
        payload = {
            "description": "Test Vault",
            "account": self.account.pk,
            "yield_rate": yield_rate,
            "annual_yield_rate": "0.1100",
            "is_active": True,
        }
        if balance is not None:
            payload["current_balance"] = str(balance)
        resp = self.client.post(url, payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.data["id"]


# ---------------------------------------------------------------------------
# VaultListCreateView — filter by account and is_active
# ---------------------------------------------------------------------------


class VaultListFilterTest(BaseVaultOperationsTestCase):
    def test_list_vaults_filter_by_account(self):
        """GET /vaults/?account=<pk> filters by account_id."""
        self._create_vault()
        url = reverse("vault-list-create")
        response = self.client.get(url, {"account": self.account.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertGreater(response.data["count"], 0)

    def test_list_vaults_filter_is_active_true(self):
        """GET /vaults/?is_active=true filters active vaults."""
        self._create_vault()
        url = reverse("vault-list-create")
        response = self.client.get(url, {"is_active": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["count"], 0)

    def test_list_vaults_filter_is_active_false(self):
        """GET /vaults/?is_active=false returns empty when all active."""
        self._create_vault()
        url = reverse("vault-list-create")
        response = self.client.get(url, {"is_active": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)


# ---------------------------------------------------------------------------
# VaultDepositView — success, vault not found, invalid data
# ---------------------------------------------------------------------------


class VaultDepositViewTest(BaseVaultOperationsTestCase):
    def test_deposit_success(self):
        """Deposit to a valid vault succeeds."""
        vault_pk = self._create_vault()
        url = reverse("vault-deposit", args=[vault_pk])
        response = self.client.post(url, {"amount": "100.00"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertIn("transaction", response.data)
        self.assertIn("vault", response.data)

    def test_deposit_vault_not_found(self):
        """Deposit to non-existent vault returns 404."""
        url = reverse("vault-deposit", args=[99999])
        response = self.client.post(url, {"amount": "100.00"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)

    def test_deposit_invalid_data(self):
        """Deposit with missing amount returns 400."""
        vault_pk = self._create_vault()
        url = reverse("vault-deposit", args=[vault_pk])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deposit_insufficient_account_balance(self):
        """Deposit exceeding account balance returns 400."""
        account_low = Account.objects.create(
            account_name="Low Balance Account",
            institution_name="NUB",
            account_type="CS",
            is_active=True,
            current_balance=Decimal("10.00"),
        )
        vault_url = reverse("vault-list-create")
        resp = self.client.post(
            vault_url,
            {
                "description": "Low Balance Vault",
                "account": account_low.pk,
                "yield_rate": "0.009",
                "annual_yield_rate": "0.1100",
                "is_active": True,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        vault_pk = resp.data["id"]
        url = reverse("vault-deposit", args=[vault_pk])
        response = self.client.post(url, {"amount": "5000.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


# ---------------------------------------------------------------------------
# VaultWithdrawView — success, vault not found, insufficient vault balance
# ---------------------------------------------------------------------------


class VaultWithdrawViewTest(BaseVaultOperationsTestCase):
    def setUp(self):
        super().setUp()
        vault_pk = self._create_vault()
        # Deposit first so we can withdraw
        self.client.post(
            reverse("vault-deposit", args=[vault_pk]), {"amount": "500.00"}
        )
        self.vault_pk = vault_pk

    def test_withdraw_success(self):
        """Withdraw from a funded vault succeeds."""
        url = reverse("vault-withdraw", args=[self.vault_pk])
        response = self.client.post(url, {"amount": "100.00"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertIn("transaction", response.data)
        self.assertIn("vault", response.data)

    def test_withdraw_vault_not_found(self):
        """Withdraw from non-existent vault returns 404."""
        url = reverse("vault-withdraw", args=[99999])
        response = self.client.post(url, {"amount": "100.00"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)

    def test_withdraw_invalid_data(self):
        """Withdraw with missing amount returns 400."""
        url = reverse("vault-withdraw", args=[self.vault_pk])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_withdraw_insufficient_vault_balance(self):
        """Withdraw more than vault balance returns 400."""
        url = reverse("vault-withdraw", args=[self.vault_pk])
        response = self.client.post(url, {"amount": "999999.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


# ---------------------------------------------------------------------------
# VaultTransactionListView — filter by type
# ---------------------------------------------------------------------------


class VaultTransactionListFilterTest(BaseVaultOperationsTestCase):
    def setUp(self):
        super().setUp()
        self.vault_pk = self._create_vault()
        # Create a deposit transaction
        self.client.post(
            reverse("vault-deposit", args=[self.vault_pk]),
            {"amount": "200.00"},
        )

    def test_transaction_list_filter_by_type_deposit(self):
        """
        GET /vaults/<pk>/transactions/?type=deposit filters deposit
        transactions.
        """
        url = reverse("vault-transactions", args=[self.vault_pk])
        response = self.client.get(url, {"type": "deposit"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        for tx in results:
            self.assertEqual(tx["transaction_type"], "deposit")

    def test_all_vault_transactions_filter_by_vault(self):
        """GET /vault-transactions/?vault=<pk> filters by vault_id."""
        url = reverse("all-vault-transactions")
        response = self.client.get(url, {"vault": self.vault_pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_all_vault_transactions_filter_by_type(self):
        """
        GET /vault-transactions/?type=deposit filters by transaction_type.
        """
        url = reverse("all-vault-transactions")
        response = self.client.get(url, {"type": "deposit"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# VaultTransactionUpdateView — patch and delete yield transactions
# ---------------------------------------------------------------------------


class VaultTransactionUpdateDeleteTest(BaseVaultOperationsTestCase):
    def setUp(self):
        super().setUp()
        from vaults.models import Vault, VaultTransaction

        self.vault_pk = self._create_vault()
        # Deposit to fund the vault
        self.client.post(
            reverse("vault-deposit", args=[self.vault_pk]),
            {"amount": "1000.00"},
        )
        # Create a yield transaction directly so patch/delete tests are not
        # skipped
        vault = Vault.objects.get(pk=self.vault_pk)
        vault.current_balance += Decimal("10.00")
        vault.accumulated_yield += Decimal("10.00")
        vault.save()
        self.yield_tx = VaultTransaction.objects.create(
            vault=vault,
            transaction_type="yield",
            amount=Decimal("10.00"),
            balance_after=vault.current_balance,
            description="Test yield",
            created_by=self.user,
        )

    def test_patch_yield_transaction(self):
        """PATCH /vault-transactions/<pk>/ updates a yield transaction."""
        url = reverse("vault-transaction-update", args=[self.yield_tx.pk])
        response = self.client.patch(url, {"amount": "5.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertIn("adjustment", response.data)
        self.assertIn("vault", response.data)

    def test_delete_yield_transaction(self):
        """
        DELETE /vault-transactions/<pk>/ soft-deletes a yield transaction.
        """
        # Create a separate yield tx so patch test doesn't interfere
        from vaults.models import Vault, VaultTransaction

        vault = Vault.objects.get(pk=self.vault_pk)
        vault.current_balance += Decimal("5.00")
        vault.accumulated_yield += Decimal("5.00")
        vault.save()
        yield_tx2 = VaultTransaction.objects.create(
            vault=vault,
            transaction_type="yield",
            amount=Decimal("5.00"),
            balance_after=vault.current_balance,
            description="Delete yield",
            created_by=self.user,
        )

        url = reverse("vault-transaction-update", args=[yield_tx2.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertIn("reversed_amount", response.data)

    def test_patch_non_yield_transaction_returns_400(self):
        """PATCH on a non-yield transaction returns 400."""
        # Get a deposit transaction
        tx_list_resp = self.client.get(
            reverse("vault-transactions", args=[self.vault_pk]),
            {"type": "deposit"},
        )
        results = tx_list_resp.data.get("results", tx_list_resp.data)
        if not results:
            self.skipTest("No deposit transaction available")
        deposit_tx_pk = results[0]["id"]
        url = reverse("vault-transaction-update", args=[deposit_tx_pk])
        response = self.client.patch(url, {"amount": "5.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_delete_non_yield_transaction_returns_400(self):
        """DELETE on a non-yield transaction returns 400."""
        tx_list_resp = self.client.get(
            reverse("vault-transactions", args=[self.vault_pk]),
            {"type": "deposit"},
        )
        results = tx_list_resp.data.get("results", tx_list_resp.data)
        if not results:
            self.skipTest("No deposit transaction available")
        deposit_tx_pk = results[0]["id"]
        url = reverse("vault-transaction-update", args=[deposit_tx_pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_patch_transaction_not_found(self):
        """PATCH on a non-existent transaction returns 404."""
        url = reverse("vault-transaction-update", args=[99999])
        response = self.client.patch(url, {"amount": "5.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_transaction_not_found(self):
        """DELETE on a non-existent transaction returns 404."""
        url = reverse("vault-transaction-update", args=[99999])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# VaultApplyYieldView and VaultUpdateYieldView — error paths and extra branches
# ---------------------------------------------------------------------------


class VaultYieldExtraTest(BaseVaultOperationsTestCase):
    def test_apply_yield_vault_not_found(self):
        """apply-yield on non-existent vault returns 404."""
        url = reverse("vault-apply-yield", args=[99999])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)

    def test_update_yield_vault_not_found(self):
        """update-yield on non-existent vault returns 404."""
        url = reverse("vault-update-yield", args=[99999])
        response = self.client.post(url, {"yield_rate": "0.010"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)

    def test_update_yield_with_accumulated_yield(self):
        """update-yield with accumulated_yield param updates vault balance."""
        vault_pk = self._create_vault()
        self.client.post(
            reverse("vault-deposit", args=[vault_pk]), {"amount": "1000.00"}
        )
        url = reverse("vault-update-yield", args=[vault_pk])
        response = self.client.post(
            url,
            {"annual_yield_rate": "0.1200", "accumulated_yield": "15.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("accumulated_yield_changed", response.data)

    def test_update_yield_with_recalculate(self):
        """
        update-yield with recalculate=True recalculates yield transactions.
        """
        from vaults.models import Vault, VaultTransaction

        vault_pk = self._create_vault()
        self.client.post(
            reverse("vault-deposit", args=[vault_pk]), {"amount": "1000.00"}
        )
        # Create a yield transaction so recalculate has something to revert
        vault = Vault.objects.get(pk=vault_pk)
        vault.current_balance += Decimal("8.00")
        vault.accumulated_yield += Decimal("8.00")
        vault.save()
        VaultTransaction.objects.create(
            vault=vault,
            transaction_type="yield",
            amount=Decimal("8.00"),
            balance_after=vault.current_balance,
            description="Pre-existing yield",
            created_by=self.user,
        )

        url = reverse("vault-update-yield", args=[vault_pk])
        response = self.client.post(
            url,
            {"yield_rate": "0.008", "recalculate": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("recalculation", response.data)


# ---------------------------------------------------------------------------
# VaultApplyYieldView — success path with actual yield calculation
# ---------------------------------------------------------------------------


class VaultApplyYieldSuccessTest(BaseVaultOperationsTestCase):
    def test_apply_yield_with_past_last_yield_date(self):
        """
        Covers count_business_days (lines 19-36),
        calculate_yield (lines 156-164),
        and apply_yield result > 0 block (lines 187-201) in vaults/models.py.
        """
        import datetime

        from vaults.models import Vault

        vault_pk = self._create_vault()
        # Fund the vault first
        self.client.post(
            reverse("vault-deposit", args=[vault_pk]), {"amount": "10000.00"}
        )

        # Set last_yield_date to 7 days ago so yield is non-zero
        vault = Vault.objects.get(pk=vault_pk)
        vault.last_yield_date = datetime.date.today() - datetime.timedelta(
            days=7
        )
        vault.save()

        url = reverse("vault-apply-yield", args=[vault_pk])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("yield_applied", response.data)
        self.assertGreater(response.data["yield_applied"], 0)
