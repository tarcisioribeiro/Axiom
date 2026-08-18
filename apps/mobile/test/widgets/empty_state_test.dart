import 'package:axiom_mobile/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders title and message', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EmptyState(
            icon: Icons.inbox_outlined,
            title: 'Nada por aqui',
            message: 'Toque em + para começar.',
          ),
        ),
      ),
    );

    expect(find.text('Nada por aqui'), findsOneWidget);
    expect(find.text('Toque em + para começar.'), findsOneWidget);
    expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);
  });

  testWidgets('action button invokes callback when tapped', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EmptyState(
            icon: Icons.inbox_outlined,
            title: 'Nada por aqui',
            actionLabel: 'Adicionar',
            onAction: () => tapped = true,
          ),
        ),
      ),
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Adicionar'));
    await tester.pump();

    expect(tapped, isTrue);
  });

  testWidgets('omits action button when no callback is given', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EmptyState(icon: Icons.inbox_outlined, title: 'Nada por aqui'),
        ),
      ),
    );

    expect(find.byType(FilledButton), findsNothing);
  });
}
