import 'package:axiom_mobile/utils/choice_labels.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('of() returns the Portuguese label for a known key', () {
    expect(ChoiceLabels.of(ChoiceLabels.accountTypes, 'CC'), 'Conta Corrente');
    expect(ChoiceLabels.of(ChoiceLabels.expenseCategories, 'supermarket'),
        'Supermercado');
  });

  test('of() falls back to the raw key when unmapped', () {
    expect(ChoiceLabels.of(ChoiceLabels.accountTypes, 'unknown'), 'unknown');
  });

  test('of() falls back to an empty string for a null key', () {
    expect(ChoiceLabels.of(ChoiceLabels.accountTypes, null), '');
  });
}
