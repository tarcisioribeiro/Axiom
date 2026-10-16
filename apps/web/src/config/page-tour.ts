// Rota → chave do tour guiado (textos em i18n: pageTour.pages.<chave>).
const EXACT: Record<string, string> = {
  '/': 'home',
  '/dashboard': 'dashboard',
  '/accounts': 'accounts',
  '/transactions': 'transactions',
  '/recurring': 'recurring',
  '/finance/rules-tags': 'rulesTags',
  '/categorization-rules': 'rulesTags',
  '/automation-rules': 'rulesTags',
  '/credit-cards': 'creditCards',
  '/credit-card-bills': 'creditCardBills',
  '/credit-card-expenses': 'creditCardExpenses',
  '/transfers': 'transfers',
  '/loans': 'loans',
  '/bills': 'bills',
  '/members': 'members',
  '/budgets': 'budgets',
  '/webhooks': 'webhooks',
  '/vaults': 'vaults',
  '/vaults/simulator': 'vaultSimulator',
  '/financial-goals': 'financialGoals',
  '/finance/agenda': 'agenda',
  '/finance/analytics': 'financeAnalytics',
  '/finance/financial-health': 'financialHealth',
  '/finance/calendar': 'calendar',
  '/finance/monthly-planner': 'monthlyPlanner',
  '/finance/spending-insights': 'spendingInsights',
  '/finance/month-comparison': 'monthComparison',
  '/finance/net-worth': 'netWorth',
  '/finance/debt-payoff': 'debtPayoff',
  '/finance/subscriptions': 'subscriptions',
  '/security/dashboard': 'securityDashboard',
  '/security/passwords': 'passwords',
  '/security/stored-cards': 'storedCards',
  '/security/stored-accounts': 'storedAccounts',
  '/security/archives': 'archives',
  '/security/activity-logs': 'activityLogs',
  '/security/health': 'vaultHealth',
  '/library/dashboard': 'libraryDashboard',
  '/library/books': 'books',
  '/library/authors': 'authors',
  '/library/publishers': 'publishers',
  '/library/courses': 'courses',
  '/library/skills': 'skills',
  '/library/knowledge-graph': 'knowledgeGraph',
  '/library/intellect-today': 'intellectToday',
  '/library/flashcards': 'flashcards',
  '/planning/dashboard': 'planningDashboard',
  '/planning/tasks-goals': 'tasksGoals',
  '/planning/routine-tasks': 'routineTasks',
  '/planning/goals': 'planningGoals',
  '/planning/daily': 'dailyChecklist',
  '/planning/today-tasks': 'dailyChecklist',
  '/planning/daily-checklist': 'dailyChecklist',
  '/planning/reflections': 'reflections',
  '/planning/workout': 'workout',
  '/planning/nutrition': 'nutrition',
  '/planning/journey': 'journey',
  '/planning/week': 'week',
  '/planning/body-metrics': 'bodyMetrics',
  '/planning/weekly-planning': 'weeklyPlanning',
  '/planning/emotional-wellness': 'emotionalWellness',
  '/agents': 'agents',
  '/settings/profile': 'profile',
};

const PATTERNS: [RegExp, string][] = [
  [/^\/bank-reconciliation\/[^/]+$/, 'bankReconciliationDetail'],
];

/** Páginas com abas (ex.: `/transactions/expenses`) não têm entrada própria em
 * `EXACT` — sobe um nível de cada vez até achar a página "pai". */
export function getTourKey(pathname: string): string | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  let current = path;
  while (current) {
    if (EXACT[current]) return EXACT[current];
    const lastSlash = current.lastIndexOf('/');
    if (lastSlash <= 0) break;
    current = current.slice(0, lastSlash);
  }
  return PATTERNS.find(([re]) => re.test(path))?.[1];
}

const hiddenKey = (tourKey: string) => `axiom-tour-hidden:${tourKey}`;

export function isTourHidden(tourKey: string): boolean {
  try {
    return localStorage.getItem(hiddenKey(tourKey)) === 'true';
  } catch {
    return false;
  }
}

export function setTourHidden(tourKey: string, hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(hiddenKey(tourKey), 'true');
    else localStorage.removeItem(hiddenKey(tourKey));
  } catch {
    // localStorage indisponível — o tour simplesmente volta a aparecer
  }
}

export const OPEN_TOUR_EVENT = 'axiom:open-tour';
