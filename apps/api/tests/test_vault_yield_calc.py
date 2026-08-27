"""Unit tests for the pure vault yield helpers."""

import datetime
from decimal import Decimal

from django.test import SimpleTestCase

from vaults.services.yield_calc import (
    compound_yield,
    count_business_days,
    daily_rate_from,
)


class CountBusinessDaysTest(SimpleTestCase):
    def test_zero_when_end_before_or_equal_start(self):
        d = datetime.date(2026, 8, 27)
        self.assertEqual(count_business_days(d, d), 0)
        self.assertEqual(
            count_business_days(d, d - datetime.timedelta(days=3)), 0
        )

    def test_full_week_has_five_business_days(self):
        start = datetime.date(2026, 8, 24)  # Monday
        end = datetime.date(2026, 8, 31)  # next Monday
        self.assertEqual(count_business_days(start, end), 5)

    def test_skips_weekend(self):
        # Fri -> Mon (exclusive start): Sat, Sun, Mon -> 1 business day
        start = datetime.date(2026, 8, 28)  # Friday
        end = datetime.date(2026, 8, 31)  # Monday
        self.assertEqual(count_business_days(start, end), 1)


class DailyRateFromTest(SimpleTestCase):
    def test_prefers_annual_rate(self):
        rate = daily_rate_from(Decimal("0.1500"), Decimal("0.001"))
        self.assertEqual(
            rate,
            (Decimal("0.15") / Decimal("252")).quantize(Decimal("0.000001")),
        )

    def test_falls_back_to_legacy_rate(self):
        self.assertEqual(
            daily_rate_from(Decimal("0"), Decimal("0.000500")),
            Decimal("0.000500"),
        )

    def test_zero_when_both_absent(self):
        self.assertEqual(
            daily_rate_from(Decimal("0"), Decimal("0")), Decimal("0.000000")
        )


class CompoundYieldTest(SimpleTestCase):
    def test_zero_for_non_positive_inputs(self):
        self.assertEqual(
            compound_yield(Decimal("0"), Decimal("0.001"), 10), Decimal("0.00")
        )
        self.assertEqual(
            compound_yield(Decimal("100"), Decimal("0"), 10), Decimal("0.00")
        )
        self.assertEqual(
            compound_yield(Decimal("100"), Decimal("0.001"), 0),
            Decimal("0.00"),
        )

    def test_compounds_over_business_days(self):
        result = compound_yield(Decimal("1000.00"), Decimal("0.000595"), 21)
        # ~1000 * ((1.000595)^21 - 1)
        self.assertGreater(result, Decimal("12.00"))
        self.assertLess(result, Decimal("13.00"))

    def test_same_day_deposit_yields_nothing(self):
        # Regression: depositing into an empty vault must not accrue yield
        # for a zero-day period.
        self.assertEqual(
            compound_yield(Decimal("5005.55"), Decimal("0.000595"), 0),
            Decimal("0.00"),
        )
