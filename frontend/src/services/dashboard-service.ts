import type {
  DashboardStats,
  AccountBalance,
  CreditCardExpensesByCategory,
  BalanceForecast,
  CashFlowForecast,
  FinancialAlert,
  AnomalyAlert,
} from '@/types';

import { apiClient } from './api-client';

export interface IRReport {
  year: number;
  revenues: { category: string; total: number }[];
  deductible_expenses: { category: string; total: number }[];
  loans: { description: string; total_paid: number }[];
  generated_at: string;
}

interface CreditCardExpensesByCategoryParams {
  card?: number;
  bill?: number;
}

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    // PERF-02: Endpoint otimizado que usa aggregations no banco de dados
    // Reduz de 4 requisições + cálculos no cliente para 1 requisição otimizada
    return apiClient.get<DashboardStats>('/api/v1/dashboard/stats/');
  }

  async getAccountBalances(): Promise<AccountBalance[]> {
    return apiClient.get<AccountBalance[]>('/api/v1/dashboard/account-balances/');
  }

  async getCreditCardExpensesByCategory(
    params?: CreditCardExpensesByCategoryParams
  ): Promise<CreditCardExpensesByCategory[]> {
    return apiClient.get<CreditCardExpensesByCategory[]>(
      '/api/v1/dashboard/credit-card-expenses-by-category/',
      params as Record<string, unknown>
    );
  }

  async getBalanceForecast(): Promise<BalanceForecast> {
    return apiClient.get<BalanceForecast>('/api/v1/dashboard/balance-forecast/');
  }

  async getCashFlowForecast(days: 30 | 60 | 90 = 30): Promise<CashFlowForecast> {
    return apiClient.get<CashFlowForecast>('/api/v1/dashboard/cash-flow-forecast/', {
      days,
    } as Record<string, unknown>);
  }

  async getFinancialAlerts(): Promise<FinancialAlert[]> {
    return apiClient.get<FinancialAlert[]>('/api/v1/dashboard/financial-alerts/');
  }

  async getAnomalies(): Promise<AnomalyAlert[]> {
    return apiClient.get<AnomalyAlert[]>('/api/v1/dashboard/anomalies/');
  }

  async getIRReport(year: number): Promise<IRReport> {
    return apiClient.get<IRReport>('/api/v1/dashboard/ir-report/', { year } as Record<
      string,
      unknown
    >);
  }

  async requestLGPDExport(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/api/v1/dashboard/lgpd-export/', null);
  }
}

export const dashboardService = new DashboardService();
