export interface CreditCard {
  id: number;
  uuid: string;
  name: string;
  on_card_name: string;
  card_number_masked: string;
  flag: string;
  validation_date: string;
  credit_limit: string;
  max_limit: string;
  due_day: number;
  closing_day: number;
  associated_account: number;
  associated_account_name?: string;
  used_credit?: number;
  available_credit?: number;
  is_active: boolean;
  interest_rate?: string;
  annual_fee?: string;
  owner?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCardFormData {
  name: string;
  on_card_name: string;
  card_number: string;
  flag: string;
  security_code: string;
  validation_date: string;
  credit_limit: number;
  max_limit: number;
  due_day: number;
  closing_day: number;
  associated_account: number;
  is_active?: boolean;
  interest_rate?: number;
  annual_fee?: number;
  owner?: number;
  notes?: string;
}

export interface CreditCardBill {
  id: number;
  uuid: string;
  credit_card: number;
  credit_card_name?: string;
  credit_card_on_card_name?: string;
  credit_card_number_masked?: string;
  credit_card_flag?: string;
  credit_card_associated_account_name?: string;
  year: string;
  month: string;
  invoice_beginning_date: string;
  invoice_ending_date: string;
  closed: boolean;
  total_amount: string;
  minimum_payment: string;
  due_date: string | null;
  paid_amount: string;
  payment_date: string | null;
  interest_charged: string;
  late_fee: string;
  status: 'open' | 'closed' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface CreditCardBillFormData {
  credit_card: number;
  year: string;
  month: string;
  invoice_beginning_date: string;
  invoice_ending_date: string;
  closed: boolean;
  total_amount: number;
  minimum_payment: number;
  due_date?: string;
  paid_amount?: number;
  payment_date?: string;
  interest_charged?: number;
  late_fee?: number;
  status?: 'open' | 'closed' | 'paid' | 'overdue';
}

export interface BillPaymentFormData {
  amount: number;
  payment_date: string;
  notes?: string;
  scheduled?: boolean;
}

export interface BillPaymentResponse {
  message: string;
  payment: {
    amount: string;
    payment_date: string;
    expense_id: number;
  };
  bill: {
    id: number;
    total_amount: string;
    paid_amount: string;
    remaining: string;
    status: string;
    closed: boolean;
  };
  card: {
    id: number;
    name: string;
    credit_limit: string;
    max_limit: string;
  };
  account: {
    id: number;
    name: string;
    balance: string;
  };
}

export interface BillItem {
  id: number;
  type: 'expense' | 'installment';
  description: string;
  value: number;
  date: string | null;
  category: string;
  installment_number: number;
  total_installments: number;
  merchant?: string | null;
  payed: boolean;
  member_id?: number | null;
  member_name?: string | null;
  notes?: string | null;
  purchase_date?: string;
}

export interface BillItemsResponse {
  bill_id: number;
  bill_month: string;
  bill_year: string;
  total_items: number;
  total_value: number;
  total_paid: number;
  total_pending: number;
  paid_count: number;
  pending_count: number;
  items: BillItem[];
}

export interface CreditCardExpensesByCategory {
  category: string;
  total: number;
  count: number;
}
