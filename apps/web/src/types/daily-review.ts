export type ReviewStepKey =
  | 'reflection'
  | 'tasks'
  | 'goals'
  | 'workout'
  | 'meals'
  | 'hydration'
  | 'checkin'
  | 'self_esteem'
  | 'study'
  | 'self_esteem_periodic'
  | 'wellness'
  | 'weigh_in'
  | 'flashcards';

export interface ReviewItem {
  /** uuid do registro de origem, ou '' quando a etapa tem um item só. */
  key: string;
  label: string;
  id?: number;
  time?: string | null;
  plan?: string;
  total_ml?: number;
  target_ml?: number;
  count?: number;
}

export interface ReviewStep {
  key: ReviewStepKey;
  can_register: boolean;
  justifications: string[];
  items: ReviewItem[];
}

export interface ReviewDay {
  date: string;
  steps: ReviewStep[];
}

export interface ReviewBacklog {
  start: string;
  end: string;
  days: number;
  steps: Pick<ReviewStep, 'key' | 'justifications'>[];
}

export interface DailyReviewState {
  backlog: ReviewBacklog | null;
  days: ReviewDay[];
}

export type SelfEsteemFrequency = 1 | 7 | 14;

export interface UserPreferences {
  daily_review_on_weekends: boolean;
  self_esteem_frequency_days: SelfEsteemFrequency;
  tours_disabled: boolean;
}
