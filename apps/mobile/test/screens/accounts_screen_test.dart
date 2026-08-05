import 'package:axiom_mobile/providers/core_providers.dart';
import 'package:axiom_mobile/screens/finance/accounts_screen.dart';
import 'package:axiom_mobile/services/api_client.dart';
import 'package:axiom_mobile/theme/app_themes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

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

void main() {
  testWidgets('shows the empty state when there are no accounts', (
    tester,
  ) async {
    final client = ApiClient.inMemory('http://test');
    client.dio.httpClientAdapter = FakeHttpClientAdapter(
      (options) => jsonResponseBody(paginatedBody(const [])),
    );

    await tester.pumpWidget(_wrap(client, const AccountsScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Nenhuma conta cadastrada'), findsOneWidget);
  });

  testWidgets('renders a card per account returned by the API', (
    tester,
  ) async {
    final client = ApiClient.inMemory('http://test');
    client.dio.httpClientAdapter = FakeHttpClientAdapter(
      (options) => jsonResponseBody(
        paginatedBody([
          {
            'id': 1,
            'uuid': 'a',
            'account_name': 'Conta Principal',
            'account_type': 'CC',
            'institution': 'NUB',
            'balance': '1500.00',
            'minimum_balance': '0.00',
            'overdraft_limit': '0.00',
            'is_active': true,
          },
        ]),
      ),
    );

    await tester.pumpWidget(_wrap(client, const AccountsScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Conta Principal'), findsOneWidget);
    expect(find.textContaining('Nubank'), findsOneWidget);
  });
}
