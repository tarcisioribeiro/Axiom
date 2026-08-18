import 'package:axiom_mobile/widgets/loading_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('list variant renders fine as the sole body of a screen', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: LoadingState(variant: LoadingVariant.list)),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'list variant renders fine nested as an item inside an outer ListView '
    '(regression: a ListView here used to throw "Vertical viewport was '
    'given unbounded height" since Dashboard/CreditCardDetail/'
    'CreditCardBillDetail all render this as one item of their own '
    'top-level ListView while a section is loading)',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: const [
                Text('Some section above'),
                LoadingState(variant: LoadingVariant.list, itemCount: 3),
                Text('Some section below'),
              ],
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Some section above'), findsOneWidget);
      expect(find.text('Some section below'), findsOneWidget);
    },
  );

  testWidgets('stats variant renders fine nested inside an outer ListView', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ListView(
            children: const [LoadingState(variant: LoadingVariant.stats)],
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
