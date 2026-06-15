export interface Budget {
  id: number;
  uuid: string;
  category: string;
  limit_amount: string;
  month: number;
  year: number;
  member: number | null;
  member_name?: string | null;
  rollover_enabled: boolean;
  rollover_amount: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetFormData {
  category: string;
  limit_amount: number;
  month: number;
  year: number;
  member?: number | null;
  rollover_enabled?: boolean;
  rollover_amount?: number;
}

export interface BudgetStatus {
  id: number;
  category: string;
  limit_amount: string;
  actual_spent: string;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  member: number | null;
  member_name: string | null;
  month: number;
  year: number;
}

export interface BudgetHistory {
  month: number;
  year: number;
  limit_amount: string | null;
  actual_spent: string;
  percentage: number;
}

export interface CategorizationRule {
  id: number;
  uuid: string;
  merchant_contains: string;
  category: string;
  is_active: boolean;
  priority: number;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface CategorizationRuleFormData {
  merchant_contains: string;
  category: string;
  is_active: boolean;
  priority: number;
}

export interface BankStatementEntry {
  id: number;
  uuid: string;
  transaction_id: string;
  date: string;
  amount: string;
  description: string;
  transaction_type: 'debit' | 'credit';
  status: 'pending' | 'matched' | 'unmatched' | 'ignored';
  matched_expense?: {
    id: number;
    description: string;
    value: string;
    date: string;
  } | null;
  matched_revenue?: {
    id: number;
    description: string;
    value: string;
    date: string;
  } | null;
  match_confidence?: 'high' | 'medium' | 'low' | null;
}

export interface BankStatementImport {
  id: number;
  uuid: string;
  original_filename: string;
  file_format: 'ofx' | 'csv';
  status: 'processing' | 'completed' | 'failed';
  account: number;
  account_name?: string;
  total_entries: number;
  matched_count: number;
  unmatched_count: number;
  ignored_count: number;
  error_message?: string | null;
  entries?: BankStatementEntry[];
  created_at: string;
}

export interface AnomalyAlert {
  category: string;
  current_amount: number;
  average: number;
  std_dev: number;
  z_score: number;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  explanation?: string;
  suggested_action?: string;
  suggested_action_type?: string;
}

export interface SpendingInsightCategory {
  category: string;
  total: number;
  percentage: number;
}

export interface SpendingInsightGrowing {
  category: string;
  current: number;
  prior_avg: number;
  pct_change: number;
}

export interface SpendingInsightMonthly {
  month: string;
  total: number;
}

export interface SpendingInsights {
  period: { month: number; year: number };
  current_month: { month: number; year: number; total_expenses: number };
  trend: { direction: string; pct_change: number; prior_avg: number };
  top_categories: SpendingInsightCategory[];
  growing_categories: SpendingInsightGrowing[];
  monthly_breakdown: SpendingInsightMonthly[];
}
