export interface Exercise {
  id: number;
  uuid: string;
  name: string;
  muscle_groups?: string | null;
  description?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseFormData {
  name: string;
  muscle_groups?: string | null;
  description?: string | null;
  owner: number;
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
  order: number;
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
  order: number;
  owner: number;
}

export interface WorkoutExercise {
  id: number;
  uuid: string;
  workout_day: number;
  exercise?: number | null;
  exercise_catalog_name?: string | null;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
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
  sets_target: number;
  reps_target_min: number;
  reps_target_max: number;
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
