import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

interface SimulatorScenarioInput {
  name?: string;
  initial_amount: number;
  monthly_deposit: number;
  annual_rate: number;
  months: number;
}

interface SimulatorDataPoint {
  month: number;
  balance: number;
  label: string;
}

export interface SimulatorScenarioResult {
  name: string;
  initial_amount: number;
  monthly_deposit: number;
  annual_rate: number;
  monthly_rate: number;
  months: number;
  final_balance: number;
  total_invested: number;
  total_yield: number;
  data_points: SimulatorDataPoint[];
}

interface SimulatorResponse {
  scenarios: SimulatorScenarioResult[];
}

class VaultSimulatorService {
  async simulate(scenarios: SimulatorScenarioInput[]): Promise<SimulatorResponse> {
    return apiClient.post<SimulatorResponse>(API_CONFIG.ENDPOINTS.VAULT_SIMULATOR, {
      scenarios,
    });
  }
}

export const vaultSimulatorService = new VaultSimulatorService();
