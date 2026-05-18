export interface FinancialAlert {
  type:
    | 'budget_limit'
    | 'credit_card_bill_due'
    | 'low_balance'
    | 'payable_due'
    | 'loan_due';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  link: string;
  metadata: Record<string, unknown>;
}

export interface DashboardStats {
  total_balance: number;
  total_expenses: number;
  total_revenues: number;
  total_credit_limit: number;
  used_credit_limit: number;
  available_credit_limit: number;
  accounts_count: number;
  credit_cards_count: number;
}

export interface AccountBalance {
  id: number;
  account_name: string;
  institution_name: string;
  current_balance: number;
  pending_revenues: number;
  pending_expenses: number;
  pending_transfers_in: number;
  pending_transfers_out: number;
  future_balance: number;
}

export interface BalanceForecast {
  current_total_balance: number;
  forecast_balance: number;
  pending_expenses: number;
  pending_revenues: number;
  pending_card_bills: number;
  loans_to_receive: number;
  loans_to_pay: number;
  pending_payables: number;
  summary: {
    total_income: number;
    total_outcome: number;
    net_change: number;
  };
}

export interface CashFlowForecastDay {
  date: string;
  revenues: number;
  expenses: number;
  balance: number;
}

export interface CashFlowForecast {
  period_days: number;
  start_balance: number;
  end_balance: number;
  total_revenues: number;
  total_expenses: number;
  net_change: number;
  min_balance: number;
  min_balance_date: string;
  daily_breakdown: CashFlowForecastDay[];
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TimeSeriesData {
  date: string;
  expenses: number;
  revenues: number;
}
