/**
 * Mapa rota → tela do controle de acesso por tela (chaves de
 * `apps/api/admin_panel/screens.py`). Menu, paleta, Home e o guarda de rota
 * usam o mesmo mapa; rota fora dele (Início, Agentes, Perfil…) é livre.
 */
const SCREEN_BY_PATH: Record<string, string> = {
  // Planejamento Pessoal
  '/planning/dashboard': 'planning.dashboard',
  '/planning/tasks-goals': 'planning.tasks_goals',
  '/planning/reflections': 'planning.reflections',
  '/planning/weekly-planning': 'planning.weekly',
  '/planning/workout': 'planning.workout',
  '/planning/nutrition': 'planning.nutrition',
  '/planning/body-metrics': 'planning.body_metrics',
  '/planning/emotional-wellness': 'planning.wellness',
  '/planning/journey': 'planning.journey',
  // Controle Financeiro
  '/dashboard': 'finance.dashboard',
  '/accounts': 'finance.accounts',
  '/bank-reconciliation': 'finance.accounts',
  '/credit-cards': 'finance.credit_cards',
  '/members': 'finance.members',
  '/budgets': 'finance.budgets',
  '/financial-goals': 'finance.financial_goals',
  '/recurring': 'finance.recurring',
  '/finance/rules-tags': 'finance.rules_tags',
  '/transactions': 'finance.transactions',
  '/transfers': 'finance.transfers',
  '/bills': 'finance.bills',
  '/vaults': 'finance.vaults',
  '/loans': 'finance.loans',
  '/finance/agenda': 'finance.agenda',
  '/finance/analytics': 'finance.analytics',
  '/finance/financial-health': 'finance.financial_health',
  // Segurança
  '/security/dashboard': 'security.dashboard',
  '/security/health': 'security.dashboard',
  '/security/passwords': 'security.passwords',
  '/security/stored-cards': 'security.stored_cards',
  '/security/stored-accounts': 'security.stored_accounts',
  '/security/archives': 'security.archives',
  '/security/activity-logs': 'security.activity_logs',
  // Intelecto
  '/library/dashboard': 'intellect.dashboard',
  '/library/intellect-today': 'intellect.today',
  '/library/books': 'intellect.books',
  '/library/authors': 'intellect.authors',
  '/library/publishers': 'intellect.publishers',
  '/library/courses': 'intellect.courses',
  '/library/skills': 'intellect.skills',
  '/library/flashcards': 'intellect.flashcards',
  '/library/knowledge-graph': 'intellect.knowledge_graph',
  // Caminhos antigos que só redirecionam (paleta de comandos, links salvos)
  '/planning/today': 'planning.tasks_goals',
  '/planning/daily': 'planning.tasks_goals',
  '/planning/today-tasks': 'planning.tasks_goals',
  '/planning/daily-checklist': 'planning.tasks_goals',
  '/planning/routine-tasks': 'planning.tasks_goals',
  '/planning/goals': 'planning.tasks_goals',
  '/expenses': 'finance.transactions',
  '/revenues': 'finance.transactions',
  '/credit-card-expenses': 'finance.transactions',
  '/fixed-expenses': 'finance.recurring',
  '/fixed-revenues': 'finance.recurring',
  '/credit-card-bills': 'finance.credit_cards',
  '/payables': 'finance.bills',
  '/receivables': 'finance.bills',
  '/tags': 'finance.rules_tags',
  '/automation-rules': 'finance.rules_tags',
  '/categorization-rules': 'finance.rules_tags',
};

/** Tela da rota (casa por prefixo: abas e detalhes herdam a tela). */
export function screenForPath(pathname: string): string | undefined {
  let best: string | undefined;
  for (const path of Object.keys(SCREEN_BY_PATH)) {
    if (
      (pathname === path || pathname.startsWith(`${path}/`)) &&
      (!best || path.length > best.length)
    )
      best = path;
  }
  return best ? SCREEN_BY_PATH[best] : undefined;
}

export type ScreenGrants = Record<string, string[]>;

/** Alguma tela do módulo (prefixo da chave: planning, finance…) com "Ver". */
export function canAccessModule(grants: ScreenGrants | null, module: string): boolean {
  if (grants === null) return true;
  return Object.entries(grants).some(
    ([screen, actions]) => screen.startsWith(`${module}.`) && actions.includes('view')
  );
}

/** `null` = acesso total (staff/superuser). Toda ação exige "Ver" na tela. */
export function canAccess(
  grants: ScreenGrants | null,
  screen: string | undefined,
  action = 'view'
): boolean {
  if (grants === null || !screen) return true;
  const actions = grants[screen];
  return !!actions?.includes('view') && actions.includes(action);
}
