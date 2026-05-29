import type { Tag } from './tags';

export interface Expense {
  id: number;
  uuid: string;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  payed: boolean;
  account: number;
  account_name?: string;
  member: number | null;
  member_name?: string;
  merchant?: string;
  location?: string;
  payment_method?: string;
  notes?: string;
  recurring?: boolean;
  frequency?: string;
  related_transfer?: number | null;
  related_transfer_id?: number | null;
  is_transfer_generated?: boolean;
  related_loan?: number | null;
  loan_description?: string;
  related_payable?: number | null;
  payable_description?: string;
  auto_categorized: boolean;
  is_initial_balance?: boolean;
  currency_code?: string;
  tags?: Tag[];
  tag_ids?: number[];
  created_at: string;
  updated_at: string;
}

export interface ExpenseFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  payed: boolean;
  account: number;
  member?: number | null;
  merchant?: string;
  location?: string;
  payment_method?: string;
  notes?: string;
  recurring?: boolean;
  frequency?: string;
  related_loan?: number | null;
  related_payable?: number | null;
}

export interface ExpenseSplit {
  id: number;
  uuid: string;
  expense: number;
  member?: number | null;
  member_name?: string;
  description: string;
  percentage?: string | null;
  value: string;
  payed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplitFormData {
  description: string;
  value: number;
  member?: number | null;
  payed?: boolean;
}
