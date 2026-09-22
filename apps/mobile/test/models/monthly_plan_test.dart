import 'package:axiom_mobile/models/monthly_plan.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
      'parses summary incl. already_paid/already_received and round-trips plan',
      () {
    final s = MonthlyPlanSummary.fromJson({
      'plan': {
        'id': 1,
        'month': 9,
        'year': 2026,
        'applied_at': null,
        'extra_revenues': [
          {'description': 'Bônus', 'value': '100.00', 'category': 'income'}
        ],
        'fixed_expense_overrides': {
          '7': {'enabled': false, 'value': null}
        },
      },
      'fixed_revenues': [
        {
          'id': 2,
          'description': 'Salário',
          'default_value': '5000.00',
          'due_day': 5,
          'account_name': 'CC',
          'already_received': true
        }
      ],
      'fixed_expenses': [
        {
          'id': 7,
          'description': 'Netflix',
          'default_value': '40.00',
          'due_day': 10,
          'credit_card_name': 'Nubank',
          'already_paid': true,
          'already_posted': true
        }
      ],
      'credit_card_bills': [],
      'existing_budgets': [
        {'category': 'food and drink', 'limit_amount': '800.00'}
      ],
      'budget_suggestions': [],
      'actual': {'revenues': '10', 'expenses': '5'},
    });
    expect(s.fixedRevenues.single.settled, isTrue);
    expect(s.fixedExpenses.single.onCard, isTrue);
    expect(s.fixedExpenses.single.settled, isTrue);
    expect(s.existingBudgets['food and drink'], 800);
    final json = s.plan.toJson();
    expect(json['fixed_expense_overrides']['7']['enabled'], false);
    expect(json['extra_revenues'][0]['value'], '100.00');
  });
}
