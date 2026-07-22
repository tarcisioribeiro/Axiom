import { apiClient } from './api-client';

interface CurrentDateResponse {
  date: string;
}

export const appService = {
  /**
   * Gets the current date from the server (in America/Sao_Paulo timezone).
   * This ensures frontend and backend use the same date reference.
   */
  getCurrentDate: async (): Promise<string> => {
    const response = await apiClient.get<CurrentDateResponse>(
      '/api/v1/app/current-date/'
    );
    return response.date;
  },
};
