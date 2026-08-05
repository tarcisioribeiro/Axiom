import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bottom-navigation shell wrapping the 4 authenticated branches
/// (Finanças/Planejamento/Agente IA/Segurança), mirroring the top-level
/// modules of the web app's sidebar (`config/nav-config.ts`). Each branch
/// keeps its own navigation stack alive via `StatefulShellRoute.indexedStack`
/// (see `router/app_router.dart`), so switching tabs doesn't lose scroll
/// position or re-trigger data fetches — the mobile equivalent of the web
/// app's TanStack Query cache surviving a route change.
///
/// Deliberately has no `AppBar` of its own: several sub-routes (credit card
/// detail, the agent chat view, etc.) already have their own contextual
/// `AppBar` with a back action, and stacking a shell-level one above those
/// would double up the toolbar. The logout action instead lives on each
/// tab-root screen's [AppPageHeader] via [LogoutButton].
class AppShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const AppShell({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Finanças',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Planejamento',
          ),
          NavigationDestination(
            icon: Icon(Icons.smart_toy_outlined),
            selectedIcon: Icon(Icons.smart_toy),
            label: 'Agente IA',
          ),
          NavigationDestination(
            icon: Icon(Icons.shield_outlined),
            selectedIcon: Icon(Icons.shield),
            label: 'Segurança',
          ),
        ],
      ),
    );
  }
}
