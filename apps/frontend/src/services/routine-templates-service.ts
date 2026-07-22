import { API_CONFIG } from '@/config/constants';
import type { RoutineTemplate, RoutineTemplateImportResult } from '@/types';

import { apiClient } from './api-client';

class RoutineTemplatesService {
  async getAll(): Promise<RoutineTemplate[]> {
    return apiClient.get<RoutineTemplate[]>(API_CONFIG.ENDPOINTS.ROUTINE_TEMPLATES);
  }

  async importTemplate(templateId: string): Promise<RoutineTemplateImportResult> {
    return apiClient.post<RoutineTemplateImportResult>(
      API_CONFIG.ENDPOINTS.ROUTINE_TEMPLATES_IMPORT,
      { template_id: templateId }
    );
  }
}

export const routineTemplatesService = new RoutineTemplatesService();
