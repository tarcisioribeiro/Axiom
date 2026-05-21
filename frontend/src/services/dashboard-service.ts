import { API_CONFIG } from '@/config/api-config';
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

interface LGPDErrorResponse {
  detail?: string;
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

  async requestLGPDExport(): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/v1/dashboard/lgpd-export/`,
      {
        credentials: 'include',
      }
    );
    if (!response.ok) {
      let detail = `Erro ${response.status}`;
      try {
        const data = (await response.json()) as LGPDErrorResponse;
        if (data.detail) detail = data.detail;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    a.href = url;
    a.download = `axiom_dados_${dateStr}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const dashboardService = new DashboardService();
