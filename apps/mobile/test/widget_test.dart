import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:axiom_mobile/main.dart';

void main() {
  testWidgets('LoginScreen renders email, password and submit button', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const AxiomMobileApp());

    expect(find.text('Axiom'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'E-mail'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Senha'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Entrar'), findsOneWidget);
  });

  testWidgets('shows validation errors when submitting empty fields', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const AxiomMobileApp());

    await tester.tap(find.widgetWithText(ElevatedButton, 'Entrar'));
    await tester.pump();

    expect(find.text('Informe o e-mail'), findsOneWidget);
    expect(find.text('Informe a senha'), findsOneWidget);
  });
}
