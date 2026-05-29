export interface CreditCardExpense {
  id: number;
  uuid: string;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  card: number;
  card_name?: string;
  installment: number;
  payed: boolean;
  total_installments: number;
  merchant?: string;
  transaction_id?: string;
  location?: string;
  bill?: number | null;
  bill_info?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  receipt?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCardExpenseFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  card: number;
  installment?: number;
  payed?: boolean;
  total_installments: number;
  bill?: number | null;
  member?: number | null;
  notes?: string;
}

export interface CreditCardInstallmentNested {
  id: number;
  installment_number: number;
  value: number;
  due_date: string;
  bill?: number | null;
  payed: boolean;
  bill_month?: string;
  bill_year?: string;
}

export interface CreditCardPurchase {
  id: number;
  uuid: string;
  description: string;
  total_value: number;
  installment_value: number;
  purchase_date: string;
  purchase_time: string;
  category: string;
  card: number;
  card_name?: string;
  card_flag?: string;
  card_number_masked?: string;
  total_installments: number;
  merchant?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  receipt?: string | null;
  installments: CreditCardInstallmentNested[];
  created_at: string;
  updated_at: string;
}

export interface CreditCardPurchaseFormData {
  description: string;
  total_value: number;
  purchase_date: string;
  purchase_time: string;
  category: string;
  card: number;
  total_installments: number;
  merchant?: string;
  member?: number | null;
  notes?: string;
}

export interface CreditCardInstallment {
  id: number;
  uuid: string;
  purchase: number;
  installment_number: number;
  value: number;
  due_date: string;
  bill?: number | null;
  payed: boolean;
  description?: string;
  category?: string;
  card_id?: number;
  card_name?: string;
  total_installments?: number;
  merchant?: string;
  member_id?: number | null;
  member_name?: string;
  purchase_date?: string;
  bill_month?: string;
  bill_year?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCardInstallmentUpdateData {
  bill?: number | null;
  payed?: boolean;
  value?: number;
}
