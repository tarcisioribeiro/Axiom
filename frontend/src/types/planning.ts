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
  linked_book?: number | null;
  linked_book_title?: string | null;
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
  linked_book?: number | null;
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
