import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:axiom_mobile/widgets/confirm.dart';
import 'package:axiom_mobile/widgets/row_actions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: kDarkVariants.first.toThemeData(),
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  testWidgets('confirmDelete returns false when cancelled', (tester) async {
    late bool result;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await confirmDelete(context, title: 'Excluir item');
            },
            child: const Text('go'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(result, isFalse);
  });

  testWidgets('RowActionsMenu only deletes after confirmation', (tester) async {
    var deleted = false;
    await tester.pumpWidget(
      _wrap(RowActionsMenu(onDelete: () => deleted = true)),
    );

    await tester.tap(find.byType(RowActionsMenu));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Excluir').last);
    await tester.pumpAndSettle();
    expect(deleted, isFalse, reason: 'confirmation dialog still open');

    await tester.tap(find.text('Excluir').last);
    await tester.pumpAndSettle();
    expect(deleted, isTrue);
  });
}
