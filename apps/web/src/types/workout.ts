/* eslint-disable max-lines */
export type WorkoutCategory = 'cardio' | 'resistance' | 'mobility';

export const WORKOUT_CATEGORIES: WorkoutCategory[] = [
  'cardio',
  'resistance',
  'mobility',
];

export interface SetTarget {
  reps: number | null;
  load: string | null;
}

export interface Exercise {
  id: number;
  uuid: string;
  name: string;
  category: WorkoutCategory;
  muscle_groups?: string | null;
  description?: string | null;
  dataset_entry?: number | null;
  dataset_entry_name?: string | null;
  gif_url?: string | null;
  thumbnail_url?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseFormData {
  name: string;
  category: WorkoutCategory;
  muscle_groups?: string | null;
  description?: string | null;
  dataset_entry?: number | null;
  owner: number;
}

export interface ExerciseDatasetEntry {
  id: number;
  dataset_id: string;
  name: string;
  category?: string | null;
  body_part?: string | null;
  equipment?: string | null;
  target?: string | null;
  muscle_group?: string | null;
  thumbnail_url?: string | null;
  gif_url?: string | null;
}

export interface WorkoutPlan {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  category: WorkoutCategory;
  is_active: boolean;
  days: WorkoutDay[];
  day_count: number;
  exercise_count: number;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutPlanFormData {
  name: string;
  description?: string | null;
  category: WorkoutCategory;
  is_active: boolean;
  owner: number;
}

export interface WorkoutDay {
  id: number;
  uuid: string;
  plan: number;
  name: string;
  muscle_groups?: string | null;
  days_of_week: number[];
  order: number;
  default_start_time?: string | null;
  default_duration_minutes?: number | null;
  exercises: WorkoutExercise[];
  exercise_count: number;
  category: WorkoutCategory;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutDayFormData {
  plan: number;
  name: string;
  muscle_groups?: string | null;
  days_of_week: number[];
  order: number;
  default_start_time?: string | null;
  default_duration_minutes?: number | null;
  owner: number;
}

export interface WorkoutExercise {
  id: number;
  uuid: string;
  workout_day: number;
  exercise?: number | null;
  exercise_catalog_name?: string | null;
  gif_url?: string | null;
  thumbnail_url?: string | null;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds?: number | null;
  load?: string | null;
  load_unit: string;
  load_unit_display?: string | null;
  set_targets: SetTarget[];
  order: number;
  notes?: string | null;
  execution_count?: number | null;
  duration_seconds?: number | null;
  is_lateral: boolean;
  avg_speed?: string | null;
  incline_percent?: string | null;
  has_speed_intervals: boolean;
  interval_seconds?: number | null;
  interval_count?: number | null;
  interval_speed_high?: string | null;
  interval_speed_low?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExerciseFormData {
  workout_day: number;
  exercise?: number | null;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds?: number | null;
  load?: string | null;
  load_unit: string;
  set_targets: SetTarget[];
  order: number;
  notes?: string | null;
  execution_count?: number | null;
  duration_seconds?: number | null;
  is_lateral?: boolean;
  avg_speed?: string | null;
  incline_percent?: string | null;
  has_speed_intervals?: boolean;
  interval_seconds?: number | null;
  interval_count?: number | null;
  interval_speed_high?: string | null;
  interval_speed_low?: string | null;
  owner: number;
}

export interface WorkoutSession {
  id: number;
  uuid: string;
  workout_day?: number | null;
  workout_day_name?: string | null;
  workout_day_muscle_groups?: string | null;
  date: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  session_exercises: WorkoutSessionExercise[];
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSessionFormData {
  workout_day?: number | null;
  date: string;
  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;
  owner: number;
}

export interface WorkoutSessionExercise {
  id: number;
  uuid: string;
  session: number;
  exercise?: number | null;
  exercise_name: string;
  gif_url?: string | null;
  thumbnail_url?: string | null;
  sets_target: number;
  reps_target_min: number;
  reps_target_max: number;
  load_target?: string | null;
  load_target_unit: string;
  order: number;
  execution_count_target?: number | null;
  duration_target_seconds?: number | null;
  is_lateral: boolean;
  avg_speed_target?: string | null;
  incline_target_percent?: string | null;
  has_speed_intervals: boolean;
  interval_target_seconds?: number | null;
  interval_count_target?: number | null;
  interval_speed_high_target?: string | null;
  interval_speed_low_target?: string | null;
  sets: WorkoutSessionSet[];
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSessionExerciseFormData {
  session: number;
  exercise?: number | null;
  exercise_name: string;
  sets_target: number;
  reps_target_min: number;
  reps_target_max: number;
  load_target?: string | null;
  load_target_unit?: string;
  order: number;
  execution_count_target?: number | null;
  duration_target_seconds?: number | null;
  is_lateral?: boolean;
  avg_speed_target?: string | null;
  incline_target_percent?: string | null;
  has_speed_intervals?: boolean;
  interval_target_seconds?: number | null;
  interval_count_target?: number | null;
  interval_speed_high_target?: string | null;
  interval_speed_low_target?: string | null;
  owner: number;
}

export interface WorkoutSessionSet {
  id: number;
  uuid: string;
  session_exercise: number;
  set_number: number;
  load?: string | null;
  load_unit: string;
  load_unit_display: string;
  reps_done?: number | null;
  duration_seconds?: number | null;
  avg_speed?: string | null;
  incline_percent?: string | null;
  completed: boolean;
  notes?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSessionSetFormData {
  session_exercise: number;
  set_number: number;
  load?: string | null;
  load_unit: string;
  reps_done?: number | null;
  duration_seconds?: number | null;
  avg_speed?: string | null;
  incline_percent?: string | null;
  completed: boolean;
  notes?: string | null;
  owner: number;
}

export interface BodyMetric {
  id: number;
  uuid: string;
  measured_at: string;
  weight_kg: string | null;
  height_cm: string | null;
  waist_cm: string | null;
  neck_cm: string | null;
  arm_cm: string | null;
  hip_cm: string | null;
  shoulders_cm: string | null;
  chest_cm: string | null;
  abdomen_cm: string | null;
  arm_left_cm: string | null;
  arm_right_cm: string | null;
  thigh_left_cm: string | null;
  thigh_right_cm: string | null;
  calf_left_cm: string | null;
  calf_right_cm: string | null;
  skinfold_triceps_mm: string | null;
  skinfold_subscapular_mm: string | null;
  skinfold_suprailiac_mm: string | null;
  skinfold_chest_mm: string | null;
  skinfold_midaxillary_mm: string | null;
  skinfold_abdominal_mm: string | null;
  skinfold_thigh_mm: string | null;
  body_fat_method: 'navy' | 'pollock' | null;
  body_fat_pct: string | null;
  notes: string;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface BodyMetricFormData {
  measured_at: string;
  weight_kg?: string | null;
  height_cm?: string | null;
  waist_cm?: string | null;
  neck_cm?: string | null;
  arm_cm?: string | null;
  hip_cm?: string | null;
  shoulders_cm?: string | null;
  chest_cm?: string | null;
  abdomen_cm?: string | null;
  arm_left_cm?: string | null;
  arm_right_cm?: string | null;
  thigh_left_cm?: string | null;
  thigh_right_cm?: string | null;
  calf_left_cm?: string | null;
  calf_right_cm?: string | null;
  skinfold_triceps_mm?: string | null;
  skinfold_subscapular_mm?: string | null;
  skinfold_suprailiac_mm?: string | null;
  skinfold_chest_mm?: string | null;
  skinfold_midaxillary_mm?: string | null;
  skinfold_abdominal_mm?: string | null;
  skinfold_thigh_mm?: string | null;
  body_fat_method?: 'navy' | 'pollock' | null;
  body_fat_pct?: string | null;
  notes?: string;
  owner: number;
}
