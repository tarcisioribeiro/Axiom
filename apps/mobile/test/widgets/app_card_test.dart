import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:axiom_mobile/widgets/app_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: kDarkVariants.first.toThemeData(),
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('renders its child', (tester) async {
    await tester.pumpWidget(_wrap(const AppCard(child: Text('conteúdo'))));
    expect(find.text('conteúdo'), findsOneWidget);
  });

  testWidgets('invokes onTap', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(AppCard(onTap: () => taps++, child: const Text('toque'))),
    );
    await tester.tap(find.text('toque'));
    expect(taps, 1);
  });

  testWidgets('draws an accent strip when accentColor is set', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const AppCard(
          accentColor: Color(0xFFFF0000),
          child: Text('com acento'),
        ),
      ),
    );
    final strips = tester.widgetList<Container>(find.byType(Container)).where(
          (c) => c.color == const Color(0xFFFF0000),
        );
    expect(strips, isNotEmpty);
  });
}
