import { API_CONFIG } from '@/config/constants';
import type {
  AgentAskRequest,
  AgentAskResponse,
  AgentHistoryResponse,
  AgentStatus,
  AgentStreamEvent,
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

  async *stream(
    payload: AgentAskRequest,
    signal?: AbortSignal
  ): AsyncGenerator<AgentStreamEvent> {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AGENTS_STREAM}`;
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
      signal,
    };

    let response = await fetch(url, fetchOptions);

    // Raw fetch bypasses the axios interceptor — handle 401 manually by
    // refreshing the access token cookie and retrying once.
    if (response.status === 401) {
      try {
        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`, {
          method: 'POST',
          credentials: 'include',
        });
        response = await fetch(url, fetchOptions);
      } catch {
        // Refresh failed — fall through so the 401 is propagated below.
      }
    }

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith('data:')) {
            const json = line.slice(5).trim();
            try {
              yield JSON.parse(json) as AgentStreamEvent;
            } catch {
              // ignore malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const agentService = new AgentService();
