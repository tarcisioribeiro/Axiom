"""Tests for workout and nutrition endpoints in personal_planning."""

from datetime import date

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Member
from personal_planning.models import (
    Food,
    MealLog,
    MealType,
    MenuOption,
    MenuOptionIngredient,
    WorkoutDay,
    WorkoutExercise,
    WorkoutPlan,
    WorkoutSession,
    WorkoutSessionExercise,
)


class BaseWorkoutNutritionTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="wn_test",
            email="wn@test.com",
            password="testpass123",
        )
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )
        self.member = Member.objects.create(
            name="WN User",
            document_hash="w" * 64,
            phone="11999999911",
            sex="M",
            user=self.user,
        )


# ---------------------------------------------------------------------------
# Workout Plans
# ---------------------------------------------------------------------------


class WorkoutPlanViewTest(BaseWorkoutNutritionTestCase):
    def _plan_data(self):
        return {"name": "Plano A", "owner": self.member.pk, "is_active": True}

    def test_list_workout_plans(self):
        url = reverse("workout-plan-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_workout_plan(self):
        url = reverse("workout-plan-list-create")
        response = self.client.post(url, self._plan_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Plano A")

    def test_retrieve_workout_plan(self):
        plan = WorkoutPlan.objects.create(
            name="Retrieve Me", owner=self.member
        )
        url = reverse("workout-plan-detail", kwargs={"pk": plan.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_workout_plan(self):
        plan = WorkoutPlan.objects.create(name="Old Name", owner=self.member)
        url = reverse("workout-plan-detail", kwargs={"pk": plan.pk})
        response = self.client.patch(url, {"name": "New Name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "New Name")

    def test_delete_workout_plan(self):
        plan = WorkoutPlan.objects.create(name="Delete Me", owner=self.member)
        url = reverse("workout-plan-detail", kwargs={"pk": plan.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Workout Days
# ---------------------------------------------------------------------------


class WorkoutDayViewTest(BaseWorkoutNutritionTestCase):
    def setUp(self):
        super().setUp()
        self.plan = WorkoutPlan.objects.create(
            name="Test Plan", owner=self.member
        )

    def _day_data(self):
        return {
            "name": "Dia A",
            "plan": self.plan.pk,
            "owner": self.member.pk,
        }

    def test_list_workout_days(self):
        url = reverse("workout-day-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_workout_day(self):
        url = reverse("workout-day-list-create")
        response = self.client.post(url, self._day_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_workout_day(self):
        day = WorkoutDay.objects.create(
            name="Day X", plan=self.plan, owner=self.member
        )
        url = reverse("workout-day-detail", kwargs={"pk": day.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_workout_day(self):
        day = WorkoutDay.objects.create(
            name="Old Day", plan=self.plan, owner=self.member
        )
        url = reverse("workout-day-detail", kwargs={"pk": day.pk})
        response = self.client.patch(url, {"name": "New Day"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_workout_day(self):
        day = WorkoutDay.objects.create(
            name="Del Day", plan=self.plan, owner=self.member
        )
        url = reverse("workout-day-detail", kwargs={"pk": day.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Workout Exercises
# ---------------------------------------------------------------------------


class WorkoutExerciseViewTest(BaseWorkoutNutritionTestCase):
    def setUp(self):
        super().setUp()
        self.plan = WorkoutPlan.objects.create(name="Plan", owner=self.member)
        self.day = WorkoutDay.objects.create(
            name="Day", plan=self.plan, owner=self.member
        )

    def _exercise_data(self):
        return {
            "name": "Supino",
            "workout_day": self.day.pk,
            "sets": 3,
            "reps_min": 8,
            "reps_max": 12,
            "order": 1,
            "owner": self.member.pk,
        }

    def test_list_workout_exercises(self):
        url = reverse("workout-exercise-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_workout_exercise(self):
        url = reverse("workout-exercise-list-create")
        response = self.client.post(url, self._exercise_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Supino")

    def test_retrieve_workout_exercise(self):
        ex = WorkoutExercise.objects.create(
            name="Agachamento",
            workout_day=self.day,
            sets=4,
            reps_min=6,
            reps_max=10,
            order=1,
            owner=self.member,
        )
        url = reverse("workout-exercise-detail", kwargs={"pk": ex.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_workout_exercise(self):
        ex = WorkoutExercise.objects.create(
            name="Del Ex",
            workout_day=self.day,
            sets=3,
            reps_min=8,
            reps_max=12,
            order=2,
            owner=self.member,
        )
        url = reverse("workout-exercise-detail", kwargs={"pk": ex.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Workout Sessions
# ---------------------------------------------------------------------------


class WorkoutSessionViewTest(BaseWorkoutNutritionTestCase):
    def setUp(self):
        super().setUp()
        self.plan = WorkoutPlan.objects.create(name="Plan", owner=self.member)
        self.day = WorkoutDay.objects.create(
            name="Day", plan=self.plan, owner=self.member
        )

    def _session_data(self):
        return {
            "workout_day": self.day.pk,
            "date": str(date.today()),
            "owner": self.member.pk,
        }

    def test_list_workout_sessions(self):
        url = reverse("workout-session-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_workout_session(self):
        url = reverse("workout-session-list-create")
        response = self.client.post(url, self._session_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_workout_session(self):
        session = WorkoutSession.objects.create(
            workout_day=self.day, date=date.today(), owner=self.member
        )
        url = reverse("workout-session-detail", kwargs={"pk": session.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_workout_session(self):
        session = WorkoutSession.objects.create(
            workout_day=self.day, date=date.today(), owner=self.member
        )
        url = reverse("workout-session-detail", kwargs={"pk": session.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Workout Session Exercises & Sets
# ---------------------------------------------------------------------------


class WorkoutSessionExerciseViewTest(BaseWorkoutNutritionTestCase):
    def setUp(self):
        super().setUp()
        self.plan = WorkoutPlan.objects.create(name="Plan", owner=self.member)
        self.day = WorkoutDay.objects.create(
            name="Day", plan=self.plan, owner=self.member
        )
        self.session = WorkoutSession.objects.create(
            workout_day=self.day, date=date.today(), owner=self.member
        )

    def test_list_session_exercises(self):
        url = reverse("workout-session-exercise-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_session_exercise(self):
        url = reverse("workout-session-exercise-list-create")
        data = {
            "session": self.session.pk,
            "exercise_name": "Remada",
            "sets_target": 3,
            "reps_target_min": 8,
            "reps_target_max": 12,
            "order": 1,
            "owner": self.member.pk,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_session_sets(self):
        url = reverse("workout-session-set-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_session_set(self):
        ex = WorkoutSessionExercise.objects.create(
            session=self.session,
            exercise_name="Supino",
            sets_target=3,
            reps_target_min=8,
            reps_target_max=12,
            order=1,
            owner=self.member,
        )
        url = reverse("workout-session-set-list-create")
        data = {
            "session_exercise": ex.pk,
            "set_number": 1,
            "load": "80.0",
            "load_unit": "kg",
            "reps_done": 10,
            "completed": True,
            "owner": self.member.pk,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_delete_session_exercise(self):
        ex = WorkoutSessionExercise.objects.create(
            session=self.session,
            exercise_name="Del Ex",
            sets_target=3,
            reps_target_min=8,
            reps_target_max=12,
            order=2,
            owner=self.member,
        )
        url = reverse("workout-session-exercise-detail", kwargs={"pk": ex.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Foods
# ---------------------------------------------------------------------------


class FoodViewTest(BaseWorkoutNutritionTestCase):
    def _food_data(self):
        return {"name": "Frango", "owner": self.member.pk}

    def test_list_foods(self):
        url = reverse("food-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_food(self):
        url = reverse("food-list-create")
        response = self.client.post(url, self._food_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Frango")

    def test_retrieve_food(self):
        food = Food.objects.create(name="Arroz", owner=self.member)
        url = reverse("food-detail", kwargs={"pk": food.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_food(self):
        food = Food.objects.create(name="Old Food", owner=self.member)
        url = reverse("food-detail", kwargs={"pk": food.pk})
        response = self.client.patch(url, {"name": "New Food"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "New Food")

    def test_delete_food(self):
        food = Food.objects.create(name="Del Food", owner=self.member)
        url = reverse("food-detail", kwargs={"pk": food.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Meal Types
# ---------------------------------------------------------------------------


class MealTypeViewTest(BaseWorkoutNutritionTestCase):
    def _meal_type_data(self):
        return {
            "name": "Café da manhã",
            "order": 1,
            "is_active": True,
            "owner": self.member.pk,
        }

    def test_list_meal_types(self):
        url = reverse("meal-type-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_meal_type(self):
        url = reverse("meal-type-list-create")
        response = self.client.post(url, self._meal_type_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_meal_type(self):
        mt = MealType.objects.create(name="Almoço", order=2, owner=self.member)
        url = reverse("meal-type-detail", kwargs={"pk": mt.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_meal_type(self):
        mt = MealType.objects.create(
            name="Old Type", order=3, owner=self.member
        )
        url = reverse("meal-type-detail", kwargs={"pk": mt.pk})
        response = self.client.patch(url, {"name": "New Type"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_meal_type(self):
        mt = MealType.objects.create(
            name="Del Type", order=4, owner=self.member
        )
        url = reverse("meal-type-detail", kwargs={"pk": mt.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Menu Options & Ingredients
# ---------------------------------------------------------------------------


class MenuOptionViewTest(BaseWorkoutNutritionTestCase):
    def setUp(self):
        super().setUp()
        self.meal_type = MealType.objects.create(
            name="Almoço", order=1, owner=self.member
        )
        self.food = Food.objects.create(name="Arroz", owner=self.member)

    def test_list_menu_options(self):
        url = reverse("menu-option-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_menu_option(self):
        url = reverse("menu-option-list-create")
        data = {
            "name": "Prato 1",
            "meal_type": self.meal_type.pk,
            "order": 1,
            "owner": self.member.pk,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_menu_option(self):
        opt = MenuOption.objects.create(
            name="Option A",
            meal_type=self.meal_type,
            order=1,
            owner=self.member,
        )
        url = reverse("menu-option-detail", kwargs={"pk": opt.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_menu_option(self):
        opt = MenuOption.objects.create(
            name="Del Opt",
            meal_type=self.meal_type,
            order=2,
            owner=self.member,
        )
        url = reverse("menu-option-detail", kwargs={"pk": opt.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_list_menu_option_ingredients(self):
        url = reverse("menu-option-ingredient-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_menu_option_ingredient(self):
        opt = MenuOption.objects.create(
            name="Prato 2",
            meal_type=self.meal_type,
            order=3,
            owner=self.member,
        )
        url = reverse("menu-option-ingredient-list-create")
        data = {
            "menu_option": opt.pk,
            "food": self.food.pk,
            "unit": "g",
            "order": 1,
            "owner": self.member.pk,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_delete_menu_option_ingredient(self):
        opt = MenuOption.objects.create(
            name="Prato 3",
            meal_type=self.meal_type,
            order=4,
            owner=self.member,
        )
        ing = MenuOptionIngredient.objects.create(
            menu_option=opt,
            food=self.food,
            unit="ml",
            order=1,
            owner=self.member,
        )
        url = reverse("menu-option-ingredient-detail", kwargs={"pk": ing.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Meal Logs
# ---------------------------------------------------------------------------


class MealLogViewTest(BaseWorkoutNutritionTestCase):
    def setUp(self):
        super().setUp()
        self.meal_type = MealType.objects.create(
            name="Jantar", order=3, owner=self.member
        )

    def _log_data(self):
        return {
            "meal_type": self.meal_type.pk,
            "date": str(date.today()),
            "owner": self.member.pk,
        }

    def test_list_meal_logs(self):
        url = reverse("meal-log-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_meal_log(self):
        url = reverse("meal-log-list-create")
        response = self.client.post(url, self._log_data())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_retrieve_meal_log(self):
        log = MealLog.objects.create(
            meal_type=self.meal_type, date=date.today(), owner=self.member
        )
        url = reverse("meal-log-detail", kwargs={"pk": log.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_meal_log(self):
        log = MealLog.objects.create(
            meal_type=self.meal_type, date=date.today(), owner=self.member
        )
        url = reverse("meal-log-detail", kwargs={"pk": log.pk})
        response = self.client.patch(url, {"notes": "Updated notes"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_meal_log(self):
        log = MealLog.objects.create(
            meal_type=self.meal_type, date=date.today(), owner=self.member
        )
        url = reverse("meal-log-detail", kwargs={"pk": log.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
