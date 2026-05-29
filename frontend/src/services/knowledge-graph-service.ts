import { API_CONFIG } from '@/config/api-config';
import type {
  KnowledgeGraphData,
  KnowledgeLink,
  KnowledgeLinkFormData,
} from '@/types/intellect';

import { apiClient } from './api-client';

class KnowledgeGraphService {
  async getGraph(includeHighlights = false): Promise<KnowledgeGraphData> {
    const params = includeHighlights ? '?include_highlights=true' : '';
    return apiClient.get<KnowledgeGraphData>(
      `${API_CONFIG.ENDPOINTS.KNOWLEDGE_GRAPH}${params}`
    );
  }

  async getLinks(): Promise<KnowledgeLink[]> {
    const data = await apiClient.get<{ results: KnowledgeLink[] }>(
      API_CONFIG.ENDPOINTS.KNOWLEDGE_LINKS
    );
    return data.results;
  }

  async createLink(data: KnowledgeLinkFormData): Promise<KnowledgeLink> {
    return apiClient.post<KnowledgeLink>(API_CONFIG.ENDPOINTS.KNOWLEDGE_LINKS, data);
  }

  async deleteLink(id: number): Promise<void> {
    await apiClient.delete<void>(`${API_CONFIG.ENDPOINTS.KNOWLEDGE_LINKS}${id}/`);
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
