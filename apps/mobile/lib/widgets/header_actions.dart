import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/core_providers.dart';
import '../theme/theme_picker_sheet.dart';

/// Theme picker + sign-out — used as the `trailing` widget of the
/// [AppPageHeader] on each tab-root screen (mirrors the web header's
/// `ThemeToggle` and the sidebar's user-menu "Sair" item). Placed on every
/// tab root rather than once in a shell-level AppBar because several
/// sub-routes already have their own contextual AppBar with a back action,
/// and a shell-level one would stack a second toolbar above those.
class TabHeaderActions extends ConsumerWidget {
  const TabHeaderActions({super.key});

  Future<void> _logout(WidgetRef ref) async {
    await ref.read(authServiceProvider).logout();
    // Flips `SessionController.isAuthenticated` to false, which is
    // `GoRouter`'s `refreshListenable` (see `router/app_router.dart`) — the
    // redirect re-evaluates immediately and sends the user to /login.
    ref.read(sessionControllerProvider).markLoggedOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'Tema',
          icon: const Icon(Icons.palette_outlined),
          onPressed: () => showThemePickerSheet(
            context,
            ref.read(themeControllerProvider),
          ),
        ),
        IconButton(
          tooltip: 'Sair',
          icon: const Icon(Icons.logout_rounded),
          onPressed: () => _logout(ref),
        ),
      ],
    );
  }
}
