import { API_CONFIG } from '@/config/constants';
import type {
  AgentAskRequest,
  AgentAskResponse,
  AgentHistoryResponse,
  AgentStatus,
} from '@/types';

import { apiClient } from './api-client';

class AgentService {
  async ask(data: AgentAskRequest): Promise<AgentAskResponse> {
    return apiClient.post<AgentAskResponse>(API_CONFIG.ENDPOINTS.AGENTS_ASK, data);
  }

  async getHistory(sessionId: string): Promise<AgentHistoryResponse> {
    return apiClient.get<AgentHistoryResponse>(API_CONFIG.ENDPOINTS.AGENTS_HISTORY, {
      session_id: sessionId,
    });
  }

  async clearHistory(sessionId: string): Promise<void> {
    return apiClient.delete<void>(
      `${API_CONFIG.ENDPOINTS.AGENTS_HISTORY}?session_id=${sessionId}`
    );
  }

  async newSession(): Promise<{ session_id: string }> {
    return apiClient.post<{ session_id: string }>(
      API_CONFIG.ENDPOINTS.AGENTS_SESSIONS,
      {}
    );
  }

  async getStatus(): Promise<AgentStatus> {
    return apiClient.get<AgentStatus>(API_CONFIG.ENDPOINTS.AGENTS_STATUS);
  }
}

export const agentService = new AgentService();
