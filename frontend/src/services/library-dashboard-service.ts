import { apiClient } from './api-client';

export interface LibraryDashboardStats {
  total_books: number;
  total_authors: number;
  total_publishers: number;
  books_reading: number;
  books_to_read: number;
  books_read: number;
  average_rating: number;
  total_pages_read: number;
  books_by_genre: Array<{
    genre: string;
    genre_display: string;
    count: number;
  }>;
  recent_readings: Array<{
    book_title: string;
    pages_read: number;
    reading_date: string;
  }>;
  top_rated_books: Array<{
    title: string;
    rating: number;
    authors_names: string[];
  }>;
  // Novos campos
  total_reading_time_hours: number;
  average_pages_per_book: number;
  books_by_language: Array<{
    language: string;
    language_display: string;
    count: number;
  }>;
  books_by_media_type: Array<{
    media_type: string;
    media_type_display: string;
    count: number;
  }>;
  most_read_author: {
    name: string;
    books_count: number;
    total_pages: number;
  } | null;
  most_read_publisher: {
    name: string;
    books_count: number;
    total_pages: number;
  } | null;
  reading_status_distribution: Array<{
    status: string;
    status_display: string;
    count: number;
  }>;
  reading_timeline: Array<{
    date: string;
    pages_read: number;
    reading_time_hours: number;
  }>;
  top_authors: Array<{
    name: string;
    books_count: number;
  }>;
  rating_distribution: Array<{
    rating_range: string;
    count: number;
  }>;
}

class LibraryDashboardService {
  async getStats(): Promise<LibraryDashboardStats> {
    return await apiClient.get<LibraryDashboardStats>(
      '/api/v1/library/dashboard/stats/'
    );
  }
}

export const libraryDashboardService = new LibraryDashboardService();
