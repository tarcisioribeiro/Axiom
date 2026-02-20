import type {
  DashboardStats,
  AccountBalance,
  CreditCardExpensesByCategory,
  BalanceForecast,
} from '@/types';

import { apiClient } from './api-client';

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
}

export const dashboardService = new DashboardService();
