"""Every periodic task must point at a registered Celery task."""

from django.test import SimpleTestCase

from app.celery import app


class BeatScheduleTest(SimpleTestCase):
    def test_scheduled_tasks_are_registered(self) -> None:
        app.loader.import_default_modules()
        missing = {
            name: entry["task"]
            for name, entry in app.conf.beat_schedule.items()
            if entry["task"] not in app.tasks
        }
        self.assertEqual(missing, {})

    def test_intellect_badges_are_awarded_periodically(self) -> None:
        tasks = {e["task"] for e in app.conf.beat_schedule.values()}
        self.assertIn("library.tasks.award_intellect_badges_all", tasks)
