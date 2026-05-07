import type { Expense } from './expenses';
import type { Revenue } from './revenues';

export interface FixedExpense {
  id: number;
  uuid: string;
  description: string;
  default_value: string;
  category: string;
  account?: number;
  account_name?: string;
  credit_card?: number;
  credit_card_name?: string;
  due_day: number;
  merchant?: string;
  payment_method?: string;
  notes?: string;
  member?: number | null;
  member_name?: string;
  is_active: boolean;
  allow_value_edit: boolean;
  last_generated_month?: string | null;
  total_generated: number;
  created_at: string;
  updated_at: string;
}

export interface FixedExpenseFormData {
  description: string;
  default_value: number;
  category: string;
  account?: number;
  credit_card?: number;
  due_day: number;
  merchant?: string;
  payment_method?: string;
  notes?: string;
  member?: number | null;
  is_active: boolean;
  allow_value_edit: boolean;
}

export interface FixedExpenseValue {
  fixed_expense_id: number;
  value: number;
}

export interface BulkGenerateRequest {
  month: string;
  expense_values: FixedExpenseValue[];
}

export interface BulkGenerateResponse {
  success: boolean;
  created_count: number;
  month: string;
  expenses: Expense[];
}

export interface FixedExpenseStats {
  active_templates: number;
  current_month: {
    month: string;
    total_value: number;
    paid_count: number;
    pending_count: number;
    total_count: number;
  };
  previous_month: {
    month: string;
    total_value: number;
  };
  comparison: {
    difference: number;
    percentage_change: number;
  };
  category_breakdown: Array<{
    category: string;
    total: number;
    count: number;
  }>;
}

export interface FixedRevenue {
  id: number;
  uuid: string;
  description: string;
  default_value: string;
  category: string;
  account: number;
  account_name?: string;
  due_day: number;
  is_active: boolean;
  allow_value_edit: boolean;
  member?: number | null;
  member_name?: string;
  last_generated_month?: string | null;
  notes?: string;
  total_generated?: number;
  created_at: string;
  updated_at: string;
}

export interface FixedRevenueFormData {
  description: string;
  default_value: number;
  category: string;
  account: number;
  due_day: number;
  is_active?: boolean;
  allow_value_edit?: boolean;
  member?: number | null;
  notes?: string;
}

export interface FixedRevenueValue {
  fixed_revenue_id: number;
  value: number;
}

export interface BulkGenerateRevenuesRequest {
  month: string;
  revenue_values: FixedRevenueValue[];
}

export interface BulkGenerateRevenuesResponse {
  success: boolean;
  created_count: number;
  month: string;
  revenues: Revenue[];
}

export interface FixedRevenueStats {
  active_templates: number;
  current_month: {
    month: string;
    total_amount: number;
    received_count: number;
    generated_count: number;
    pending_count: number;
  };
  previous_month: {
    month: string;
    total_amount: number;
  };
}
