import { API_CONFIG } from '@/config/api-config';

import { apiClient } from './api-client';

export interface AuditLogEntry {
  id: number;
  action: 'create' | 'update' | 'delete';
  object_type: string | null;
  object_id: string;
  changes: Record<string, [string, string]>;
  timestamp: string;
  ip_address: string | null;
}

class AuditLogService {
  async getAll(params?: {
    object_type?: string;
    object_id?: string;
  }): Promise<{ results: AuditLogEntry[]; count: number }> {
    return apiClient.get<{ results: AuditLogEntry[]; count: number }>(
      API_CONFIG.ENDPOINTS.DASHBOARD_AUDIT_LOG,
      params as Record<string, unknown>
    );
  }
}

export const auditLogService = new AuditLogService();
