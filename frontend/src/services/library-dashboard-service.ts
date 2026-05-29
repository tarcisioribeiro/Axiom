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
  // Issue #18 — advanced reading statistics
  avg_speed_pages_per_hour: number;
  current_reading_book: {
    title: string;
    total_pages: number;
    pages_read: number;
    remaining_pages: number;
    estimated_days_to_finish: number | null;
  } | null;
  current_reading_books: Array<{
    title: string;
    total_pages: number;
    pages_read: number;
    remaining_pages: number;
    estimated_days_to_finish: number | null;
  }>;
  monthly_comparison: {
    current_month: {
      year: number;
      month: number;
      pages_read: number;
      reading_time_hours: number;
      books_completed: number;
    };
    previous_month: {
      year: number;
      month: number;
      pages_read: number;
      reading_time_hours: number;
      books_completed: number;
    };
    changes: {
      pages_read: number | null;
      reading_time_hours: number | null;
      books_completed: number | null;
    };
  };
  top_genres_by_time: Array<{
    genre: string;
    genre_display: string;
    total_time_hours: number;
    total_pages: number;
  }>;
  total_sessions: number;
  avg_pages_per_session: number;
  longest_session_pages: number;
  most_productive_day: {
    weekday: number;
    weekday_display: string;
    total_pages: number;
    session_count: number;
  } | null;
  reading_streak: {
    current_streak: number;
    longest_streak: number;
  };
  books_by_literary_type: Array<{
    literarytype: string;
    literary_type_display: string;
    count: number;
  }>;
  reading_by_time_of_day: Array<{
    time_of_day: string;
    time_of_day_display: string;
    session_count: number;
    total_pages: number;
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
