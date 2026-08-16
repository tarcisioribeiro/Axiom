"""Tests for the exercise dataset catalog (ExerciseDatasetEntry) and its
propagation through Exercise -> WorkoutExercise -> WorkoutSessionExercise."""

import tempfile
from datetime import date
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import (
    Exercise,
    ExerciseDatasetEntry,
    WorkoutDay,
    WorkoutExercise,
    WorkoutPlan,
    WorkoutSession,
    WorkoutSessionExercise,
)


class BaseExerciseDatasetTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="ed_test",
            email="ed@test.com",
            password="testpass123",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="ED User",
            document_hash="e" * 64,
            phone="11999999912",
            sex="M",
            user=self.user,
        )


def _make_entry(dataset_id="0001", with_media=True, **kwargs):
    entry = ExerciseDatasetEntry.objects.create(
        dataset_id=dataset_id,
        name=kwargs.pop("name", "squat"),
        category=kwargs.pop("category", "upper legs"),
        body_part=kwargs.pop("body_part", "upper legs"),
        equipment=kwargs.pop("equipment", "body weight"),
        target=kwargs.pop("target", "quads"),
        **kwargs,
    )
    if with_media:
        # Atribui `.name` diretamente em vez de `.save()` — evita I/O real
        # de storage nestes testes, que só exercitam a lógica de
        # truthiness/URL, não o conteúdo do arquivo em si.
        entry.thumbnail.name = (
            f"personal_planning/exercise_dataset/thumbnails/{dataset_id}.jpg"
        )
        entry.gif.name = (
            f"personal_planning/exercise_dataset/gifs/{dataset_id}.gif"
        )
        entry.save()
    return entry


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


class ExerciseDatasetEntryModelTest(BaseExerciseDatasetTestCase):
    def test_create_entry(self):
        entry = _make_entry()
        self.assertEqual(entry.dataset_id, "0001")
        self.assertTrue(entry.thumbnail)
        self.assertTrue(entry.gif)

    def test_exercise_dataset_entry_fk(self):
        entry = _make_entry()
        exercise = Exercise.objects.create(
            name="Agachamento", owner=self.member, dataset_entry=entry
        )
        self.assertEqual(exercise.dataset_entry_id, entry.pk)

    def test_set_null_on_dataset_entry_delete(self):
        entry = _make_entry()
        exercise = Exercise.objects.create(
            name="Agachamento", owner=self.member, dataset_entry=entry
        )
        entry.delete()
        exercise.refresh_from_db()
        self.assertIsNone(exercise.dataset_entry_id)


# ---------------------------------------------------------------------------
# Search endpoint
# ---------------------------------------------------------------------------


class ExerciseDatasetSearchViewTest(BaseExerciseDatasetTestCase):
    def setUp(self):
        super().setUp()
        _make_entry(
            dataset_id="0001",
            name="barbell squat",
            category="upper legs",
            body_part="upper legs",
        )
        _make_entry(
            dataset_id="0002",
            name="bench press",
            category="chest",
            body_part="chest",
        )

    def test_search_by_name(self):
        url = reverse("exercise-dataset-list")
        response = self.client.get(url, {"search": "squat"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "barbell squat")

    def test_filter_by_category(self):
        url = reverse("exercise-dataset-list")
        response = self.client.get(url, {"category": "chest"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "bench press")

    def test_list_paginated_shape(self):
        url = reverse("exercise-dataset-list")
        response = self.client.get(url)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        self.assertEqual(response.data["count"], 2)

    def test_requires_authentication(self):
        self.client.credentials()
        url = reverse("exercise-dataset-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Proxy stream endpoints
# ---------------------------------------------------------------------------


class ExerciseMediaStreamViewTest(BaseExerciseDatasetTestCase):
    def setUp(self):
        super().setUp()
        self.entry = _make_entry()
        self.exercise = Exercise.objects.create(
            name="Agachamento",
            owner=self.member,
            dataset_entry=self.entry,
        )
        self.other_user = User.objects.create_user(
            username="ed_other", email="other@test.com", password="pass123"
        )
        self.other_member = Member.objects.create(
            name="Other User",
            document_hash="f" * 64,
            phone="11999999913",
            sex="F",
            user=self.other_user,
        )

    def test_gif_stream_redirects_for_owner(self):
        url = reverse("exercise-gif-stream", kwargs={"pk": self.exercise.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("Location", response)

    def test_thumbnail_stream_redirects_for_owner(self):
        url = reverse(
            "exercise-thumbnail-stream", kwargs={"pk": self.exercise.pk}
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("Location", response)

    def test_404_when_no_dataset_entry(self):
        bare_exercise = Exercise.objects.create(
            name="Sem imagem", owner=self.member
        )
        url = reverse("exercise-gif-stream", kwargs={"pk": bare_exercise.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_404_for_other_owner(self):
        exercise = Exercise.objects.create(
            name="Not Mine", owner=self.other_member, dataset_entry=self.entry
        )
        url = reverse("exercise-gif-stream", kwargs={"pk": exercise.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_dataset_gif_stream_no_ownership_required(self):
        url = reverse(
            "exercise-dataset-gif-stream", kwargs={"pk": self.entry.pk}
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)


# ---------------------------------------------------------------------------
# Serializer propagation through the FK chain
# ---------------------------------------------------------------------------


class ExerciseImagePropagationTest(BaseExerciseDatasetTestCase):
    def setUp(self):
        super().setUp()
        self.entry = _make_entry()
        self.exercise = Exercise.objects.create(
            name="Agachamento",
            owner=self.member,
            dataset_entry=self.entry,
        )
        self.plan = WorkoutPlan.objects.create(name="Plan", owner=self.member)
        self.day = WorkoutDay.objects.create(
            name="Day", plan=self.plan, owner=self.member
        )
        self.workout_exercise = WorkoutExercise.objects.create(
            name="Agachamento",
            workout_day=self.day,
            exercise=self.exercise,
            sets=3,
            reps_min=8,
            reps_max=12,
            order=1,
            owner=self.member,
        )
        self.session = WorkoutSession.objects.create(
            workout_day=self.day, date=date.today(), owner=self.member
        )
        self.session_exercise = WorkoutSessionExercise.objects.create(
            session=self.session,
            exercise=self.workout_exercise,
            exercise_name="Agachamento",
            sets_target=3,
            reps_target_min=8,
            reps_target_max=12,
            order=1,
            owner=self.member,
        )

    def test_exercise_exposes_gif_url(self):
        url = reverse("exercise-detail", kwargs={"pk": self.exercise.pk})
        response = self.client.get(url)
        self.assertIsNotNone(response.data["gif_url"])
        self.assertIsNotNone(response.data["thumbnail_url"])

    def test_workout_exercise_exposes_gif_url(self):
        url = reverse(
            "workout-exercise-detail", kwargs={"pk": self.workout_exercise.pk}
        )
        response = self.client.get(url)
        self.assertEqual(
            response.data["gif_url"],
            f"/api/v1/personal-planning/exercises/{self.exercise.pk}/gif/",
        )

    def test_session_exercise_exposes_gif_url(self):
        url = reverse(
            "workout-session-exercise-detail",
            kwargs={"pk": self.session_exercise.pk},
        )
        response = self.client.get(url)
        self.assertEqual(
            response.data["gif_url"],
            f"/api/v1/personal-planning/exercises/{self.exercise.pk}/gif/",
        )

    def test_none_when_catalog_link_missing(self):
        loose_workout_exercise = WorkoutExercise.objects.create(
            name="Avulso",
            workout_day=self.day,
            exercise=None,
            sets=3,
            reps_min=8,
            reps_max=12,
            order=2,
            owner=self.member,
        )
        url = reverse(
            "workout-exercise-detail",
            kwargs={"pk": loose_workout_exercise.pk},
        )
        response = self.client.get(url)
        self.assertIsNone(response.data["gif_url"])
        self.assertIsNone(response.data["thumbnail_url"])

    def test_none_when_exercise_has_no_dataset_entry(self):
        bare_exercise = Exercise.objects.create(
            name="Sem mídia", owner=self.member
        )
        url = reverse("exercise-detail", kwargs={"pk": bare_exercise.pk})
        response = self.client.get(url)
        self.assertIsNone(response.data["gif_url"])
        self.assertIsNone(response.data["thumbnail_url"])


# ---------------------------------------------------------------------------
# Management command
# ---------------------------------------------------------------------------


FAKE_ROWS = [
    {
        "id": "0001",
        "name": "3/4 sit-up",
        "category": "waist",
        "body_part": "waist",
        "equipment": "body weight",
        "target": "abs",
        "muscle_group": "hip flexors",
        "secondary_muscles": ["hip flexors", "lower back"],
        "media_id": "abc123",
        "attribution": "© Gym visual",
        "image": "images/0001-abc.jpg",
        "gif_url": "videos/0001-abc.gif",
    },
    {
        "id": "0002",
        "name": "45 side bend",
        "category": "waist",
        "body_part": "waist",
        "equipment": "body weight",
        "target": "abs",
        "muscle_group": "obliques",
        "secondary_muscles": [],
        "media_id": "def456",
        "attribution": "© Gym visual",
        "image": "images/0002-def.jpg",
        "gif_url": "videos/0002-def.gif",
    },
]


def _mock_requests_get(url, timeout=30):
    response = Mock()
    response.raise_for_status = Mock()
    if url.endswith("exercises.json"):
        response.json = Mock(return_value=FAKE_ROWS)
    else:
        response.content = b"fake-bytes"
    return response


_REQUESTS_GET_TARGET = (
    "personal_planning.management.commands"
    ".import_exercise_dataset.requests.get"
)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="axiom-test-media-"))
class ImportExerciseDatasetCommandTest(APITestCase):
    """Usa um MEDIA_ROOT temporário — o comando grava mídia de verdade via
    FileField.save(), então precisa de um diretório gravável (diferente
    dos outros testes deste arquivo, que só testam truthiness/URL e por
    isso atribuem `.name` diretamente sem I/O)."""

    @patch(_REQUESTS_GET_TARGET, side_effect=_mock_requests_get)
    def test_import_creates_entries(self, mock_get):
        call_command("import_exercise_dataset")
        self.assertEqual(ExerciseDatasetEntry.objects.count(), 2)
        entry = ExerciseDatasetEntry.objects.get(dataset_id="0001")
        self.assertTrue(entry.thumbnail)
        self.assertTrue(entry.gif)

    @patch(_REQUESTS_GET_TARGET, side_effect=_mock_requests_get)
    def test_dry_run_writes_nothing(self, mock_get):
        call_command("import_exercise_dataset", dry_run=True)
        self.assertEqual(ExerciseDatasetEntry.objects.count(), 0)

    @patch(_REQUESTS_GET_TARGET, side_effect=_mock_requests_get)
    def test_limit_truncates(self, mock_get):
        call_command("import_exercise_dataset", limit=1)
        self.assertEqual(ExerciseDatasetEntry.objects.count(), 1)

    @patch(_REQUESTS_GET_TARGET, side_effect=_mock_requests_get)
    def test_rerun_is_idempotent_and_skips_existing_media(self, mock_get):
        call_command("import_exercise_dataset")
        first_call_count = mock_get.call_count
        call_command("import_exercise_dataset")
        self.assertEqual(ExerciseDatasetEntry.objects.count(), 2)
        # Segunda execução: só 1 chamada por linha (o JSON) — a mídia já
        # está presente e não deve ser rebaixada.
        self.assertEqual(mock_get.call_count, first_call_count + 1)
