import type { Era } from './library-constants';
export interface Author {
  id: number;
  uuid: string;
  name: string;
  photo?: string | null;
  birth_year?: number | null;
  birth_era?: Era;
  birth_era_display?: string;
  death_year?: number | null;
  death_era?: Era | null;
  death_era_display?: string;
  birth_display?: string | null;
  death_display?: string | null;
  nationality?: string;
  nationality_display?: string;
  biography?: string;
  books_count: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorFormData {
  name: string;
  birth_year?: number | null | undefined;
  birth_era: Era;
  death_year?: number | null | undefined;
  death_era?: Era | null | undefined;
  nationality: string;
  biography?: string;
  owner: number;
}

export interface Publisher {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  website?: string;
  country?: string;
  country_display?: string;
  founded_year?: number;
  books_count: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface PublisherFormData {
  name: string;
  description?: string;
  website?: string;
  country?: string;
  founded_year?: number;
  owner: number;
}

export interface Book {
  id: number;
  uuid: string;
  title: string;
  isbn?: string | null;
  series_name?: string | null;
  series_order?: number | null;
  cover?: string | null;
  book_file?: string | null;
  authors?: number[];
  authors_names: string[];
  pages: number;
  publisher: number;
  publisher_name: string;
  language: string;
  language_display: string;
  genre: string;
  genre_display: string;
  literarytype: string;
  literarytype_display: string;
  publish_date?: string;
  synopsis: string;
  edition: string;
  media_type?: string;
  media_type_display?: string;
  rating: number | null;
  read_status: string;
  read_status_display: string;
  pause_reason?: string | null;
  reading_priority: number | null;
  has_summary: boolean;
  estimated_days_to_finish?: number | null;
  total_pages_read: number;
  reading_progress: number;
  general_avg_pages_per_day: number;
  book_avg_pages_per_day: number;
  estimated_completion_general: string | null;
  estimated_completion_book: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface BookFormData {
  title: string;
  isbn?: string;
  series_name?: string;
  series_order?: number | null;
  authors: number[];
  pages: number;
  publisher: number;
  language: string;
  genre: string;
  literarytype: string;
  publish_date?: string;
  synopsis: string;
  edition: string;
  media_type?: string;
  rating: number | null;
  read_status: string;
  pause_reason?: string;
  owner: number;
}

export interface Summary {
  id: number;
  uuid: string;
  title: string;
  book: number;
  book_title: string;
  text: string;
  is_vectorized: boolean;
  vectorization_date?: string;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryFormData {
  title: string;
  book: number;
  text: string;
  owner: number;
}

export interface Reading {
  id: number;
  uuid: string;
  book: number;
  book_title: string;
  reading_date: string;
  reading_time: number;
  pages_read: number;
  notes?: string;
  current_page?: number | null;
  current_cfi?: string | null;
  time_of_day?: string | null;
  time_of_day_display?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingFormData {
  book: number;
  reading_date: string;
  reading_time: number;
  pages_read: number;
  notes?: string;
  current_page?: number | null;
  current_cfi?: string | null;
  time_of_day?: string | null;
  owner: number;
}

export interface LiteraryTypeGoal {
  id: number;
  uuid: string;
  literary_type: 'book' | 'collection' | 'magazine' | 'article' | 'essay';
  literary_type_display: string;
  goal_count: number;
  books_read_this_year: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface LiteraryTypeGoalFormData {
  reading_goal: number;
  literary_type: string;
  goal_count: number;
}

export interface ReadingGoal {
  id: number;
  uuid: string;
  year: number;
  name?: string | null;
  books_goal: number;
  pages_goal: number;
  books_read_this_year: number;
  pages_read_this_year: number;
  progress_percentage: number;
  pages_progress_percentage: number;
  literary_type_goals: LiteraryTypeGoal[];
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingGoalFormData {
  year: number;
  name?: string;
  books_goal: number;
  pages_goal: number;
  owner: number;
}

export interface BookHighlight {
  id: number;
  uuid: string;
  book: number;
  book_title: string;
  text: string;
  page_number?: number | null;
  chapter?: string | null;
  highlight_type: 'quote' | 'note' | 'idea';
  highlight_type_display: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  color_display: string;
  summary?: number | null;
  summary_title?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface BookHighlightFormData {
  book: number;
  text: string;
  page_number?: number | null;
  chapter?: string | null;
  highlight_type: string;
  color: string;
  summary?: number | null;
  owner: number;
}
