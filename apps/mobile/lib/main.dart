import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'config/api_environment.dart';
import 'providers/core_providers.dart';
import 'router/app_router.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/session_controller.dart';
import 'theme/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR', null);
  runApp(const AxiomBootstrap());
}

/// Renders a minimal splash immediately instead of blocking the first frame
/// on `SharedPreferences`/`path_provider` platform-channel round trips —
/// [ThemeController.load], [ApiEnvironmentController.load],
/// [ApiClient.create] (file-backed cookie jar) and an initial `GET /me/`
/// check (so a session persisted from a previous run skips the login
/// screen) run in the background, and [AxiomMobileApp] is swapped in once
/// they resolve.
class AxiomBootstrap extends StatefulWidget {
  const AxiomBootstrap({super.key});

  @override
  State<AxiomBootstrap> createState() => _AxiomBootstrapState();
}

class _AxiomBootstrapState extends State<AxiomBootstrap> {
  late final Future<_BootstrapResult> _future = _bootstrap();

  Future<_BootstrapResult> _bootstrap() async {
    final themeController = ThemeController();
    final environmentController = ApiEnvironmentController();
    await Future.wait([themeController.load(), environmentController.load()]);

    final apiClient =
        await ApiClient.create(environmentController.current.baseUrl);

    final isAuthenticated = await AuthService(apiClient).fetchCurrentUser();
    final sessionController =
        SessionController(isAuthenticated: isAuthenticated);
    apiClient.onSessionExpired = sessionController.markLoggedOut;

    return _BootstrapResult(
      themeController: themeController,
      environmentController: environmentController,
      apiClient: apiClient,
      sessionController: sessionController,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_BootstrapResult>(
      future: _future,
      builder: (context, snapshot) {
        // Without this branch, any bootstrap failure (e.g. a platform API
        // unavailable on the current target, or the backend being
        // unreachable) left the splash spinner below on screen forever —
        // `FutureBuilder` swallows the error into `snapshot.error` instead
        // of rethrowing it, so it never surfaced anywhere.
        if (snapshot.hasError) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            home: Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Falha ao iniciar o app:\n${snapshot.error}',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          );
        }
        final result = snapshot.data;
        if (result == null) {
          return const MaterialApp(
            debugShowCheckedModeBanner: false,
            home: Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
          );
        }
        return ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(result.apiClient),
            themeControllerProvider.overrideWith(
              (ref) => result.themeController,
            ),
            environmentControllerProvider.overrideWith(
              (ref) => result.environmentController,
            ),
            sessionControllerProvider.overrideWith(
              (ref) => result.sessionController,
            ),
          ],
          child: const AxiomMobileApp(),
        );
      },
    );
  }
}

class _BootstrapResult {
  final ThemeController themeController;
  final ApiEnvironmentController environmentController;
  final ApiClient apiClient;
  final SessionController sessionController;

  const _BootstrapResult({
    required this.themeController,
    required this.environmentController,
    required this.apiClient,
    required this.sessionController,
  });
}

class AxiomMobileApp extends ConsumerStatefulWidget {
  const AxiomMobileApp({super.key});

  @override
  ConsumerState<AxiomMobileApp> createState() => _AxiomMobileAppState();
}

class _AxiomMobileAppState extends ConsumerState<AxiomMobileApp> {
  late final GoRouter _router =
      buildAppRouter(ref.read(sessionControllerProvider));

  @override
  Widget build(BuildContext context) {
    final themeController = ref.watch(themeControllerProvider);
    return MaterialApp.router(
      title: 'Axiom',
      debugShowCheckedModeBanner: false,
      theme: themeController.activeVariant.toThemeData(),
      routerConfig: _router,
    );
  }
}
