import 'package:go_router/go_router.dart';

import '../screens/agents/agents_screen.dart';
import '../screens/finance/accounts_screen.dart';
import '../screens/finance/credit_card_bill_detail_screen.dart';
import '../screens/finance/credit_card_detail_screen.dart';
import '../screens/finance/credit_cards_screen.dart';
import '../screens/finance/dashboard_screen.dart';
import '../screens/finance/financial_calendar_screen.dart';
import '../screens/finance/financial_goals_screen.dart';
import '../screens/finance/loans_screen.dart';
import '../screens/finance/members_screen.dart';
import '../screens/finance/payables_receivables_screen.dart';
import '../screens/finance/transactions_screen.dart';
import '../screens/finance/transfers_screen.dart';
import '../screens/finance/vaults_screen.dart';
import '../screens/login_screen.dart';
import '../screens/planning/nutrition_screen.dart';
import '../screens/planning/planning_dashboard_screen.dart';
import '../screens/planning/tasks_goals_screen.dart';
import '../screens/planning/wellness_screen.dart';
import '../screens/planning/workout_screen.dart';
import '../screens/security/security_screen.dart';
import '../screens/shell/app_shell.dart';
import '../services/session_controller.dart';

/// Builds the app's `GoRouter`. A single `/login` route sits outside the
/// authenticated shell; everything else lives in a
/// `StatefulShellRoute.indexedStack` with one branch per bottom-nav tab
/// (Finanças/Planejamento/Agente IA/Segurança), mirroring the top-level
/// modules of the web sidebar (`config/nav-config.ts`). Each branch keeps
/// its own `Navigator`, so switching tabs preserves scroll position and
/// screen state instead of rebuilding from scratch.
GoRouter buildAppRouter(SessionController sessionController) {
  return GoRouter(
    initialLocation: sessionController.isAuthenticated ? '/finance' : '/login',
    refreshListenable: sessionController,
    redirect: (context, state) {
      final authenticated = sessionController.isAuthenticated;
      final isLoginRoute = state.matchedLocation == '/login';
      if (!authenticated) return isLoginRoute ? null : '/login';
      if (authenticated && isLoginRoute) return '/finance';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/finance',
                builder: (context, state) => const DashboardScreen(),
                routes: [
                  GoRoute(
                    path: 'accounts',
                    builder: (context, state) => const AccountsScreen(),
                  ),
                  GoRoute(
                    path: 'transactions',
                    builder: (context, state) => const TransactionsScreen(),
                  ),
                  GoRoute(
                    path: 'credit-cards',
                    builder: (context, state) => const CreditCardsScreen(),
                    routes: [
                      GoRoute(
                        path: ':cardId',
                        builder: (context, state) => CreditCardDetailScreen(
                          cardId: int.parse(state.pathParameters['cardId']!),
                        ),
                        routes: [
                          GoRoute(
                            path: 'bills/:billId',
                            builder: (context, state) =>
                                CreditCardBillDetailScreen(
                              billId:
                                  int.parse(state.pathParameters['billId']!),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'transfers',
                    builder: (context, state) => const TransfersScreen(),
                  ),
                  GoRoute(
                    path: 'payables-receivables',
                    builder: (context, state) =>
                        const PayablesReceivablesScreen(),
                  ),
                  GoRoute(
                    path: 'loans',
                    builder: (context, state) => const LoansScreen(),
                  ),
                  GoRoute(
                    path: 'calendar',
                    builder: (context, state) =>
                        const FinancialCalendarScreen(),
                  ),
                  GoRoute(
                    path: 'vaults',
                    builder: (context, state) => const VaultsScreen(),
                  ),
                  GoRoute(
                    path: 'goals',
                    builder: (context, state) => const FinancialGoalsScreen(),
                  ),
                  GoRoute(
                    path: 'members',
                    builder: (context, state) => const MembersScreen(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/planning',
                builder: (context, state) => const PlanningDashboardScreen(),
                routes: [
                  GoRoute(
                    path: 'tasks-goals',
                    builder: (context, state) => const TasksGoalsScreen(),
                  ),
                  GoRoute(
                    path: 'workout',
                    builder: (context, state) => const WorkoutScreen(),
                  ),
                  GoRoute(
                    path: 'nutrition',
                    builder: (context, state) => const NutritionScreen(),
                  ),
                  GoRoute(
                    path: 'wellness',
                    builder: (context, state) => const WellnessScreen(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/agents',
                builder: (context, state) => const AgentsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/security',
                builder: (context, state) => const SecurityScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
