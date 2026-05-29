// API Configuration
// Calcula a URL da API dinamicamente baseada no hostname atual
// Isso permite que o app funcione tanto em localhost quanto em IPs de rede
const getApiBaseUrl = (): string => {
  // URL padrão da API (definida em build-time ou fallback)
  const defaultApiUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    'http://localhost:39100';

  // Sempre usar o hostname do browser para evitar problemas de cross-site cookies
  // Ex: acessar via 127.0.0.1 mas API apontar para localhost causa SameSite cookie block
  if (typeof window !== 'undefined') {
    const { hostname, protocol, port } = window.location;

    // Sem porta explícita = produção via ingress (80/443 padrão)
    // A API é acessada pelo mesmo origin via path routing (/api → api-service)
    if (!port || port === '80' || port === '443') {
      return `${protocol}//${hostname}`;
    }

    // Dev local: usa a porta da API definida na defaultApiUrl
    try {
      const url = new URL(defaultApiUrl);
      const apiPort = url.port || '39100';
      return `${protocol}//${hostname}:${apiPort}`;
    } catch {
      // Se falhar ao parsear URL, usa porta padrão
    }
  }

  // Fallback para URL padrão (SSR ou erro de parse)
  return defaultApiUrl;
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  ENDPOINTS: {
    // Authentication
    LOGIN: '/api/v1/authentication/token/',
    REFRESH_TOKEN: '/api/v1/authentication/token/refresh/',
    VERIFY_TOKEN: '/api/v1/authentication/token/verify/',
    REGISTER: '/api/v1/users/register/',
    USER_PERMISSIONS: '/api/v1/user/permissions/',
    PASSWORD_RESET_REQUEST: '/api/v1/users/password-reset/',
    PASSWORD_RESET_CONFIRM: '/api/v1/users/password-reset/confirm/',
    EMAIL_VERIFICATION_SEND: '/api/v1/users/email-verification/send/',
    EMAIL_VERIFICATION_CONFIRM: '/api/v1/users/email-verification/confirm/',
    CHANGE_PASSWORD: '/api/v1/users/change-password/',
    TWO_FACTOR_SETUP: '/api/v1/users/2fa/setup/',
    TWO_FACTOR_ACTIVATE: '/api/v1/users/2fa/activate/',
    TWO_FACTOR_VERIFY: '/api/v1/users/2fa/verify/',
    TWO_FACTOR_DISABLE: '/api/v1/users/2fa/disable/',
    TWO_FACTOR_STATUS: '/api/v1/users/2fa/status/',
    CURRENT_USER: '/api/v1/me/',

    // Resources
    ACCOUNTS: '/api/v1/accounts/',
    EXPENSES: '/api/v1/expenses/',
    FIXED_EXPENSES: '/api/v1/fixed-expenses/',
    REVENUES: '/api/v1/revenues/',
    CREDIT_CARDS: '/api/v1/credit-cards/',
    CREDIT_CARD_BILLS: '/api/v1/credit-cards-bills/',
    CREDIT_CARD_EXPENSES: '/api/v1/credit-cards-expenses/',
    CREDIT_CARD_PURCHASES: '/api/v1/credit-cards-purchases/',
    CREDIT_CARD_INSTALLMENTS: '/api/v1/credit-cards-installments/',
    TRANSFERS: '/api/v1/transfers/',
    LOANS: '/api/v1/loans/',
    PAYABLES: '/api/v1/payables/',
    MEMBERS: '/api/v1/members/',
    CURRENT_USER_MEMBER: '/api/v1/members/me/',
    MEMBER_PROFILE_PHOTO: '/api/v1/members/me/photo/',
    MEMBER_FINANCIAL_REPORT: '/api/v1/members/:id/financial-report/',
    AVAILABLE_PERMISSIONS: '/api/v1/permissions/available/',

    // Security Module
    PASSWORDS: '/api/v1/security/passwords/',
    PASSWORD_GENERATE: '/api/v1/security/passwords/generate/',
    STORED_CARDS: '/api/v1/security/stored-cards/',
    STORED_ACCOUNTS: '/api/v1/security/stored-accounts/',
    ARCHIVES: '/api/v1/security/archives/',
    ACTIVITY_LOGS: '/api/v1/security/activity-logs/',
    SECURITY_VAULT_STATUS: '/api/v1/security/vault/status/',
    SECURITY_VAULT_SETUP: '/api/v1/security/vault/setup/',
    SECURITY_VAULT_UNLOCK: '/api/v1/security/vault/unlock/',
    SECURITY_VAULT_LOCK: '/api/v1/security/vault/lock/',
    SECURITY_VAULT_CHANGE_PASSWORD: '/api/v1/security/vault/change-master-password/',
    SECURITY_VAULT_HEALTH: '/api/v1/security/passwords/health/',
    SECURITY_VAULT_EXPORT: '/api/v1/security/vault/export/',
    PASSWORD_IMPORT_PREVIEW: '/api/v1/security/passwords/import/preview/',
    PASSWORD_IMPORT_CONFIRM: '/api/v1/security/passwords/import/confirm/',
    PASSWORD_SHARE_TOKENS: '/api/v1/security/passwords/:id/share-tokens/',
    SHARE_TOKEN_REVOKE: '/api/v1/security/share-tokens/:id/revoke/',
    SHARE_TOKEN_REDEEM: '/api/v1/security/share/:token/',

    // Library Module
    AUTHORS: '/api/v1/library/authors/',
    PUBLISHERS: '/api/v1/library/publishers/',
    BOOKS: '/api/v1/library/books/',
    SUMMARIES: '/api/v1/library/summaries/',
    READINGS: '/api/v1/library/readings/',
    READING_GOALS: '/api/v1/library/reading-goals/',
    READING_QUEUE: '/api/v1/library/reading-queue/',
    BOOK_REORDER: '/api/v1/library/reading-queue/reorder/',
    BOOK_FILE: '/api/v1/library/books/',
    BOOK_FILE_STREAM: '/api/v1/library/books/',
    BOOK_HIGHLIGHTS: '/api/v1/library/highlights/',
    BOOK_HIGHLIGHTS_EXPORT: '/api/v1/library/highlights/export/',
    LITERARY_TYPE_GOALS: '/api/v1/library/literary-type-goals/',
    LIBRARY_DASHBOARD_STATS: '/api/v1/library/dashboard/stats/',
    // Intellect — Courses & Skills
    COURSES: '/api/v1/library/courses/',
    COURSE_MODULES: '/api/v1/library/course-modules/',
    COURSE_LESSONS: '/api/v1/library/course-lessons/',
    COURSE_SESSIONS: '/api/v1/library/course-sessions/',
    SKILLS: '/api/v1/library/skills/',
    KNOWLEDGE_GRAPH: '/api/v1/library/knowledge-graph/',
    KNOWLEDGE_LINKS: '/api/v1/library/knowledge-links/',

    // Personal Planning Module
    GOALS: '/api/v1/personal-planning/goals/',
    ROUTINE_TASKS: '/api/v1/personal-planning/routine-tasks/',
    ROUTINE_TASK_HEATMAP: '/api/v1/personal-planning/routine-tasks/heatmap/',
    ROUTINE_TEMPLATES: '/api/v1/personal-planning/routine-templates/',
    ROUTINE_TEMPLATES_IMPORT: '/api/v1/personal-planning/routine-templates/import/',
    REFLECTIONS: '/api/v1/personal-planning/reflections/',
    TASK_INSTANCES: '/api/v1/personal-planning/instances/',
    PERSONAL_PLANNING_ANALYTICS: '/api/v1/personal-planning/analytics/',
    // Workout
    EXERCISES: '/api/v1/personal-planning/exercises/',
    WORKOUT_PLANS: '/api/v1/personal-planning/workout-plans/',
    WORKOUT_DAYS: '/api/v1/personal-planning/workout-days/',
    WORKOUT_EXERCISES: '/api/v1/personal-planning/workout-exercises/',
    WORKOUT_SESSIONS: '/api/v1/personal-planning/workout-sessions/',
    WORKOUT_SESSION_EXERCISES: '/api/v1/personal-planning/workout-session-exercises/',
    WORKOUT_SESSION_SETS: '/api/v1/personal-planning/workout-session-sets/',
    // Nutrition
    FOODS: '/api/v1/personal-planning/foods/',
    MEAL_TYPES: '/api/v1/personal-planning/meal-types/',
    MENU_OPTIONS: '/api/v1/personal-planning/menu-options/',
    MENU_OPTION_INGREDIENTS: '/api/v1/personal-planning/menu-option-ingredients/',
    MEAL_LOGS: '/api/v1/personal-planning/meal-logs/',

    // Vaults Module
    VAULTS: '/api/v1/vaults/',
    VAULT_SIMULATOR: '/api/v1/vaults/simulate/',
    VAULT_TRANSACTIONS: '/api/v1/vault-transactions/',
    VAULT_RECURRING_CONTRIBUTIONS: '/api/v1/vault-recurring-contributions/',
    VAULT_GENERATE_CONTRIBUTIONS: '/api/v1/vaults/generate-contributions/',
    FINANCIAL_GOALS: '/api/v1/financial-goals/',

    // AI Assistant Module
    AI_PERGUNTA: '/api/v1/ai/pergunta/',
    AI_HISTORICO: '/api/v1/ai/historico/',
    AI_HEALTH: '/api/v1/ai/health/',

    // Notifications Module
    NOTIFICATIONS: '/api/v1/notifications/',
    NOTIFICATIONS_SUMMARY: '/api/v1/notifications/summary/',
    NOTIFICATIONS_MARK_ALL_READ: '/api/v1/notifications/mark-all-read/',
    NOTIFICATION_PREFERENCES: '/api/v1/notification-preferences/',

    // Budgets Module
    BUDGETS: '/api/v1/budgets/',
    BUDGETS_STATUS: '/api/v1/budgets/status/',
    BUDGET_HISTORY: '/api/v1/budgets/history/',
    BUDGET_SUGGEST: '/api/v1/budgets/suggest/',

    // Categorization Rules
    CATEGORIZATION_RULES: '/api/v1/categorization-rules/',
    CATEGORIZATION_RULES_APPLY: '/api/v1/categorization-rules/apply/',

    // Bank Reconciliation
    BANK_RECONCILIATION_IMPORTS: '/api/v1/bank-reconciliation/imports/',
    BANK_RECONCILIATION_IMPORTS_LIST: '/api/v1/bank-reconciliation/imports/list/',
    BANK_RECONCILIATION_ENTRIES: '/api/v1/bank-reconciliation/entries/',

    // Dashboard
    FINANCIAL_ALERTS: '/api/v1/dashboard/financial-alerts/',
    DASHBOARD_ANOMALIES: '/api/v1/dashboard/anomalies/',
    DASHBOARD_LGPD_EXPORT: '/api/v1/dashboard/lgpd-export/',
    DASHBOARD_IR_REPORT: '/api/v1/dashboard/ir-report/',
    DASHBOARD_ALERTS_STREAM: '/api/v1/dashboard/alerts/stream/',
    DASHBOARD_AUDIT_LOG: '/api/v1/dashboard/audit-log/',
    DASHBOARD_HEALTH_SCORE: '/api/v1/dashboard/health-score/',

    // Fixed Revenues
    FIXED_REVENUES: '/api/v1/fixed-revenues/',
    FIXED_REVENUES_GENERATE: '/api/v1/fixed-revenues/generate/',
    FIXED_REVENUES_STATS: '/api/v1/fixed-revenues/stats/',

    // Fixed Transfers
    FIXED_TRANSFERS: '/api/v1/fixed-transfers/',
    FIXED_TRANSFERS_GENERATE: '/api/v1/fixed-transfers/generate/',

    // Tags
    TAGS: '/api/v1/tags/',

    // Loan sub-resources (use with id)
    LOAN_INSTALLMENTS: (id: number) => `/api/v1/loans/${id}/installments/`,
    LOAN_PAYMENT: (id: number) => `/api/v1/loans/${id}/pay/`,
    LOAN_RECEIPT: (id: number) => `/api/v1/loans/${id}/receive/`,
    LOAN_AMORTIZATION: (id: number) => `/api/v1/loans/${id}/amortization/`,

    // Payable sub-resources (use with id)
    PAYABLE_INSTALLMENTS: (id: number) => `/api/v1/payables/${id}/installments/`,
    PAYABLE_PAYMENT: (id: number) => `/api/v1/payables/${id}/pay/`,

    // Receivables
    RECEIVABLES: '/api/v1/receivables/',
    RECEIVABLE_INSTALLMENTS: (id: number) => `/api/v1/receivables/${id}/installments/`,
    RECEIVABLE_RECEIPT: (id: number) => `/api/v1/receivables/${id}/receive/`,

    // Account projected balance
    ACCOUNT_PROJECTED_BALANCE: (id: number) =>
      `/api/v1/accounts/${id}/projected-balance/`,

    // Expense splits (use with id)
    EXPENSE_SPLITS: (id: number) => `/api/v1/expenses/${id}/splits/`,

    // Dashboard reconciliation (use with account_id)
    DASHBOARD_RECONCILIATION: (accountId: number) =>
      `/api/v1/dashboard/reconciliation/${accountId}/`,

    // Export
    EXPENSES_EXPORT: '/api/v1/expenses/export/',
    REVENUES_EXPORT: '/api/v1/revenues/export/',
    DASHBOARD_MONTHLY_STATEMENT: '/api/v1/dashboard/monthly-statement/',

    // Health
    HEALTH: '/api/v1/health/',

    // Agents
    AGENTS_ASK: '/api/v1/agents/ask/',
    AGENTS_STREAM: '/api/v1/agents/stream/',
    AGENTS_HISTORY: '/api/v1/agents/history/',
    AGENTS_SESSIONS: '/api/v1/agents/sessions/',
    AGENTS_STATUS: '/api/v1/agents/status/',

    // Admin Panel
    ADMIN_CONFIG: '/api/v1/admin/config/',
    ADMIN_CONFIG_DETAIL: (key: string) => `/api/v1/admin/config/${key}/`,
    ADMIN_HEALTH: '/api/v1/admin/health/',
    ADMIN_INTEGRATIONS: '/api/v1/admin/integrations/',
    ADMIN_LOGS: '/api/v1/admin/logs/',
    ADMIN_EMAIL_TEST: '/api/v1/admin/email/test/',
    ADMIN_AGENTS_STATUS: '/api/v1/admin/agents/status/',
    ADMIN_RESTART_ALL: '/api/v1/admin/restart/',

    // Webhooks
    WEBHOOKS: '/api/v1/webhooks/',
    WEBHOOK_DETAIL: (id: number) => `/api/v1/webhooks/${id}/`,
    WEBHOOK_DELIVERIES: (id: number) => `/api/v1/webhooks/${id}/deliveries/`,
    WEBHOOK_TEST: (id: number) => `/api/v1/webhooks/${id}/test/`,
    WEBHOOK_EVENTS: '/api/v1/webhooks/events/',
  },
};

// Token Configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_LIFETIME: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN_LIFETIME: 60 * 60 * 1000, // 1 hour
  COOKIE_EXPIRE_DAYS: 7,
};
