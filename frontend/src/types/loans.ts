export interface Loan {
  id: number;
  uuid: string;
  description: string;
  value: string;
  payed_value: string;
  date: string;
  horary: string;
  category: string;
  account: number;
  account_name?: string;
  benefited: number;
  benefited_name?: string;
  creditor: number;
  creditor_name?: string;
  payed: boolean;
  interest_rate?: string;
  installments: number;
  due_date?: string;
  contract_document?: string | null;
  payment_frequency: string;
  late_fee: string;
  guarantor?: number | null;
  guarantor_name?: string;
  notes?: string;
  status: string;
  remaining_balance?: string;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

export interface LoanFormData {
  description: string;
  value: number;
  payed_value: number;
  date: string;
  horary: string;
  category: string;
  account: number;
  benefited: number;
  creditor: number;
  payed: boolean;
  interest_rate?: number;
  installments?: number;
  due_date?: string;
  contract_document?: File | null;
  payment_frequency?: string;
  late_fee?: number;
  guarantor?: number | null;
  notes?: string;
  status?: string;
  loan_type?: 'borrowed' | 'lent';
  generate_revenue?: boolean;
  generate_expense?: boolean;
}

export interface LoanInstallment {
  id: number;
  uuid: string;
  loan: number;
  installment_number: number;
  value: string;
  due_date: string;
  payed: boolean;
  payment_expense?: number | null;
  created_at: string;
  updated_at: string;
}

export interface LoanPaymentRequest {
  value: number;
  account: number;
  date: string;
  notes?: string;
}

export interface LoanReceiptRequest {
  value: number;
  account: number;
  date: string;
  notes?: string;
  scheduled?: boolean;
}

export interface AmortizationEntry {
  installment: number;
  due_date: string;
  payment: string;
  principal: string;
  interest: string;
  balance: string;
}

export interface AmortizationSchedule {
  method: 'price' | 'sac';
  schedule: AmortizationEntry[];
}
