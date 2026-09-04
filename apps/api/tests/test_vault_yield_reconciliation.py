"""
Regression tests for the vault yield leak: available_balance must stay 0
when the whole account balance is reserved in a vault, no matter how many
times yield is applied or the rate is recalculated — i.e.
Σ(Revenue income ativas do cofre) == vault.accumulated_yield always holds.
"""

from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.db.models import Sum
from django.test import TestCase
from django.utils import timezone

from accounts.models import Account
from members.models import Member
from revenues.models import Revenue
from vaults.models import Vault


class VaultYieldInvariantTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="yieldinv",
            email="yieldinv@test.com",
            password="testpass123",
        )
        self.member = Member.objects.create(
            name="Yield Invariant User",
            document_hash="y" * 64,
            phone="11988880124",
            sex="M",
            user=self.user,
        )
        self.account = Account.objects.create(
            account_name="Yield Inv Account",
            institution_name="MPG",
            account_type="CC",
            is_active=True,
            current_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        self.vault = Vault.objects.create(
            description="Yield Inv Vault",
            account=self.account,
            annual_yield_rate=Decimal("0.1500"),
            is_active=True,
            created_by=self.user,
        )

    def _assert_invariant_and_zero_available(self):
        total_income = Revenue.objects.filter(
            related_vault=self.vault,
            category="income",
            is_deleted=False,
        ).aggregate(total=Sum("value"))["total"] or Decimal("0.00")
        self.vault.refresh_from_db()
        self.account.refresh_from_db()
        self.assertEqual(total_income, self.vault.accumulated_yield)
        self.assertEqual(self.account.available_balance, Decimal("0.00"))

    def _age_yield_clock(self, days):
        self.vault.refresh_from_db()
        self.vault.last_yield_date = timezone.now().date() - timedelta(
            days=days
        )
        self.vault.save()

    def test_full_deposit_keeps_available_zero_across_repeated_yield(self):
        self.vault.deposit(Decimal("1000.00"), user=self.user)
        self._assert_invariant_and_zero_available()

        for _ in range(3):
            self._age_yield_clock(10)
            applied = self.vault.apply_yield(user=self.user)
            self.assertGreater(applied, Decimal("0.00"))
            self._assert_invariant_and_zero_available()

    def test_rate_change_and_recalculate_keeps_invariant(self):
        self.vault.deposit(Decimal("1000.00"), user=self.user)
        self._age_yield_clock(10)
        self.vault.apply_yield(user=self.user)
        self._age_yield_clock(10)
        self.vault.apply_yield(user=self.user)

        self.vault.recalculate_yields(
            new_rate=Decimal("0.1200"), user=self.user
        )
        self._assert_invariant_and_zero_available()

    def test_reconcile_command_fixes_injected_drift(self):
        """
        Simulates the production leak: accumulated_yield bumped without a
        matching Revenue (e.g. a manual/partial fix touching only one side).
        """
        self.vault.deposit(Decimal("1000.00"), user=self.user)
        self._age_yield_clock(10)
        self.vault.apply_yield(user=self.user)

        self.vault.refresh_from_db()
        self.vault.accumulated_yield += Decimal("3.03")
        self.vault.current_balance += Decimal("3.03")
        self.vault.save()

        self.account.refresh_from_db()
        self.assertEqual(self.account.available_balance, Decimal("-3.03"))

        out = StringIO()
        call_command(
            "reconcile_vault_yield", f"--vault={self.vault.uuid}", stdout=out
        )

        self._assert_invariant_and_zero_available()
        self.assertIn(str(self.vault.uuid), out.getvalue())

    def test_reconcile_command_dry_run_reports_without_writing(self):
        self.vault.deposit(Decimal("1000.00"), user=self.user)
        self._age_yield_clock(10)
        self.vault.apply_yield(user=self.user)

        self.vault.refresh_from_db()
        self.vault.accumulated_yield += Decimal("3.03")
        self.vault.save(update_fields=["accumulated_yield"])

        out = StringIO()
        call_command(
            "reconcile_vault_yield",
            f"--vault={self.vault.uuid}",
            "--dry-run",
            stdout=out,
        )

        self.vault.refresh_from_db()
        income = Revenue.objects.filter(
            related_vault=self.vault, category="income", is_deleted=False
        ).count()
        # accumulated_yield still diverges from the (untouched) revenue.
        self.assertNotEqual(
            self.vault.accumulated_yield,
            sum(
                (
                    r.value
                    for r in Revenue.objects.filter(
                        related_vault=self.vault,
                        category="income",
                        is_deleted=False,
                    )
                ),
                Decimal("0.00"),
            ),
        )
        self.assertGreaterEqual(income, 1)
