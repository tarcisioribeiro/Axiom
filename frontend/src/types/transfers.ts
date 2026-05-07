export interface Transfer {
  id: number;
  uuid: string;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  transfered: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currency_code: string;
  origin_account: number;
  origin_account_name?: string;
  destiny_account: number;
  destiny_account_name?: string;
  transaction_id?: string | null;
  fee?: string;
  exchange_rate?: string | null;
  processed_at?: string | null;
  confirmation_code?: string | null;
  notes?: string;
  receipt?: string | null;
  member?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransferFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  transfered: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currency_code?: string;
  origin_account: number;
  destiny_account: number;
  fee?: number;
  notes?: string;
  member?: number | null;
}

export interface FixedTransfer {
  id: number;
  uuid: string;
  description: string;
  value: string;
  category: string;
  origin_account: number;
  origin_account_name?: string;
  destiny_account: number;
  destiny_account_name?: string;
  due_day: number;
  is_active: boolean;
  fee: string;
  last_generated_month?: string | null;
  notes?: string;
  total_generated?: number;
  created_at: string;
  updated_at: string;
}

export interface FixedTransferFormData {
  description: string;
  value: number;
  category: string;
  origin_account: number;
  destiny_account: number;
  due_day: number;
  is_active?: boolean;
  fee?: number;
  notes?: string;
}
