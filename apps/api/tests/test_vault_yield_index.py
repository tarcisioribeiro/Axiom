"""
Tests for the CDI/SELIC real-index yield feature: index_rates service,
Vault.refresh_annual_rate_from_index, Vault.simulate_yield_preview, and the
yield-preview/update-yield endpoints. External BCB calls are mocked —
these tests must not depend on network access.
"""

import datetime
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account
from members.models import Member
from vaults.models import Vault
from vaults.services.index_rates import (
    annualize_daily_rate,
    compute_index_annual_rate,
)


class AnnualizeDailyRateTest(SimpleTestCase):
    def test_zero_when_no_rate(self):
        self.assertEqual(annualize_daily_rate(None), Decimal("0.0000"))
        self.assertEqual(annualize_daily_rate(Decimal("0")), Decimal("0.0000"))

    def test_compounds_over_252_business_days(self):
        # ~0.0005 a.d. compounded over 252 days -> a realistic CDI a.a.
        result = annualize_daily_rate(Decimal("0.0005"))
        expected = ((1 + Decimal("0.0005")) ** 252 - 1).quantize(
            Decimal("0.0001")
        )
        self.assertEqual(result, expected)
        self.assertGreater(result, Decimal("0.10"))
        self.assertLess(result, Decimal("0.20"))


class ComputeIndexAnnualRateTest(SimpleTestCase):
    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_applies_percentage_over_daily_index_before_annualizing(
        self, mock_fetch
    ):
        mock_fetch.return_value = (
            Decimal("0.0005"),
            datetime.date(2026, 9, 11),
        )
        annual_rate, ref_date = compute_index_annual_rate(
            "cdi", Decimal("120")
        )
        expected = annualize_daily_rate(Decimal("0.0005") * Decimal("1.20"))
        self.assertEqual(annual_rate, expected)
        self.assertEqual(ref_date, datetime.date(2026, 9, 11))

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_tax_rate_discounts_daily_rate_before_annualizing(
        self, mock_fetch
    ):
        mock_fetch.return_value = (
            Decimal("0.0005"),
            datetime.date(2026, 9, 11),
        )
        annual_rate, _ = compute_index_annual_rate(
            "cdi", Decimal("120"), tax_rate=Decimal("0.225")
        )
        expected = annualize_daily_rate(
            Decimal("0.0005") * Decimal("1.20") * Decimal("0.775")
        )
        self.assertEqual(annual_rate, expected)

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_none_when_api_unavailable(self, mock_fetch):
        mock_fetch.return_value = (None, None)
        annual_rate, ref_date = compute_index_annual_rate(
            "cdi", Decimal("100")
        )
        self.assertIsNone(annual_rate)
        self.assertIsNone(ref_date)


class VaultRefreshAnnualRateFromIndexTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="idxrefresh",
            email="idxrefresh@test.com",
            password="testpass123",
        )
        self.member = Member.objects.create(
            name="Idx Refresh User",
            document_hash="i" * 64,
            phone="11988880130",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Idx Refresh Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        self.vault = Vault.objects.create(
            description="Idx Refresh Vault",
            account=self.account,
            annual_yield_rate=Decimal("0.1500"),
            is_active=True,
            created_by=self.user,
        )

    def test_none_type_is_noop(self):
        result = self.vault.refresh_annual_rate_from_index(user=self.user)
        self.assertIsNone(result)
        self.vault.refresh_from_db()
        self.assertEqual(self.vault.annual_yield_rate, Decimal("0.1500"))

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_cdi_type_updates_annual_rate(self, mock_fetch):
        mock_fetch.return_value = (
            Decimal("0.0005"),
            datetime.date(2026, 9, 11),
        )
        self.vault.yield_index_type = "cdi"
        self.vault.yield_index_percentage = Decimal("120")
        self.vault.save()

        result = self.vault.refresh_annual_rate_from_index(user=self.user)

        self.vault.refresh_from_db()
        self.assertIsNotNone(result)
        self.assertEqual(self.vault.annual_yield_rate, result)
        self.assertNotEqual(self.vault.annual_yield_rate, Decimal("0.1500"))

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_keeps_last_known_rate_when_api_fails(self, mock_fetch):
        mock_fetch.return_value = (None, None)
        self.vault.yield_index_type = "selic"
        self.vault.yield_index_percentage = Decimal("100")
        self.vault.save()

        result = self.vault.refresh_annual_rate_from_index(user=self.user)

        self.vault.refresh_from_db()
        self.assertIsNone(result)
        self.assertEqual(self.vault.annual_yield_rate, Decimal("0.1500"))


class VaultSimulateYieldPreviewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="idxpreview",
            email="idxpreview@test.com",
            password="testpass123",
        )
        self.member = Member.objects.create(
            name="Idx Preview User",
            document_hash="p" * 64,
            phone="11988880131",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Idx Preview Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        self.vault = Vault.objects.create(
            description="Idx Preview Vault",
            account=self.account,
            annual_yield_rate=Decimal("0.1500"),
            is_active=True,
            created_by=self.user,
        )
        self.vault.deposit(Decimal("1000.00"), user=self.user)

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_preview_does_not_persist_anything(self, mock_fetch):
        mock_fetch.return_value = (
            Decimal("0.0005"),
            datetime.date(2026, 9, 11),
        )
        preview = self.vault.simulate_yield_preview(
            index_type="cdi", percentage=Decimal("120")
        )

        self.assertIsNotNone(preview)
        self.assertGreater(preview["value"], Decimal("0.00"))

        self.vault.refresh_from_db()
        self.assertEqual(self.vault.yield_index_type, "none")
        self.assertEqual(self.vault.annual_yield_rate, Decimal("0.1500"))

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_preview_none_when_index_unavailable(self, mock_fetch):
        mock_fetch.return_value = (None, None)
        preview = self.vault.simulate_yield_preview(index_type="selic")
        self.assertIsNone(preview)

    def test_preview_falls_back_to_manual_rate_without_index(self):
        preview = self.vault.simulate_yield_preview()
        self.assertIsNotNone(preview)
        self.assertEqual(preview["index_type"], "none")
        self.assertEqual(preview["annual_rate"], Decimal("0.1500"))


class VaultYieldPreviewViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="idxpreviewview",
            email="idxpreviewview@test.com",
            password="testpass123",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Idx Preview View User",
            document_hash="v" * 64,
            phone="11988880132",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Idx Preview View Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        self.vault = Vault.objects.create(
            description="Idx Preview View Vault",
            account=self.account,
            annual_yield_rate=Decimal("0.1500"),
            is_active=True,
            created_by=self.user,
        )
        self.vault.deposit(Decimal("1000.00"), user=self.user)

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_preview_endpoint_returns_simulated_value(self, mock_fetch):
        mock_fetch.return_value = (
            Decimal("0.0005"),
            datetime.date(2026, 9, 11),
        )
        url = reverse("vault-yield-preview", args=[self.vault.pk])
        response = self.client.post(
            url,
            {"yield_index_type": "cdi", "yield_index_percentage": "120"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data  # type: ignore
        self.assertEqual(data["index_type"], "cdi")
        self.assertGreater(data["next_yield_value"], 0)
        # Preview must not persist any change to the vault.
        self.vault.refresh_from_db()
        self.assertEqual(self.vault.yield_index_type, "none")

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_preview_endpoint_503_when_index_unavailable(self, mock_fetch):
        mock_fetch.return_value = (None, None)
        url = reverse("vault-yield-preview", args=[self.vault.pk])
        response = self.client.post(url, {"yield_index_type": "selic"})
        self.assertEqual(
            response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
        )

    def test_preview_endpoint_404_for_unknown_vault(self):
        url = reverse("vault-yield-preview", args=[999999])
        response = self.client.post(url, {"yield_index_type": "cdi"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class VaultUpdateYieldViewIndexTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="idxupdateyield",
            email="idxupdateyield@test.com",
            password="testpass123",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="Idx Update Yield User",
            document_hash="u" * 64,
            phone="11988880133",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Idx Update Yield Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        self.vault = Vault.objects.create(
            description="Idx Update Yield Vault",
            account=self.account,
            annual_yield_rate=Decimal("0.1500"),
            is_active=True,
            created_by=self.user,
        )

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_setting_cdi_index_recomputes_annual_rate(self, mock_fetch):
        mock_fetch.return_value = (
            Decimal("0.0005"),
            datetime.date(2026, 9, 11),
        )
        url = reverse("vault-update-yield", args=[self.vault.pk])
        response = self.client.post(
            url,
            {"yield_index_type": "cdi", "yield_index_percentage": "120"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.vault.refresh_from_db()
        self.assertEqual(self.vault.yield_index_type, "cdi")
        self.assertEqual(self.vault.yield_index_percentage, Decimal("120.00"))
        self.assertNotEqual(self.vault.annual_yield_rate, Decimal("0.1500"))
        data = response.data  # type: ignore
        self.assertIn("annual_yield_rate_changed", data)

    @patch("vaults.services.index_rates.fetch_latest_daily_rate")
    def test_setting_cdi_index_warns_when_api_unavailable(self, mock_fetch):
        mock_fetch.return_value = (None, None)
        url = reverse("vault-update-yield", args=[self.vault.pk])
        response = self.client.post(url, {"yield_index_type": "cdi"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("index_warning", response.data)  # type: ignore
        self.vault.refresh_from_db()
        # Last known rate is kept, not zeroed out.
        self.assertEqual(self.vault.annual_yield_rate, Decimal("0.1500"))
