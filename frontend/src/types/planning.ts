import type { InstanceStatus, KanbanStatus, TaskPriority } from './planning-constants';

export type { InstanceStatus, KanbanStatus, TaskPriority };

export interface RoutineTask {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  category: string;
  category_display: string;
  icon?: string | null;
  periodicity: string;
  periodicity_display: string;
  weekday?: number;
  weekday_display?: string;
  day_of_month?: number;
  custom_weekdays?: number[] | null;
  custom_month_days?: number[] | null;
  times_per_week?: number | null;
  times_per_month?: number | null;
  interval_days?: number | null;
  interval_start_date?: string | null;
  default_time?: string | null;
  closing_time?: string | null;
  daily_occurrences: number;
  interval_hours?: number | null;
  scheduled_times?: string[] | null;
  is_active: boolean;
  priority: TaskPriority;
  priority_display: string;
  allowed_skips_per_month: number;
  target_quantity: number;
  unit: string;
  unit_display?: string;
  completion_rate: number;
  total_completions: number;
  linked_financial_goal?: number | null;
  linked_financial_goal_description?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineTaskFormData {
  name: string;
  description?: string;
  category: string;
  icon?: string | null;
  periodicity: string;
  weekday?: number;
  day_of_month?: number;
  custom_weekdays?: number[] | null;
  custom_month_days?: number[] | null;
  times_per_week?: number | null;
  times_per_month?: number | null;
  interval_days?: number | null;
  interval_start_date?: string | null;
  default_time?: string | null;
  closing_time?: string | null;
  daily_occurrences?: number;
  interval_hours?: number | null;
  scheduled_times?: string[] | null;
  is_active: boolean;
  priority: TaskPriority;
  allowed_skips_per_month: number;
  target_quantity: number;
  unit: string;
  linked_financial_goal?: number | null;
  owner: number;
}

export interface RoutineTemplateTask {
  name: string;
  description?: string;
  category: string;
  icon?: string | null;
  periodicity: string;
  weekday?: number;
  day_of_month?: number;
  custom_weekdays?: number[] | null;
  target_quantity: number;
  unit: string;
  default_time?: string | null;
  daily_occurrences?: number;
  is_active?: boolean;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  task_count: number;
  tasks: RoutineTemplateTask[];
}

export interface RoutineTemplateImportResult {
  created_ids: number[];
  skipped_names: string[];
  template_name: string;
}

export interface HeatmapDay {
  date: string;
  completed: number;
  expected: number;
  is_scheduled: boolean;
}

export interface HeatmapData {
  year: number;
  task_id: string | null;
  task_name: string | null;
  data: HeatmapDay[];
}

export interface TaskCard {
  id: string;
  task_id: number;
  task_name: string;
  description?: string;
  category: string;
  category_display: string;
  icon?: string | null;
  unit: string;
  index: number;
  total_instances: number;
  status: KanbanStatus;
  notes?: string;
  record_id?: number;
  scheduled_time?: string;
  closing_time?: string;
}

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
  deadline?: string | null;
  days_until_deadline?: number | null;
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
  deadline?: string | null;
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

export interface PersonalPlanningAnalytics {
  period_days: number;
  completion_by_weekday: WeekdayAnalytics[];
  insights: string[];
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
