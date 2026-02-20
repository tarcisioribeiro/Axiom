import { apiClient } from './api-client';
import { BaseService } from './base-service';
import { formatLocalDate } from '@/lib/utils';
import { API_CONFIG } from '@/config/constants';
import type {
  TaskInstance,
  TaskInstanceFormData,
  TaskInstanceUpdateData,
  InstancesForDateResponse,
  TaskInstanceBulkUpdate,
  TaskInstanceBulkUpdateResponse,
  InstanceStatus,
} from '@/types';

class TaskInstancesService extends BaseService<TaskInstance, TaskInstanceFormData, TaskInstanceUpdateData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.TASK_INSTANCES);
  }

  /**
   * Lista todas as instâncias de tarefas.
   * Suporta filtros por date, status e template.
   */
  async getAll(params?: {
    date?: string;
    status?: InstanceStatus;
    template?: number;
  }): Promise<TaskInstance[]> {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.template) queryParams.append('template', params.template.toString());

    const url = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    const response = await apiClient.get<{ results: TaskInstance[] } | TaskInstance[]>(url);

    // Handle both paginated and non-paginated responses
    return Array.isArray(response) ? response : response.results;
  }

  /**
   * Atualiza uma instância existente.
   */
  async update(id: number, data: TaskInstanceUpdateData): Promise<TaskInstance> {
    return apiClient.patch<TaskInstance>(`${this.endpoint}${id}/`, data);
  }

  /**
   * Atualiza apenas o status de uma instância.
   */
  async updateStatus(id: number, status: InstanceStatus, notes?: string): Promise<TaskInstance> {
    return apiClient.patch<TaskInstance>(`${this.endpoint}${id}/status/`, { status, notes });
  }

  /**
   * Obtém ou gera instâncias para uma data específica.
   * Este é o principal método para carregar o Kanban/checklist diário.
   *
   * @param date - Data no formato YYYY-MM-DD
   * @param sync - Se true, sincroniza instâncias pendentes com dados atuais do template
   */
  async getForDate(
    date: string,
    sync: boolean = false
  ): Promise<InstancesForDateResponse> {
    const syncParam = sync ? '&sync=true' : '';
    return apiClient.get<InstancesForDateResponse>(`${this.endpoint}for-date/?date=${date}${syncParam}`);
  }

  /**
   * Atualiza múltiplas instâncias de uma vez.
   * Útil para salvar o estado do Kanban.
   */
  async bulkUpdate(updates: TaskInstanceBulkUpdate[]): Promise<TaskInstanceBulkUpdateResponse> {
    return apiClient.post<TaskInstanceBulkUpdateResponse>(`${this.endpoint}bulk-update/`, { updates });
  }

  /**
   * Helper: Formata a data atual no formato YYYY-MM-DD.
   */
  getTodayDate(): string {
    return formatLocalDate(new Date());
  }

  /**
   * Helper: Obtém instâncias do dia atual.
   */
  async getForToday(): Promise<InstancesForDateResponse> {
    return this.getForDate(this.getTodayDate());
  }
}

export const taskInstancesService = new TaskInstancesService();
