export interface Receivable {
  id: number;
  uuid: string;
  description: string;
  value: string;
  received_value: string;
  date: string;
  due_date?: string;
  category: string;
  category_display?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  status: 'active' | 'received' | 'overdue' | 'cancelled';
  status_display?: string;
  remaining_value?: string;
  created_at: string;
  updated_at: string;
}

export interface ReceivableFormData {
  description: string;
  value: number;
  received_value?: number;
  date: string;
  due_date?: string;
  category: string;
  member?: number | null;
  notes?: string;
  status?: 'active' | 'received' | 'overdue' | 'cancelled';
}

export interface ReceivableInstallment {
  id: number;
  uuid: string;
  receivable: number;
  installment_number: number;
  value: string;
  due_date: string;
  received: boolean;
  receipt_revenue?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivableReceiptRequest {
  value: number;
  account: number;
  date: string;
  notes?: string;
  scheduled?: boolean;
}
