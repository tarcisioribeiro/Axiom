/**
 * Maps sidebar route hrefs to the dynamic `import()` of their lazy-loaded
 * page component (same specifiers used by `React.lazy()` in App.tsx).
 * Calling the loader again on hover is a no-op for the bundler/browser once
 * the chunk is cached, so it lets the chunk start downloading before the
 * user actually clicks the link instead of only starting on navigation.
 */
const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Home'),
  '/agents': () => import('@/pages/Agents'),
  '/planning/dashboard': () => import('@/pages/PersonalPlanningDashboard'),
  '/planning/journey': () => import('@/pages/Journey'),
  '/planning/tasks-goals': () => import('@/pages/TasksAndGoals'),
  '/planning/reflections': () => import('@/pages/DailyReflections'),
  '/planning/weekly-planning': () => import('@/pages/WeeklyPlanning'),
  '/planning/workout': () => import('@/pages/WorkoutPage'),
  '/planning/nutrition': () => import('@/pages/NutritionPage'),
  '/planning/body-metrics': () => import('@/pages/BodyMetrics'),
  '/planning/emotional-wellness': () => import('@/pages/EmotionalWellness'),
  '/dashboard': () => import('@/pages/Dashboard'),
  '/accounts': () => import('@/pages/Accounts'),
  '/credit-cards': () => import('@/pages/CreditCardManagement'),
  '/members': () => import('@/pages/Members'),
  '/budgets': () => import('@/pages/Budgets'),
  '/financial-goals': () => import('@/pages/FinancialGoals'),
  '/recurring': () => import('@/pages/RecurringItems'),
  '/finance/rules-tags': () => import('@/pages/RulesAndTagsPage'),
  '/transactions': () => import('@/pages/Transactions'),
  '/transfers': () => import('@/pages/Transfers'),
  '/bills': () => import('@/pages/PayablesReceivables'),
  '/vaults': () => import('@/pages/Vaults'),
  '/loans': () => import('@/pages/Loans'),
  '/bank-reconciliation': () => import('@/pages/BankReconciliation'),
  '/finance/agenda': () => import('@/pages/FinanceAgendaPage'),
  '/finance/analytics': () => import('@/pages/FinanceAnalyticsPage'),
  '/finance/financial-health': () => import('@/pages/FinancialHealthPage'),
  '/security/dashboard': () => import('@/pages/SecurityDashboard'),
  '/security/passwords': () => import('@/pages/Passwords'),
  '/security/stored-cards': () => import('@/pages/StoredCards'),
  '/security/stored-accounts': () => import('@/pages/StoredAccounts'),
  '/security/archives': () => import('@/pages/Archives'),
  '/library/dashboard': () => import('@/pages/LibraryDashboard'),
  '/library/books': () => import('@/pages/Books'),
  '/library/authors': () => import('@/pages/Authors'),
  '/library/publishers': () => import('@/pages/Publishers'),
  '/library/courses': () => import('@/pages/Courses'),
  '/library/skills': () => import('@/pages/Skills'),
  '/library/knowledge-graph': () => import('@/pages/KnowledgeGraph'),
};

const prefetched = new Set<string>();

/** Fire-and-forget prefetch of a route's lazy chunk; safe to call repeatedly. */
export function prefetchRoute(href: string): void {
  if (prefetched.has(href)) return;
  const loader = routeLoaders[href];
  if (!loader) return;
  prefetched.add(href);
  void loader().catch(() => {
    // Ignore — a failed prefetch just means the normal navigation load
    // (with its own error handling) will fetch it again.
    prefetched.delete(href);
  });
}
