import { API_CONFIG } from '@/config/constants';
import type { RoutineTask, RoutineTaskFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

export interface RoutineTaskExportParams {
  export_format: 'csv' | 'pdf';
  category?: string;
  status?: 'active' | 'inactive';
  priority?: string;
}

class RoutineTasksService extends BaseService<RoutineTask, RoutineTaskFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ROUTINE_TASKS);
  }

  /**
   * Exporta tarefas rotineiras filtradas como CSV ou PDF e aciona o download no browser.
   *
   * @param params - Filtros e formato de exportação
   */
  async exportTasks(params: RoutineTaskExportParams): Promise<void> {
    const blob = await apiClient.getBlob(
      API_CONFIG.ENDPOINTS.ROUTINE_TASKS_EXPORT,
      params
    );

    const date = new Date().toISOString().split('T')[0];
    const filename = `tarefas_rotineiras_${date}.${params.export_format}`;
    triggerDownload(blob, filename);
  }
}

export const routineTasksService = new RoutineTasksService();

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
