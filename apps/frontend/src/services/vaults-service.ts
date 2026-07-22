import { API_CONFIG } from '@/config/constants';
import type {
  Vault,
  VaultFormData,
  VaultTransaction,
  VaultDepositData,
  VaultWithdrawData,
  VaultYieldUpdateData,
  VaultOperationResponse,
  VaultYieldResponse,
  VaultYieldUpdateResponse,
  VaultTransactionUpdateData,
  VaultTransactionUpdateResponse,
  VaultTransactionDeleteResponse,
  VaultRecurringContribution,
  VaultRecurringContributionFormData,
  GenerateContributionsResponse,
  FinancialGoal,
  FinancialGoalListItem,
  FinancialGoalFormData,
  FinancialGoalCheckResponse,
  FinancialGoalVaultsRequest,
  FinancialGoalVaultsResponse,
  PaginatedResponse,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class VaultsService extends BaseService<Vault, VaultFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.VAULTS);
  }

  // Vault Operations
  async deposit(id: number, data: VaultDepositData): Promise<VaultOperationResponse> {
    return apiClient.post<VaultOperationResponse>(
      `${this.endpoint}${id}/deposit/`,
      data
    );
  }

  async withdraw(id: number, data: VaultWithdrawData): Promise<VaultOperationResponse> {
    return apiClient.post<VaultOperationResponse>(
      `${this.endpoint}${id}/withdraw/`,
      data
    );
  }

  async applyYield(id: number): Promise<VaultYieldResponse> {
    return apiClient.post<VaultYieldResponse>(`${this.endpoint}${id}/apply-yield/`, {});
  }

  async updateYield(
    id: number,
    data: VaultYieldUpdateData
  ): Promise<VaultYieldUpdateResponse> {
    return apiClient.post<VaultYieldUpdateResponse>(
      `${this.endpoint}${id}/update-yield/`,
      data
    );
  }

  // Vault Transactions
  async getTransactions(vaultId: number, type?: string): Promise<VaultTransaction[]> {
    const response = await apiClient.get<PaginatedResponse<VaultTransaction>>(
      `${this.endpoint}${vaultId}/transactions/`,
      type ? { type } : undefined
    );
    return response.results;
  }

  async getAllTransactions(params?: {
    vault?: number;
    type?: string;
  }): Promise<VaultTransaction[]> {
    const response = await apiClient.get<PaginatedResponse<VaultTransaction>>(
      API_CONFIG.ENDPOINTS.VAULT_TRANSACTIONS,
      params as Record<string, unknown>
    );
    return response.results;
  }

  // Transaction Update/Delete
  async updateTransaction(
    id: number,
    data: VaultTransactionUpdateData
  ): Promise<VaultTransactionUpdateResponse> {
    return apiClient.patch<VaultTransactionUpdateResponse>(
      `${API_CONFIG.ENDPOINTS.VAULT_TRANSACTIONS}${id}/`,
      data
    );
  }

  async deleteTransaction(id: number): Promise<VaultTransactionDeleteResponse> {
    return apiClient.delete<VaultTransactionDeleteResponse>(
      `${API_CONFIG.ENDPOINTS.VAULT_TRANSACTIONS}${id}/`
    );
  }

  // Recurring Contributions
  async getContributions(vaultId: number): Promise<VaultRecurringContribution[]> {
    const response = await apiClient.get<PaginatedResponse<VaultRecurringContribution>>(
      `${this.endpoint}${vaultId}/recurring-contributions/`
    );
    return response.results;
  }

  async createContribution(
    vaultId: number,
    data: VaultRecurringContributionFormData
  ): Promise<VaultRecurringContribution> {
    return apiClient.post<VaultRecurringContribution>(
      `${this.endpoint}${vaultId}/recurring-contributions/`,
      data
    );
  }

  async updateContribution(
    id: number,
    data: Partial<VaultRecurringContributionFormData>
  ): Promise<VaultRecurringContribution> {
    return apiClient.patch<VaultRecurringContribution>(
      `${API_CONFIG.ENDPOINTS.VAULT_RECURRING_CONTRIBUTIONS}${id}/`,
      data
    );
  }

  async deleteContribution(id: number): Promise<void> {
    return apiClient.delete<void>(
      `${API_CONFIG.ENDPOINTS.VAULT_RECURRING_CONTRIBUTIONS}${id}/`
    );
  }

  async getContributionHistory(vaultId: number): Promise<VaultTransaction[]> {
    const response = await apiClient.get<PaginatedResponse<VaultTransaction>>(
      `${this.endpoint}${vaultId}/contribution-history/`
    );
    return response.results;
  }

  async generateContributions(month?: string): Promise<GenerateContributionsResponse> {
    return apiClient.post<GenerateContributionsResponse>(
      API_CONFIG.ENDPOINTS.VAULT_GENERATE_CONTRIBUTIONS,
      month ? { month } : {}
    );
  }
}

class FinancialGoalsService extends BaseService<
  FinancialGoalListItem,
  FinancialGoalFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.FINANCIAL_GOALS);
  }

  // Override getById/create/update to return the richer FinancialGoal type (detail view)
  async getById(id: number): Promise<FinancialGoal> {
    return apiClient.get<FinancialGoal>(`${this.endpoint}${id}/`);
  }

  async create(data: FinancialGoalFormData): Promise<FinancialGoal> {
    return apiClient.post<FinancialGoal>(this.endpoint, data);
  }

  async update(
    id: number,
    data: Partial<FinancialGoalFormData>
  ): Promise<FinancialGoal> {
    return apiClient.put<FinancialGoal>(`${this.endpoint}${id}/`, data);
  }

  // Goal Operations
  async checkCompletion(id: number): Promise<FinancialGoalCheckResponse> {
    return apiClient.post<FinancialGoalCheckResponse>(
      `${this.endpoint}${id}/check-completion/`,
      {}
    );
  }

  async addVaults(
    id: number,
    vaultIds: number[]
  ): Promise<FinancialGoalVaultsResponse> {
    const data: FinancialGoalVaultsRequest = { vault_ids: vaultIds };
    return apiClient.post<FinancialGoalVaultsResponse>(
      `${this.endpoint}${id}/add-vaults/`,
      data
    );
  }

  async removeVaults(
    id: number,
    vaultIds: number[]
  ): Promise<FinancialGoalVaultsResponse> {
    const data: FinancialGoalVaultsRequest = { vault_ids: vaultIds };
    return apiClient.post<FinancialGoalVaultsResponse>(
      `${this.endpoint}${id}/remove-vaults/`,
      data
    );
  }
}

export const vaultsService = new VaultsService();
export const financialGoalsService = new FinancialGoalsService();
