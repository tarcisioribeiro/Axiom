import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:axiom_mobile/config/api_environment.dart';
import 'package:axiom_mobile/main.dart';
import 'package:axiom_mobile/providers/core_providers.dart';
import 'package:axiom_mobile/services/api_client.dart';
import 'package:axiom_mobile/services/session_controller.dart';
import 'package:axiom_mobile/theme/theme_controller.dart';

Future<Widget> buildApp() async {
  SharedPreferences.setMockInitialValues({});
  final themeController = ThemeController();
  final environmentController = ApiEnvironmentController();
  await Future.wait([themeController.load(), environmentController.load()]);
  final apiClient = ApiClient.inMemory(environmentController.current.baseUrl);
  // Starts logged out so every test lands on LoginScreen, same as before
  // this app grew a router with an authenticated shell.
  final sessionController = SessionController(isAuthenticated: false);

  return ProviderScope(
    overrides: [
      apiClientProvider.overrideWithValue(apiClient),
      themeControllerProvider.overrideWith((ref) => themeController),
      environmentControllerProvider.overrideWith(
        (ref) => environmentController,
      ),
      sessionControllerProvider.overrideWith((ref) => sessionController),
    ],
    child: const AxiomMobileApp(),
  );
}

void main() {
  testWidgets('LoginScreen renders username, password and submit button', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(await buildApp());

    expect(find.byType(Image), findsOneWidget);
    expect(
      find.widgetWithText(TextFormField, 'Usuário ou e-mail'),
      findsOneWidget,
    );
    expect(find.widgetWithText(TextFormField, 'Senha'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Entrar'), findsOneWidget);
  });

  testWidgets('shows validation errors when submitting empty fields', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(await buildApp());

    await tester.tap(find.widgetWithText(ElevatedButton, 'Entrar'));
    await tester.pump();

    expect(find.text('Informe o usuário ou e-mail'), findsOneWidget);
    expect(find.text('Informe a senha'), findsOneWidget);
  });

  testWidgets('theme picker lists Dracula (dark) and Alucard (light)', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(await buildApp());

    await tester.tap(find.byTooltip('Selecionar tema'));
    await tester.pumpAndSettle();

    expect(find.text('Alucard'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Dracula'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Dracula'), findsOneWidget);
  });

  testWidgets('environment sheet lists dev and production options', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(await buildApp());

    await tester.tap(find.byTooltip('Ambiente da API'));
    await tester.pumpAndSettle();

    expect(
      find.widgetWithText(
        RadioListTile<ApiEnvironmentType>,
        'Desenvolvimento (Docker local)',
      ),
      findsOneWidget,
    );
    expect(
      find.widgetWithText(RadioListTile<ApiEnvironmentType>, 'Produção (VPS)'),
      findsOneWidget,
    );
  });
}
