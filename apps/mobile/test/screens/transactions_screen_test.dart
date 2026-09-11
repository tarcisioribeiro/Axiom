import 'package:axiom_mobile/providers/core_providers.dart';
import 'package:axiom_mobile/screens/finance/transactions_screen.dart';
import 'package:axiom_mobile/services/api_client.dart';
import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../support/fake_dio_adapter.dart';

Widget _wrap(ApiClient client, Widget child) {
  return ProviderScope(
    overrides: [apiClientProvider.overrideWithValue(client)],
    child: MaterialApp(
      theme: kDarkVariants.first.toThemeData(),
      home: child,
    ),
  );
}

const _account = {
  'id': 1,
  'uuid': 'a',
  'account_name': 'Conta Principal',
  'account_type': 'CC',
  'institution': 'NUB',
  'balance': '1000.00',
  'minimum_balance': '0.00',
  'overdraft_limit': '0.00',
  'is_active': true,
};

void main() {
  setUpAll(() => initializeDateFormatting('pt_BR', null));

  testWidgets(
    'creating an expense sends the expected payload and closes the sheet',
    (tester) async {
      RequestOptions? createRequest;
      final client = ApiClient.inMemory('http://test');
      client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
        if (options.method == 'POST' && options.path.contains('/expenses/')) {
          createRequest = options;
          return jsonResponseBody(
            {
              'id': 1,
              'uuid': 'e1',
              'description': options.data['description'],
              'value': options.data['value'],
              'date': options.data['date'],
              'category': options.data['category'],
              'account': options.data['account'],
              'payed': options.data['payed'],
            },
            statusCode: 201,
          );
        }
        if (options.path.contains('/accounts/')) {
          return jsonResponseBody(paginatedBody([_account]));
        }
        // expenses/revenues list (before and after invalidation).
        return jsonResponseBody(paginatedBody(const []));
      });

      await tester.pumpWidget(_wrap(client, const TransactionsScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.add).first);
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Descrição'),
        'Mercado',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Valor'),
        '123.45',
      );

      await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
      await tester.pumpAndSettle();

      expect(createRequest, isNotNull);
      expect(createRequest!.data['description'], 'Mercado');
      expect(createRequest!.data['value'], 123.45);
      expect(createRequest!.data['account'], 1);
      // The sheet closes on success.
      expect(find.text('Nova despesa'), findsNothing);
    },
  );

  testWidgets(
    'shows the API validation error inline and keeps the sheet open',
    (tester) async {
      final client = ApiClient.inMemory('http://test');
      client.dio.httpClientAdapter = FakeHttpClientAdapter((options) {
        if (options.method == 'POST' && options.path.contains('/expenses/')) {
          return jsonResponseBody(
            {'detail': 'Saldo insuficiente na conta.'},
            statusCode: 400,
          );
        }
        if (options.path.contains('/accounts/')) {
          return jsonResponseBody(paginatedBody([_account]));
        }
        return jsonResponseBody(paginatedBody(const []));
      });

      await tester.pumpWidget(_wrap(client, const TransactionsScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.add).first);
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Descrição'),
        'Mercado',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Valor'),
        '50',
      );

      await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
      await tester.pumpAndSettle();

      expect(find.text('Saldo insuficiente na conta.'), findsOneWidget);
      // The sheet stays open so the user can correct/retry.
      expect(find.text('Nova despesa'), findsOneWidget);
    },
  );
}
