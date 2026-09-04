import 'dart:convert';

import 'package:axiom_mobile/models/installment.dart';
import 'package:axiom_mobile/models/member.dart';
import 'package:axiom_mobile/models/wellness.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Installment.settled maps payed OR received', () {
    final paid = Installment.fromJson({
      'id': 1,
      'installment_number': 2,
      'value': '100.00',
      'due_date': '2026-03-01',
      'payed': true,
    });
    expect(paid.settled, isTrue);
    expect(paid.number, 2);

    final received = Installment.fromJson({
      'id': 2,
      'installment_number': 1,
      'value': '50',
      'received': true,
    });
    expect(received.settled, isTrue);
    expect(received.dueDate, isNull);

    final open = Installment.fromJson({
      'id': 3,
      'installment_number': 3,
      'value': '10',
      'payed': false,
    });
    expect(open.settled, isFalse);
  });

  test('Member.toJson includes document only when provided', () {
    const m = Member(
      id: 0,
      uuid: '',
      name: 'Fulano',
      phone: '11999',
      sex: 'M',
      isCreditor: false,
      isBenefited: true,
      active: true,
    );
    expect(m.toJson()['document'], isNull);
    expect(m.toJson(document: '123')['document'], '123');
    expect(m.toJson()['is_benefited'], true);
  });

  test('CrisisAiResponse.tryParse reads the LLM JSON shape', () {
    final raw = jsonEncode({
      'validation': 'Você não está sozinho.',
      'explanation': 'O impulso pode vir do tédio.',
      'action_plan': {
        '5min': ['beber água', 'respirar'],
        '10min': ['caminhar'],
      },
      'affirmation': 'Você consegue.',
    });
    final ai = CrisisAiResponse.tryParse(jsonDecode(raw));
    expect(ai, isNotNull);
    expect(ai!.actionPlan['5min'], ['beber água', 'respirar']);
    expect(ai.affirmation, 'Você consegue.');
    expect(CrisisAiResponse.tryParse('not a map'), isNull);
  });

  test('WellnessDashboard.fromJson flattens nested groups', () {
    final d = WellnessDashboard.fromJson({
      'self_esteem': {'current_score': 22, 'week_avg': 21.5},
      'emotional': {'avg_anxiety': 4.2, 'checkins_this_week': 3},
      'impulses': {'count_this_week': 2, 'resolved_this_week': 1},
      'interventions': {'completed_this_week': 5},
    });
    expect(d.selfEsteemScore, 22);
    expect(d.avgAnxiety, 4.2);
    expect(d.checkinsThisWeek, 3);
    expect(d.impulsesResolvedThisWeek, 1);
    expect(d.interventionsThisWeek, 5);
  });
}
