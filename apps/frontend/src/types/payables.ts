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
  is_cumulative?: boolean;
  payment_frequency?: string;
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
  is_cumulative?: boolean;
  payment_frequency?: string;
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

export interface RecalculationPreviewInstallment {
  number: number;
  old_value: string | null;
  new_value: string;
  due_date: string;
}

export interface RecalculationPreview {
  payable_id: number;
  mode: 'keep_count' | 'change_count';
  old_installment_count: number;
  new_installment_count: number;
  old_value_per_installment: string;
  new_value_per_installment: string;
  remaining_value: string;
  installments_preview: RecalculationPreviewInstallment[];
}

export interface PaymentPlanRequest {
  installments: number;
  account: number;
  payment_frequency?: string;
  /** Vencimento da 1ª parcela (`YYYY-MM-DD`). Default: próximo vencimento futuro. */
  first_due_date?: string;
}

export interface PaymentPlanResponse {
  payable: Payable;
  fixed_expense: unknown;
}

export interface RecalculationResponse {
  preview: RecalculationPreview;
  payable: Payable | null;
}

export interface RedistributeAfterPaymentResponse {
  expense: unknown;
  preview: RecalculationPreview;
  payable: Payable | null;
}

export interface RedistributeAfterPaymentRequest {
  expense: {
    value: number;
    account: number;
    date: string;
    notes?: string;
    payed?: boolean;
    description?: string;
  };
  mode: 'keep_count' | 'change_count';
  new_installment_count?: number;
  dry_run: boolean;
}
