import 'package:axiom_mobile/models/habit_heatmap.dart';
import 'package:axiom_mobile/models/vault.dart';
import 'package:axiom_mobile/models/workout_exercise.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final d = DateTime(2026, 1, 1);

  test('HeatmapDay.ratio: 0 when nothing scheduled, clamped otherwise', () {
    expect(
      HeatmapDay(date: d, completed: 0, expected: 0, isScheduled: false).ratio,
      0,
    );
    expect(
      HeatmapDay(date: d, completed: 1, expected: 2, isScheduled: true).ratio,
      0.5,
    );
    expect(
      HeatmapDay(date: d, completed: 5, expected: 2, isScheduled: true).ratio,
      1,
    );
  });

  test('HabitHeatmap.fromJson reads the data list', () {
    final h = HabitHeatmap.fromJson({
      'year': 2026,
      'task_name': null,
      'data': [
        {
          'date': '2026-01-01',
          'completed': 1,
          'expected': 1,
          'is_scheduled': true,
        },
      ],
    });
    expect(h.year, 2026);
    expect(h.days.single.ratio, 1);
  });

  test('WorkoutExercise.repsLabel formats a range or a single value', () {
    WorkoutExercise ex({int? min, int? max}) => WorkoutExercise(
          id: 1,
          uuid: 'u',
          workoutDay: 1,
          name: 'Supino',
          sets: 4,
          order: 0,
          repsMin: min,
          repsMax: max,
        );
    expect(ex(min: 8, max: 12).repsLabel, '8–12 reps');
    expect(ex(min: 10, max: 10).repsLabel, '10 reps');
    expect(ex().repsLabel, '');
  });

  test('Vault.principal subtracts accumulated yield', () {
    final v = Vault.fromJson({
      'id': 1,
      'uuid': 'u',
      'description': 'Reserva',
      'account': 2,
      'current_balance': '1050.00',
      'accumulated_yield': '50.00',
      'annual_yield_rate': '0.12',
      'annual_yield_rate_percentage': 12.0,
      'pending_yield': '1.23',
      'total_deposits': '1000',
      'total_withdrawals': '0',
      'is_active': true,
    });
    expect(v.principal, 1000);
    expect(v.pendingYield, closeTo(1.23, 1e-9));
  });
}
