import { API_CONFIG } from '@/config/constants';
import type {
  AutomationRule,
  AutomationRuleFormData,
  AutomationRuleLog,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class AutomationRulesService extends BaseService<
  AutomationRule,
  AutomationRuleFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.AUTOMATION_RULES);
  }

  async applyRules(): Promise<{ applied: number }> {
    return apiClient.post<{ applied: number }>(
      API_CONFIG.ENDPOINTS.AUTOMATION_RULES_APPLY,
      {}
    );
  }

  async getLogs(id: number): Promise<AutomationRuleLog[]> {
    return apiClient.get<AutomationRuleLog[]>(
      API_CONFIG.ENDPOINTS.AUTOMATION_RULE_LOGS(id)
    );
  }
}

export const automationRulesService = new AutomationRulesService();
