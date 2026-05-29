export interface Payable {
  id: number;
  uuid: string;
  description: string;
  value: string;
  paid_value: string;
  date: string;
  due_date?: string;
  category: string;
  category_display?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  status: 'active' | 'paid' | 'overdue' | 'cancelled';
  status_display?: string;
  remaining_value?: string;
  installments?: number;
  created_at: string;
  updated_at: string;
}

export interface PayableFormData {
  description: string;
  value: number;
  paid_value?: number;
  date: string;
  due_date?: string;
  category: string;
  member?: number | null;
  notes?: string;
  status?: 'active' | 'paid' | 'overdue' | 'cancelled';
}

export interface PayableInstallment {
  id: number;
  uuid: string;
  payable: number;
  installment_number: number;
  value: string;
  due_date: string;
  payed: boolean;
  payment_expense?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PayablePaymentRequest {
  value: number;
  account: number;
  date: string;
  notes?: string;
  scheduled?: boolean;
}
