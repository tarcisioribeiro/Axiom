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
    BOOK_HIGHLIGHTS: '/api/v1/library/highlights/',
    BOOK_HIGHLIGHTS_EXPORT: '/api/v1/library/highlights/export/',

    // Personal Planning Module
    GOALS: '/api/v1/personal-planning/goals/',
    ROUTINE_TASKS: '/api/v1/personal-planning/routine-tasks/',
    ROUTINE_TASK_HEATMAP: '/api/v1/personal-planning/routine-tasks/heatmap/',
    ROUTINE_TEMPLATES: '/api/v1/personal-planning/routine-templates/',
    ROUTINE_TEMPLATES_IMPORT: '/api/v1/personal-planning/routine-templates/import/',
    REFLECTIONS: '/api/v1/personal-planning/reflections/',
    TASK_INSTANCES: '/api/v1/personal-planning/instances/',

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

    // Categorization Rules
    CATEGORIZATION_RULES: '/api/v1/categorization-rules/',
    CATEGORIZATION_RULES_APPLY: '/api/v1/categorization-rules/apply/',

    // Bank Reconciliation
    BANK_RECONCILIATION_IMPORTS: '/api/v1/bank-reconciliation/imports/',
    BANK_RECONCILIATION_IMPORTS_LIST: '/api/v1/bank-reconciliation/imports/list/',
    BANK_RECONCILIATION_ENTRIES: '/api/v1/bank-reconciliation/entries/',

    // Dashboard
    FINANCIAL_ALERTS: '/api/v1/dashboard/financial-alerts/',

    // Export
    EXPENSES_EXPORT: '/api/v1/expenses/export/',
    REVENUES_EXPORT: '/api/v1/revenues/export/',
    DASHBOARD_MONTHLY_STATEMENT: '/api/v1/dashboard/monthly-statement/',

    // Health
    HEALTH: '/api/v1/health/',
  },
};

// Token Configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_LIFETIME: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN_LIFETIME: 60 * 60 * 1000, // 1 hour
  COOKIE_EXPIRE_DAYS: 7,
};
