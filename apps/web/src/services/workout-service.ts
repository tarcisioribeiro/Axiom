import { API_CONFIG } from '@/config/api-config';
import type { PaginatedResponse } from '@/types';
import type {
  BodyMetric,
  BodyMetricFormData,
  Exercise,
  ExerciseDatasetEntry,
  ExerciseFormData,
  WorkoutDay,
  WorkoutDayFormData,
  WorkoutExercise,
  WorkoutExerciseFormData,
  WorkoutPlan,
  WorkoutPlanFormData,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionExerciseFormData,
  WorkoutSessionFormData,
  WorkoutSessionSet,
  WorkoutSessionSetFormData,
} from '@/types/workout';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class ExerciseService extends BaseService<Exercise, ExerciseFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.EXERCISES);
  }

  /** Busca somente-leitura no catálogo vendorizado do dataset de
   * exercícios (hasaneyldrm/exercises-dataset) — usada pelo picker de
   * imagens. Não é CRUD, por isso fica fora do BaseService. */
  async searchDataset(params?: {
    search?: string;
    category?: string;
    body_part?: string;
    target?: string;
    equipment?: string;
    page?: number;
  }): Promise<PaginatedResponse<ExerciseDatasetEntry>> {
    return apiClient.get<PaginatedResponse<ExerciseDatasetEntry>>(
      API_CONFIG.ENDPOINTS.EXERCISE_DATASET,
      params
    );
  }
}

class WorkoutPlanService extends BaseService<WorkoutPlan, WorkoutPlanFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WORKOUT_PLANS);
  }
}

class WorkoutDayService extends BaseService<WorkoutDay, WorkoutDayFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WORKOUT_DAYS);
  }

  async getByPlan(planId: number): Promise<WorkoutDay[]> {
    return this.getAll({ plan: planId });
  }
}

class WorkoutExerciseService extends BaseService<
  WorkoutExercise,
  WorkoutExerciseFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WORKOUT_EXERCISES);
  }

  async getByDay(workoutDayId: number): Promise<WorkoutExercise[]> {
    return this.getAll({ workout_day: workoutDayId });
  }
}

class WorkoutSessionService extends BaseService<
  WorkoutSession,
  WorkoutSessionFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WORKOUT_SESSIONS);
  }

  async getByDateRange(dateFrom: string, dateTo: string): Promise<WorkoutSession[]> {
    return this.getAll({ date_from: dateFrom, date_to: dateTo });
  }
}

class WorkoutSessionExerciseService extends BaseService<
  WorkoutSessionExercise,
  WorkoutSessionExerciseFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WORKOUT_SESSION_EXERCISES);
  }

  async getBySession(sessionId: number): Promise<WorkoutSessionExercise[]> {
    return this.getAll({ session: sessionId });
  }
}

class WorkoutSessionSetService extends BaseService<
  WorkoutSessionSet,
  WorkoutSessionSetFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WORKOUT_SESSION_SETS);
  }

  async getBySessionExercise(sessionExerciseId: number): Promise<WorkoutSessionSet[]> {
    return this.getAll({ session_exercise: sessionExerciseId });
  }
}

class BodyMetricService extends BaseService<BodyMetric, BodyMetricFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.BODY_METRICS);
  }
}

export const exerciseService = new ExerciseService();
export const workoutPlanService = new WorkoutPlanService();
export const workoutDayService = new WorkoutDayService();
export const workoutExerciseService = new WorkoutExerciseService();
export const workoutSessionService = new WorkoutSessionService();
export const workoutSessionExerciseService = new WorkoutSessionExerciseService();
export const workoutSessionSetService = new WorkoutSessionSetService();
export const bodyMetricService = new BodyMetricService();
