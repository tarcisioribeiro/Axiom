import type { Tag } from './tags';

export interface Revenue {
  id: number;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  account: number;
  account_name?: string;
  current_balance?: string;
  received: boolean;
  source?: string;
  tax_amount?: string;
  net_amount?: string;
  member?: number | null;
  member_name?: string;
  receipt?: string | null;
  recurring?: boolean;
  frequency?: string | null;
  notes?: string;
  related_transfer?: number | null;
  related_transfer_id?: number | null;
  is_transfer_generated?: boolean;
  is_initial_balance?: boolean;
  related_loan?: number | null;
  loan_description?: string;
  currency_code?: string;
  tags?: Tag[];
  tag_ids?: number[];
}

export interface RevenueFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  account: number;
  received: boolean;
  source?: string;
  tax_amount?: number;
  member?: number | null;
  receipt?: string | null;
  recurring?: boolean;
  frequency?: string | null;
  notes?: string;
  related_loan?: number | null;
}
