"""Força de senha: zxcvbn no save() e backfill de scores legados."""

from django.urls import reverse

from security.models import Password
from tests.test_security_coverage2 import BaseSecurityCoverageTestCase


class PasswordStrengthTest(BaseSecurityCoverageTestCase):
    def test_save_computes_zxcvbn_score(self):
        self.assertEqual(
            self._make_password(password="Tr0ub4dor&3").strength_score, 4
        )
        self.assertLessEqual(
            self._make_password(
                title="b", password="Password123!"
            ).strength_score,
            1,
        )

    def test_list_backfills_legacy_zero_scores(self):
        pw = self._make_password(password="correcthorsebatterystaple")
        Password.objects.filter(pk=pw.pk).update(strength_score=0)

        response = self.client.get(reverse("password-list-create"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["strength_score"], 4)
