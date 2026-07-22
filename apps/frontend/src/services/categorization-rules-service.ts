import { API_CONFIG } from '@/config/constants';
import type { CategorizationRule, CategorizationRuleFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class CategorizationRulesService extends BaseService<
  CategorizationRule,
  CategorizationRuleFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CATEGORIZATION_RULES);
  }

  async applyRules(): Promise<{ updated: number; total_processed: number }> {
    return apiClient.post<{ updated: number; total_processed: number }>(
      API_CONFIG.ENDPOINTS.CATEGORIZATION_RULES_APPLY,
      {}
    );
  }
}

export const categorizationRulesService = new CategorizationRulesService();
