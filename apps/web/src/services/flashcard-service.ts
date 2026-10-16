import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

export interface FlashCard {
  id: number;
  uuid: string;
  book: number | null;
  book_title: string | null;
  highlight: number | null;
  front: string;
  back: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  status_display: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlashCardFormData {
  book?: number | null;
  highlight?: number | null;
  front: string;
  back: string;
}

class FlashCardService {
  /** Todas as páginas (a tela filtra e pagina no cliente). */
  async getAll(dueOnly?: boolean): Promise<{ results: FlashCard[]; count: number }> {
    const results: FlashCard[] = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ page: String(page), page_size: '500' });
      if (dueOnly) params.set('due', 'true');
      const res = await apiClient.get<{
        results: FlashCard[];
        count: number;
        next: string | null;
      }>(`${API_CONFIG.ENDPOINTS.FLASHCARDS}?${params}`);
      results.push(...res.results);
      if (!res.next) return { results, count: res.count };
    }
  }

  getById(id: number): Promise<FlashCard> {
    return apiClient.get(`${API_CONFIG.ENDPOINTS.FLASHCARDS}${id}/`);
  }

  create(data: FlashCardFormData): Promise<FlashCard> {
    return apiClient.post(API_CONFIG.ENDPOINTS.FLASHCARDS, data);
  }

  update(id: number, data: Partial<FlashCardFormData>): Promise<FlashCard> {
    return apiClient.patch(`${API_CONFIG.ENDPOINTS.FLASHCARDS}${id}/`, data);
  }

  delete(id: number): Promise<void> {
    return apiClient.delete(`${API_CONFIG.ENDPOINTS.FLASHCARDS}${id}/`);
  }

  review(id: number, rating: number): Promise<FlashCard> {
    return apiClient.post(`${API_CONFIG.ENDPOINTS.FLASHCARDS}${id}/review/`, {
      rating,
    });
  }

  generateFromHighlights(bookId: number): Promise<{ created: number }> {
    return apiClient.post(
      `${API_CONFIG.ENDPOINTS.BOOK_FLASHCARDS_GENERATE}${bookId}/flashcards/generate/`,
      {}
    );
  }
}

export const flashCardService = new FlashCardService();
