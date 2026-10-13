from django.core.management import call_command
from django.test import TestCase

from personal_planning.management.commands.seed_wellness_interventions import (
    INTERVENTIONS,
)
from personal_planning.models import WellnessIntervention


class SeedWellnessInterventionsTest(TestCase):
    def test_seed_is_idempotent(self):
        call_command("seed_wellness_interventions")
        call_command("seed_wellness_interventions")
        self.assertEqual(
            WellnessIntervention.objects.filter(is_global=True).count(),
            len(INTERVENTIONS),
        )
