export interface Member {
  id: number;
  uuid: string;
  name: string;
  document: string;
  phone: string;
  email?: string | null;
  sex: string;
  user?: number | null;
  is_creditor: boolean;
  is_benefited: boolean;
  active: boolean;
  email_verified?: boolean;
  birth_date?: string | null;
  address?: string | null;
  profile_photo?: string | null;
  emergency_contact?: string | null;
  monthly_income?: string | null;
  occupation?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberFormData {
  name: string;
  document: string;
  phone: string;
  sex: string;
  email?: string;
  is_creditor?: boolean;
  is_benefited?: boolean;
  birth_date?: string;
  address?: string;
  emergency_contact?: string;
  monthly_income?: number;
  occupation?: string;
  notes?: string;
}

export interface MemberReportExpense {
  id: number;
  description: string;
  value: string;
  date: string;
  category: string;
  payed: boolean;
  merchant: string;
}

export interface MemberReportRevenue {
  id: number;
  description: string;
  value: string;
  date: string;
  category: string;
  received: boolean;
  source: string;
}

export interface MemberReportLoan {
  id: number;
  description: string;
  value: string;
  payed_value: string;
  date: string;
  status: string;
  creditor?: string;
  benefited?: string;
}

export interface MemberReportPayable {
  id: number;
  description: string;
  value: string;
  paid_value: string;
  date: string;
  due_date: string | null;
  status: string;
  category: string;
}

export interface MemberReportTransfer {
  id: number;
  description: string;
  value: string;
  date: string;
  category: string;
  transfered: boolean;
}

export interface MemberFinancialReport {
  member: { id: number; name: string };
  period: { start_date: string | null; end_date: string | null };
  summary: {
    total_revenues: string;
    total_expenses: string;
    total_payables: string;
    total_loans_as_benefited: string;
    total_loans_as_creditor: string;
    total_transfers: string;
    net_balance: string;
  };
  expenses_by_category: { category: string; total: string }[];
  expenses: MemberReportExpense[];
  revenues: MemberReportRevenue[];
  loans_as_benefited: MemberReportLoan[];
  loans_as_creditor: MemberReportLoan[];
  payables: MemberReportPayable[];
  transfers: MemberReportTransfer[];
}
