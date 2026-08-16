/* eslint-disable max-lines */
export interface Exercise {
  id: number;
  uuid: string;
  name: string;
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
  is_active: boolean;
  owner: number;
}

export interface WorkoutDay {
  id: number;
  uuid: string;
  plan: number;
  name: string;
  muscle_groups?: string | null;
  day_of_week?: number | null;
  order: number;
  default_start_time?: string | null;
  default_duration_minutes?: number | null;
  exercises: WorkoutExercise[];
  exercise_count: number;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutDayFormData {
  plan: number;
  name: string;
  muscle_groups?: string | null;
  day_of_week?: number | null;
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
  order: number;
  notes?: string | null;
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
  order: number;
  notes?: string | null;
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
