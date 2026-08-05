import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:axiom_mobile/widgets/stat_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: kDarkVariants.first.toThemeData(),
    home: Scaffold(body: child),
  );
}

void main() {
  testWidgets('renders title and value', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const StatCard(
          title: 'Saldo total',
          value: 'R\$ 1.234,00',
          icon: Icons.account_balance_wallet_rounded,
        ),
      ),
    );

    expect(find.text('Saldo total'), findsOneWidget);
    expect(find.text('R\$ 1.234,00'), findsOneWidget);
  });

  testWidgets('renders description and trend when provided', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const StatCard(
          title: 'Crédito usado',
          value: 'R\$ 500,00',
          icon: Icons.credit_card_rounded,
          accent: StatAccent.warning,
          description: 'de R\$ 1.000,00',
          trend: StatTrend(label: '+12% vs. mês anterior', isPositive: true),
          progress: 0.5,
        ),
      ),
    );

    expect(find.text('de R\$ 1.000,00'), findsOneWidget);
    expect(find.text('+12% vs. mês anterior'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
  });
}
