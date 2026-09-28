import 'package:axiom_mobile/models/hydration.dart';
import 'package:axiom_mobile/models/meal_type.dart';
import 'package:axiom_mobile/models/menu_option.dart';
import 'package:axiom_mobile/models/routine_task.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('formatLiters drops trailing zeros and uses comma', () {
    expect(formatLiters(3000), '3');
    expect(formatLiters(1800), '1,8');
    expect(formatLiters(2750), '2,75');
    expect(formatLiters(0), '0');
  });

  test('parses goal without target and water log from task', () {
    expect(
        HydrationGoal.fromJson({'id': null, 'daily_target_ml': null})
            .dailyTargetMl,
        isNull);
    final log = WaterLog.fromJson({
      'id': 1,
      'date': '2026-09-28',
      'time': '08:30:00',
      'amount_ml': 500,
      'from_task': true,
    });
    expect(log.amountMl, 500);
    expect(log.fromTask, isTrue);
  });

  test('routine task round-trips nutrition links', () {
    final task = RoutineTask.fromJson({
      'id': 1,
      'name': 'Água',
      'category': 'nutrition',
      'linked_meal_type': null,
      'linked_hydration_goal': 4,
    });
    expect(task.toJson()['linked_hydration_goal'], 4);
    expect(task.toJson().containsKey('linked_meal_type'), isTrue);
  });

  test('meal type round-trips default option; option parses calories', () {
    final mealType = MealType.fromJson({
      'id': 1,
      'name': 'Almoço',
      'default_menu_option': 7,
    });
    expect(mealType.toJson()['default_menu_option'], 7);
    final option = MenuOption.fromJson({
      'id': 7,
      'meal_type': 1,
      'name': 'Opção 1',
      'calories': 390.5,
    });
    expect(option.calories, 390.5);
  });
}
