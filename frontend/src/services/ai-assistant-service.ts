/**
 * Service para comunicação com o AI Assistant.
 *
 * Suporta agentes especializados com modelos e escopos diferentes.
 */
import type {
  AiResponse,
  AiHealthResponse,
  AiHistoryResponse,
  AiAgentsResponse,
} from '@/types';

import { apiClient } from './api-client';

class AiAssistantService {
  private readonly baseUrl = '/api/v1/ai';

  /**
   * Envia uma pergunta para um agente especializado.
   *
   * @param pergunta - A pergunta em linguagem natural
   * @param agent - O key do agente a ser usado (ex: 'financial', 'security')
   * @param conversationHistory - Historico de conversa recente (opcional)
   */
  async pergunta(
    pergunta: string,
    agent: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<AiResponse> {
    return apiClient.post<AiResponse>(`${this.baseUrl}/pergunta/`, {
      pergunta,
      agent,
      conversation_history: conversationHistory || [],
    });
  }

  /**
   * Obtém a lista de agentes disponíveis.
   */
  async getAgents(): Promise<AiAgentsResponse> {
    return apiClient.get<AiAgentsResponse>(`${this.baseUrl}/agents/`);
  }

  /**
   * Obtém o histórico de conversas.
   */
  async getHistorico(limit: number = 20): Promise<AiHistoryResponse> {
    return apiClient.get<AiHistoryResponse>(
      `${this.baseUrl}/historico/?limit=${limit}`
    );
  }

  /**
   * Verifica a saúde do serviço de IA.
   */
  async checkHealth(): Promise<AiHealthResponse> {
    return apiClient.get<AiHealthResponse>(`${this.baseUrl}/health/`);
  }
}

export const aiAssistantService = new AiAssistantService();
