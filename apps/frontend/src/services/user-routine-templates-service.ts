import { API_CONFIG } from '@/config/constants';
import type {
  UserRoutineTemplate,
  UserRoutineTemplateFormData,
  UserRoutineTemplateImportResult,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class UserRoutineTemplatesService extends BaseService<
  UserRoutineTemplate,
  UserRoutineTemplateFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.USER_ROUTINE_TEMPLATES);
  }

  async importTemplate(id: number): Promise<UserRoutineTemplateImportResult> {
    return apiClient.post<UserRoutineTemplateImportResult>(
      `${this.endpoint}${id}/import/`,
      {}
    );
  }
}

export const userRoutineTemplatesService = new UserRoutineTemplatesService();
