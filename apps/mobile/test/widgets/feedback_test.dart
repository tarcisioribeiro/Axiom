import 'package:axiom_mobile/services/base_service.dart';
import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:axiom_mobile/widgets/app_badge.dart';
import 'package:axiom_mobile/widgets/feedback.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: kDarkVariants.first.toThemeData(),
      home: Scaffold(body: child),
    );

void main() {
  test('describeError never leaks raw exception text', () {
    expect(
      describeError(const ApiException(400, {'detail': 'Saldo insuficiente'})),
      'Saldo insuficiente',
    );
    expect(describeError(StateError('boom')), isNot(contains('boom')));
  });

  testWidgets('ErrorState shows friendly message and retries', (tester) async {
    var retried = 0;
    await tester.pumpWidget(_wrap(ErrorState(
      error: const ApiException(500, {'detail': 'Falhou'}),
      onRetry: () => retried++,
    )));
    await tester.pumpAndSettle();
    expect(find.text('Falhou'), findsOneWidget);
    await tester.tap(find.text('Tentar novamente'));
    expect(retried, 1);
  });

  testWidgets('AppBadge renders its label', (tester) async {
    await tester
        .pumpWidget(_wrap(const AppBadge(label: 'Pago', color: Colors.green)));
    expect(find.text('Pago'), findsOneWidget);
  });
}
