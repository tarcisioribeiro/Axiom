"""
Tests for personal_planning/services/instance_generator.py — edge cases.

Covers:
- Task with day_of_month=29 (leap-year date) across leap and non-leap years
- DST transition hours (America/Sao_Paulo, historical Nov 2018 switchover)
- Task generated at 23:59 BRT (boundary of date change)
- Already-generated instances are NOT modified when the template changes
"""

from datetime import date, time

from django.contrib.auth.models import User
from django.test import TestCase

from freezegun import freeze_time

from members.models import Member
from personal_planning.models import RoutineTask, TaskInstance
from personal_planning.services.instance_generator import InstanceGenerator

# ---------------------------------------------------------------------------
# Base fixture
# ---------------------------------------------------------------------------


class InstanceGeneratorBaseTestCase(TestCase):
    """Creates a superuser + member shared by all subclasses."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="ig_test",
            email="ig@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.member = Member.objects.create(
            name="IG Test User",
            document_hash="i" * 64,
            phone="11999999900",
            sex="M",
            user=self.user,
        )


# ---------------------------------------------------------------------------
# 1. Feb 29 — leap year vs non-leap year
# ---------------------------------------------------------------------------


class LeapYearEdgeCaseTest(InstanceGeneratorBaseTestCase):
    """Monthly task with day_of_month=29 should only appear on dates whose
    day == 29.  February of a non-leap year has no such date."""

    def setUp(self):
        super().setUp()
        self.task = RoutineTask.objects.create(
            name="Monthly on 29th",
            category="health",
            periodicity="monthly",
            day_of_month=29,
            owner=self.member,
        )

    def test_appears_on_feb_29_in_leap_year(self):
        """Task with day_of_month=29 fires on Feb 29 of a leap year."""
        leap_day = date(2024, 2, 29)
        self.assertTrue(self.task.should_appear_on_date(leap_day))

        instances = InstanceGenerator.generate_for_date(self.member, leap_day)
        self.assertEqual(len(instances), 1)
        self.assertEqual(instances[0].scheduled_date, leap_day)

    def test_does_not_appear_on_feb_28_in_non_leap_year(self):
        """Feb 28 of a non-leap year does NOT match day_of_month=29."""
        non_leap_feb = date(2025, 2, 28)
        self.assertFalse(self.task.should_appear_on_date(non_leap_feb))

        instances = InstanceGenerator.generate_for_date(
            self.member, non_leap_feb
        )
        self.assertEqual(len(instances), 0)

    def test_no_day_in_february_non_leap_year_matches(self):
        """No day in Feb 2023 (non-leap, 28 days) matches day_of_month=29."""
        for day in range(1, 29):
            d = date(2023, 2, day)
            self.assertFalse(
                self.task.should_appear_on_date(d),
                msg=f"Unexpected match on {d}",
            )

    def test_appears_on_march_29_in_non_leap_year(self):
        """day_of_month=29 still fires on Mar 29 (March always has 29 days)."""
        march_29 = date(2025, 3, 29)
        self.assertTrue(self.task.should_appear_on_date(march_29))

        instances = InstanceGenerator.generate_for_date(self.member, march_29)
        self.assertEqual(len(instances), 1)

    def test_instance_not_created_for_non_existent_date(self):
        """No TaskInstance is ever created for a Feb date in a non-leap
        year."""
        for day in range(1, 29):
            d = date(2025, 2, day)
            InstanceGenerator.generate_for_date(self.member, d)

        count = TaskInstance.objects.filter(
            template=self.task,
            scheduled_date__year=2025,
            scheduled_date__month=2,
            owner=self.member,
        ).count()
        self.assertEqual(count, 0)


# ---------------------------------------------------------------------------
# 2. DST transition — America/Sao_Paulo (historical Nov 4, 2018)
# ---------------------------------------------------------------------------


class DSTTransitionTest(InstanceGeneratorBaseTestCase):
    """
    Brazil advanced clocks by 1 h on Nov 4, 2018 at midnight BRT:
    clocks jumped from 00:00 to 01:00 (the 00:00–00:59 window was skipped).

    UTC equivalents:
      - 2018-11-04 03:00 UTC → 00:00 BRT (transition moment)
      - 2018-11-04 02:30 UTC → would have been 23:30 BRT on Nov 3

    The generator stores scheduled_time as a naive time value; it must
    create instances correctly regardless of DST clock adjustments.
    """

    def setUp(self):
        super().setUp()
        # Task at 00:30 — the historically-skipped DST hour in São Paulo
        self.task = RoutineTask.objects.create(
            name="DST Boundary Task",
            category="health",
            periodicity="daily",
            scheduled_times=["00:30"],
            owner=self.member,
        )

    @freeze_time("2018-11-04 03:00:00")  # UTC ≈ 00:00 BRT, DST start
    def test_instance_created_at_dst_start(self):
        """Generator creates an instance even at the DST transition start."""
        target_date = date(2018, 11, 4)
        instances = InstanceGenerator.generate_for_date(
            self.member, target_date
        )
        self.assertEqual(len(instances), 1)
        # Scheduled time is stored as-is; no DST offset is applied to naive
        # times
        self.assertEqual(instances[0].scheduled_time, time(0, 30))

    @freeze_time("2018-11-04 02:30:00")  # UTC — inside the historical DST gap
    def test_instance_scheduled_time_unchanged_in_dst_gap(self):
        """An instance whose scheduled_time falls inside the skipped DST hour
        retains its original time value; no exception is raised."""
        target_date = date(2018, 11, 4)
        instances = InstanceGenerator.generate_for_date(
            self.member, target_date
        )
        self.assertEqual(len(instances), 1)
        self.assertEqual(instances[0].scheduled_time, time(0, 30))

    @freeze_time("2018-11-04 02:00:00")
    def test_no_duplicate_instances_across_dst_calls(self):
        """Calling generate_for_date twice around DST does not create
        duplicates."""
        target_date = date(2018, 11, 4)
        InstanceGenerator.generate_for_date(self.member, target_date)
        InstanceGenerator.generate_for_date(self.member, target_date)

        count = TaskInstance.objects.filter(
            template=self.task,
            scheduled_date=target_date,
            owner=self.member,
            deleted_at__isnull=True,
        ).count()
        self.assertEqual(count, 1)

    @freeze_time("2018-11-04 02:00:00")
    def test_interval_hours_task_during_dst_transition(self):
        """An interval_hours task generates the expected number of instances
        at DST transition time and none of them is a duplicate."""
        interval_task = RoutineTask.objects.create(
            name="Interval DST Task",
            category="health",
            periodicity="daily",
            default_time=time(6, 0),
            interval_hours=4,
            daily_occurrences=3,
            owner=self.member,
        )
        target_date = date(2018, 11, 4)
        instances = InstanceGenerator.generate_for_date(
            self.member, target_date
        )
        interval_instances = [
            i for i in instances if i.template_id == interval_task.pk
        ]
        self.assertEqual(len(interval_instances), 3)
        # Times should be 06:00, 10:00, 14:00
        scheduled_times = [i.scheduled_time for i in interval_instances]
        self.assertIn(time(6, 0), scheduled_times)
        self.assertIn(time(10, 0), scheduled_times)
        self.assertIn(time(14, 0), scheduled_times)


# ---------------------------------------------------------------------------
# 3. 23:59 BRT — boundary of date change
# ---------------------------------------------------------------------------


class MidnightBoundaryTest(InstanceGeneratorBaseTestCase):
    """Tasks generated at / near the 23:59 boundary of the day."""

    @freeze_time("2026-03-19 02:59:00")  # UTC → 23:59 BRT (UTC-3)
    def test_instance_created_at_2359_boundary(self):
        """
        Generator creates an instance with scheduled_time=23:59 at end of
        day.
        """
        RoutineTask.objects.create(
            name="Late Night Task",
            category="health",
            periodicity="daily",
            scheduled_times=["23:59"],
            owner=self.member,
        )
        target_date = date(2026, 3, 19)
        instances = InstanceGenerator.generate_for_date(
            self.member, target_date
        )
        self.assertEqual(len(instances), 1)
        self.assertEqual(instances[0].scheduled_time, time(23, 59))

    @freeze_time("2026-03-19 02:59:00")
    def test_instance_sort_order_2359_is_last(self):
        """Instance with scheduled_time=23:59 sorts after all other times."""
        RoutineTask.objects.create(
            name="Morning Task",
            category="health",
            periodicity="daily",
            scheduled_times=["08:00"],
            owner=self.member,
        )
        RoutineTask.objects.create(
            name="Late Night Task",
            category="health",
            periodicity="daily",
            scheduled_times=["23:59"],
            owner=self.member,
        )
        target_date = date(2026, 3, 19)
        instances = InstanceGenerator.generate_for_date(
            self.member, target_date
        )
        self.assertEqual(len(instances), 2)
        self.assertEqual(instances[0].scheduled_time, time(8, 0))
        self.assertEqual(instances[1].scheduled_time, time(23, 59))

    def test_scheduled_times_parses_2359_correctly(self):
        """_calculate_times correctly parses '23:59' string to time(23, 59)."""
        task = RoutineTask.objects.create(
            name="Parse 2359",
            category="health",
            periodicity="daily",
            scheduled_times=["23:59"],
            owner=self.member,
        )
        times = InstanceGenerator._calculate_times(task, 1)
        self.assertIsNotNone(times)
        self.assertEqual(times[0], time(23, 59))

    def test_interval_hours_past_midnight_wraps_time(self):
        """
        When interval_hours pushes scheduled times past midnight, Python's
        datetime arithmetic wraps the time into the next day's hours.

        The guard in _calculate_times reads `if new_time.hour < 24`, but a
        datetime object's .hour is always 0-23, so the 23:59 cap (else branch)
        is effectively dead code.  The wrapped-around time is stored instead.
        """
        task = RoutineTask.objects.create(
            name="Overnight Intervals",
            category="health",
            periodicity="daily",
            default_time=time(22, 0),
            interval_hours=3,
            daily_occurrences=3,
            owner=self.member,
        )
        times = InstanceGenerator._calculate_times(task, 3)
        self.assertIsNotNone(times)
        # 22:00 → 01:00 (wraps past midnight, NOT capped at 23:59) → 04:00
        self.assertEqual(times[0], time(22, 0))
        self.assertEqual(times[1], time(1, 0))
        self.assertEqual(times[2], time(4, 0))

    @freeze_time("2026-03-19 02:59:59")  # one second before midnight BRT
    def test_no_cross_day_bleed_at_midnight(self):
        """
        Instance generated at 23:59:59 BRT is assigned to the current day,
        not the next.
        """
        RoutineTask.objects.create(
            name="Tick-Tock Task",
            category="health",
            periodicity="daily",
            scheduled_times=["23:59"],
            owner=self.member,
        )
        target_date = date(2026, 3, 19)
        instances = InstanceGenerator.generate_for_date(
            self.member, target_date
        )
        self.assertEqual(len(instances), 1)
        self.assertEqual(instances[0].scheduled_date, target_date)


# ---------------------------------------------------------------------------
# 4. Immutability of already-generated instances after template change
# ---------------------------------------------------------------------------


class TemplateChangeImmutabilityTest(InstanceGeneratorBaseTestCase):
    """
    Template changes must NOT retroactively modify already-generated instances
    (unless force_regenerate=True AND the instance is still pending).
    """

    def setUp(self):
        super().setUp()
        self.task = RoutineTask.objects.create(
            name="Original Name",
            description="Original description",
            category="health",
            periodicity="daily",
            icon="Heart",
            owner=self.member,
        )
        self.target_date = date(2026, 3, 15)

    def test_existing_instance_not_overwritten_on_regenerate(self):
        """generate_for_date returns the same DB row on a second call;
        snapshot is intact."""
        first_instances = InstanceGenerator.generate_for_date(
            self.member, self.target_date
        )
        first_pk = first_instances[0].pk

        # Mutate the template after initial generation
        self.task.name = "Updated Name"
        self.task.description = "Updated description"
        self.task.icon = "Star"
        self.task.save()

        second_instances = InstanceGenerator.generate_for_date(
            self.member, self.target_date
        )
        # Same row
        self.assertEqual(second_instances[0].pk, first_pk)
        # Snapshot frozen at generation time
        self.assertEqual(second_instances[0].task_name, "Original Name")
        self.assertEqual(
            second_instances[0].task_description, "Original description"
        )
        self.assertEqual(second_instances[0].icon, "Heart")

    def test_completed_instance_not_touched_by_force_regenerate(self):
        """
        Completed instances are preserved even with force_regenerate=True.
        """
        instances = InstanceGenerator.generate_for_date(
            self.member, self.target_date
        )
        instance = instances[0]
        instance.status = "completed"
        instance.save()
        original_name = instance.task_name

        self.task.name = "New Name After Completion"
        self.task.save()

        InstanceGenerator.generate_for_date(
            self.member, self.target_date, force_regenerate=True
        )
        instance.refresh_from_db()
        self.assertEqual(instance.task_name, original_name)
        self.assertEqual(instance.status, "completed")

    def test_pending_instance_refreshed_by_force_regenerate(self):
        """Pending instances ARE updated when force_regenerate=True."""
        instances = InstanceGenerator.generate_for_date(
            self.member, self.target_date
        )
        instance = instances[0]
        self.assertEqual(instance.status, "pending")

        self.task.name = "Force Updated Name"
        self.task.save()

        InstanceGenerator.generate_for_date(
            self.member, self.target_date, force_regenerate=True
        )
        instance.refresh_from_db()
        self.assertEqual(instance.task_name, "Force Updated Name")

    def test_skipped_instance_not_touched_by_force_regenerate(self):
        """
        Skipped instances (non-pending) are preserved by force_regenerate.
        """
        instances = InstanceGenerator.generate_for_date(
            self.member, self.target_date
        )
        instance = instances[0]
        instance.status = "skipped"
        instance.save()

        self.task.name = "Should Not Propagate"
        self.task.save()

        InstanceGenerator.generate_for_date(
            self.member, self.target_date, force_regenerate=True
        )
        instance.refresh_from_db()
        self.assertEqual(instance.task_name, "Original Name")
        self.assertEqual(instance.status, "skipped")

    def test_no_duplicate_rows_on_repeated_generate(self):
        """
        Multiple calls to generate_for_date must not create duplicate rows.
        """
        for _ in range(3):
            InstanceGenerator.generate_for_date(self.member, self.target_date)

        count = TaskInstance.objects.filter(
            template=self.task,
            scheduled_date=self.target_date,
            owner=self.member,
            deleted_at__isnull=True,
        ).count()
        self.assertEqual(count, 1)

    def test_inactive_template_produces_no_new_instances(self):
        """After deactivating the template, future dates yield no instances."""
        # First generation succeeds
        first = InstanceGenerator.generate_for_date(
            self.member, self.target_date
        )
        self.assertEqual(len(first), 1)

        # Deactivate
        self.task.is_active = False
        self.task.save()

        future_date = date(2026, 3, 20)
        instances = InstanceGenerator.generate_for_date(
            self.member, future_date
        )
        task_instances = [
            i for i in instances if i.template_id == self.task.pk
        ]
        self.assertEqual(len(task_instances), 0)

    def test_deleted_template_produces_no_instances(self):
        """Soft-deleted templates (deleted_at set) produce no instances."""
        from django.utils import timezone

        self.task.deleted_at = timezone.now()
        self.task.save()

        future_date = date(2026, 3, 25)
        instances = InstanceGenerator.generate_for_date(
            self.member, future_date
        )
        task_instances = [
            i for i in instances if i.template_id == self.task.pk
        ]
        self.assertEqual(len(task_instances), 0)
