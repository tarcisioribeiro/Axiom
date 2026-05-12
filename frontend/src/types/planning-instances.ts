import type { RoutineTask } from './planning';
import type { InstanceStatus, TaskPriority } from './planning-constants';

export interface Goal {
  id: number;
  uuid: string;
  title: string;
  description?: string;
  goal_type: string;
  goal_type_display: string;
  related_task?: number;
  related_task_name?: string;
  target_value: number;
  current_value: number;
  calculated_current_value?: number;
  start_date: string;
  end_date?: string;
  status: string;
  status_display: string;
  progress_percentage: number;
  days_active: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface GoalFormData {
  title: string;
  description?: string;
  goal_type: string;
  related_task?: number;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date?: string;
  status: string;
  owner: number;
}

export interface DailyReflection {
  id: number;
  uuid: string;
  date: string;
  reflection: string;
  mood?: string;
  mood_display?: string;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReflectionFormData {
  date: string;
  reflection: string;
  mood?: string;
  owner: number;
}

export interface TaskInstance {
  id: number;
  uuid: string;
  template?: number | null;
  template_name?: string | null;
  task_name: string;
  task_description?: string | null;
  category: string;
  category_display: string;
  icon?: string | null;
  priority: TaskPriority;
  priority_display: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  time_display?: string | null;
  occurrence_index: number;
  status: InstanceStatus;
  status_display: string;
  target_quantity: number;
  quantity_completed: number;
  unit: string;
  notes?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  is_overdue: boolean;
  closing_time?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface TaskInstanceFormData {
  task_name: string;
  task_description?: string;
  category: string;
  scheduled_date: string;
  scheduled_time?: string;
  target_quantity?: number;
  unit?: string;
  owner: number;
}

export interface TaskInstanceUpdateData {
  status?: InstanceStatus;
  quantity_completed?: number;
  notes?: string;
}

export interface InstancesForDateResponse {
  date: string;
  instances: TaskInstance[];
  summary: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    skipped: number;
    completion_rate: number;
  };
}

export interface TaskInstanceBulkUpdate {
  id: number;
  status: InstanceStatus;
  notes?: string;
}

export interface TaskInstanceBulkUpdateResponse {
  updated_count: number;
  updated: TaskInstance[];
  errors: Array<{ id: number; error: string }>;
}

export interface WeekdayAnalytics {
  weekday: number;
  weekday_display: string;
  total: number;
  completed: number;
  rate: number | null;
}

export type HabitInsightType =
  | 'best_day'
  | 'worst_day'
  | 'weekend_drop'
  | 'weekend_better'
  | 'overall_excellent'
  | 'overall_low';

export interface HabitInsight {
  type: HabitInsightType;
  weekday?: number;
  rate?: number;
  weekend_rate?: number;
  weekday_rate?: number;
  diff?: number;
}

export interface PersonalPlanningAnalytics {
  period_days: number;
  completion_by_weekday: WeekdayAnalytics[];
  insights: HabitInsight[];
}

export interface PersonalPlanningDashboardStats {
  total_tasks: number;
  active_tasks: number;
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  completion_rate_7d: number;
  completion_rate_30d: number;
  current_streak: number;
  best_streak: number;
  tasks_by_category: Array<{
    category: string;
    category_display: string;
    count: number;
  }>;
  weekly_progress: Array<{
    date: string;
    total: number;
    completed: number;
    rate: number;
  }>;
  active_goals_progress: Array<{
    title: string;
    progress_percentage: number;
    current_value: number;
    target_value: number;
    days_active: number;
  }>;
  total_tasks_today: number;
  completed_tasks_today: number;
  active_routine_tasks: RoutineTask[];
  recent_reflections: DailyReflection[];
}
