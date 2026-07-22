export interface GoalComputedProgress {
  current_value: string;
  target_value: string;
  percentage: string;
  data_source: 'vaults' | 'expenses' | 'revenues';
}

export interface VaultTransaction {
  id: number;
  uuid: string;
  vault: number;
  vault_description: string;
  transaction_type: 'deposit' | 'withdrawal' | 'yield';
  transaction_type_display: string;
  amount: string;
  balance_after: string;
  description?: string;
  transaction_date: string;
  created_at: string;
  created_by?: number;
}

export interface Vault {
  id: number;
  uuid: string;
  description: string;
  account: number;
  account_name: string;
  account_balance: string;
  institution_name: string;
  current_balance: string;
  accumulated_yield: string;
  yield_rate: string;
  yield_rate_percentage: number;
  annual_yield_rate: string;
  annual_yield_rate_percentage: number;
  daily_yield_rate: number;
  daily_yield_rate_percentage: number;
  last_yield_date?: string;
  pending_yield: number;
  is_active: boolean;
  notes?: string;
  total_deposits: number;
  total_withdrawals: number;
  recent_transactions: VaultTransaction[];
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

export interface VaultFormData {
  description: string;
  account: number;
  yield_rate?: number;
  annual_yield_rate: number;
  is_active: boolean;
  notes?: string;
}

export interface VaultRecurringContribution {
  id: number;
  uuid: string;
  vault: number;
  vault_description: string;
  account_name: string;
  amount: string;
  day_of_month: number;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  description: string;
  fixed_expense_id?: number;
  last_generated_month?: string;
  next_contribution_date?: string;
  created_at: string;
  updated_at: string;
}

export interface VaultRecurringContributionFormData {
  vault?: number;
  amount: number;
  day_of_month: number;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  description: string;
}

export interface GenerateContributionsResponse {
  month: string;
  generated_count: number;
  skipped_count: number;
  error_count: number;
  generated: {
    contribution_id: number;
    vault: string;
    amount: number;
    transaction_id: number;
    deposit_date: string;
  }[];
  errors: {
    contribution_id: number;
    vault: string;
    error: string;
  }[];
}

export interface VaultTransactionUpdateData {
  amount?: number;
  description?: string;
  transaction_date?: string;
}

export interface VaultTransactionUpdateResponse {
  message: string;
  transaction: VaultTransaction;
  vault: Vault;
  adjustment: {
    old_amount: number;
    new_amount: number;
    difference: number;
  };
}

export interface VaultTransactionDeleteResponse {
  message: string;
  vault: Vault;
  reversed_amount: number;
}

export interface VaultDepositData {
  amount: number;
  description?: string;
}

export interface VaultWithdrawData {
  amount: number;
  description?: string;
}

export interface VaultYieldUpdateData {
  yield_rate?: number;
  accumulated_yield?: number;
  recalculate?: boolean;
  from_date?: string;
}

export interface VaultOperationResponse {
  message: string;
  transaction: VaultTransaction;
  vault: Vault;
}

export interface VaultYieldResponse {
  message: string;
  yield_applied: number;
  vault: Vault;
}

export interface VaultYieldUpdateResponse {
  message: string;
  yield_rate_changed?: {
    old: number;
    new: number;
  };
  accumulated_yield_changed?: {
    old: number;
    new: number;
    balance_adjustment: number;
  };
  recalculation?: {
    reversed_amount: number;
    new_yield_amount: number;
    difference: number;
  };
  vault: Vault;
}

export interface VaultSummary {
  id: number;
  uuid: string;
  description: string;
  current_balance: number;
  accumulated_yield: number;
  account_name: string;
  contribution_percentage: number;
}

export interface FinancialGoal {
  id: number;
  uuid: string;
  description: string;
  category: string;
  category_display: string;
  target_value: string;
  current_value: string;
  progress_percentage: string;
  remaining_value: string;
  vaults: number[];
  vaults_count: number;
  vaults_summary: VaultSummary[];
  target_date?: string;
  days_remaining?: number;
  monthly_required?: string;
  is_active: boolean;
  is_completed: boolean;
  completed_at?: string;
  notes?: string;
  linked_expense_category?: string;
  linked_account?: number | null;
  computed_progress: GoalComputedProgress;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

export interface FinancialGoalListItem {
  id: number;
  uuid: string;
  description: string;
  category: string;
  category_display: string;
  target_value: string;
  current_value: string;
  progress_percentage: string;
  vaults_count: number;
  target_date?: string;
  is_active: boolean;
  is_completed: boolean;
  computed_progress: GoalComputedProgress;
  created_at: string;
}

export interface FinancialGoalFormData {
  description: string;
  category: string;
  target_value: number;
  vaults: number[];
  target_date?: string;
  is_active: boolean;
  notes?: string;
  linked_expense_category?: string;
  linked_account?: number | null;
}

export interface FinancialGoalCheckResponse {
  message: string;
  is_completed: boolean;
  current_value: number;
  target_value: number;
  progress_percentage: number;
  goal: FinancialGoal;
}

export interface FinancialGoalVaultsRequest {
  vault_ids: number[];
}

export interface FinancialGoalVaultsResponse {
  message: string;
  goal: FinancialGoal;
}
