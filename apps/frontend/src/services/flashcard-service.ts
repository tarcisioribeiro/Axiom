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

export interface FlashCardReviewResult {
  rating: number;
}

class FlashCardService {
  getAll(dueOnly?: boolean): Promise<{ results: FlashCard[]; count: number }> {
    const url = dueOnly
      ? `${API_CONFIG.ENDPOINTS.FLASHCARDS}?due=true`
      : API_CONFIG.ENDPOINTS.FLASHCARDS;
    return apiClient.get(url);
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
