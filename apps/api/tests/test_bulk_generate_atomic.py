"""
Regression: a failure mid-batch in bulk_generate_fixed_expenses (e.g. the
loan signal's select_for_update raising outside a transaction) used to leave
the expenses created before the error persisted, so a retry reported them as
"already launched". The whole batch must now roll back.
"""

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Account
from expenses.models import Expense, FixedExpense
from expenses.services import bulk_generate_fixed_expenses


class BulkGenerateAtomicTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="bulkatomic", password="testpass123", is_superuser=True
        )
        account = Account.objects.create(
            account_name="AtomicAcc",
            institution_name="NUB",
            account_type="CC",
            is_active=True,
        )
        self.templates = [
            FixedExpense.objects.create(
                description=f"Fixa {i}",
                default_value=Decimal("10.00"),
                category="others",
                account=account,
                due_day=10,
                is_active=True,
            )
            for i in range(2)
        ]

    def test_failure_mid_batch_rolls_back_everything(self):
        real_create = Expense.objects.create
        calls = []

        def flaky_create(**kwargs):
            calls.append(1)
            if len(calls) == 2:
                raise RuntimeError("boom")
            return real_create(**kwargs)

        values = [
            {"fixed_expense_id": t.id, "value": 10.0} for t in self.templates
        ]
        with patch.object(Expense.objects, "create", side_effect=flaky_create):
            with self.assertRaises(RuntimeError):
                bulk_generate_fixed_expenses("2026-09", values, self.user)

        self.assertFalse(
            Expense.objects.filter(
                fixed_expense_template__in=self.templates
            ).exists()
        )
        self.templates[0].refresh_from_db()
        self.assertNotEqual(self.templates[0].last_generated_month, "2026-09")
