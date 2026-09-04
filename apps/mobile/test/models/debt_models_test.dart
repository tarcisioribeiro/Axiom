import 'package:axiom_mobile/models/payable.dart';
import 'package:axiom_mobile/models/receivable.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Payable.fromJson parses decimals and derives progress', () {
    final p = Payable.fromJson({
      'id': 1,
      'uuid': 'u',
      'description': 'Dentista',
      'value': '400.00',
      'paid_value': '100.00',
      'remaining_value': '300.00',
      'date': '2026-01-10',
      'due_date': '2026-02-10',
      'category': 'health and care',
      'status': 'active',
      'status_display': 'Ativo',
    });

    expect(p.value, 400);
    expect(p.paidValue, 100);
    expect(p.remainingValue, 300);
    expect(p.progress, closeTo(0.25, 1e-9));
    expect(p.dueDate, DateTime(2026, 2, 10));
  });

  test('Receivable.progress clamps and handles zero total', () {
    final r = Receivable.fromJson({
      'id': 2,
      'uuid': 'u',
      'description': 'Honorários',
      'value': '0',
      'received_value': '0',
      'remaining_value': '0',
      'date': '2026-01-10',
      'category': 'income',
      'status': 'active',
    });

    expect(r.progress, 0);
    expect(r.dueDate, isNull);
  });
}
