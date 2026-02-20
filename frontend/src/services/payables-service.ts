import { apiClient } from './api-client';
import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type { Payable, PayableFormData } from '@/types';

class PayablesService extends BaseService<Payable, PayableFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.PAYABLES);
  }

  async getActive(): Promise<Payable[]> {
    const all = await this.getAll();
    return all.filter((p) => p.status === 'active' || p.status === 'overdue');
  }

  async create(data: PayableFormData): Promise<Payable> {
    return apiClient.post<Payable>(this.endpoint, {
      description: data.description,
      value: data.value,
      paid_value: data.paid_value || 0,
      date: data.date,
      due_date: data.due_date || null,
      category: data.category,
      member: data.member || null,
      notes: data.notes || null,
      status: data.status || 'active',
    });
  }

  async update(id: number, data: Partial<PayableFormData>): Promise<Payable> {
    const payload: Record<string, unknown> = {};

    if (data.description !== undefined) payload.description = data.description;
    if (data.value !== undefined) payload.value = data.value;
    if (data.paid_value !== undefined) payload.paid_value = data.paid_value;
    if (data.date !== undefined) payload.date = data.date;
    if (data.due_date !== undefined) payload.due_date = data.due_date;
    if (data.category !== undefined) payload.category = data.category;
    if (data.member !== undefined) payload.member = data.member;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.status !== undefined) payload.status = data.status;

    return apiClient.patch<Payable>(`${this.endpoint}${id}/`, payload);
  }
}

export const payablesService = new PayablesService();
