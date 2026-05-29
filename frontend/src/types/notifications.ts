export type NotificationType =
  | 'task_today'
  | 'task_overdue'
  | 'payable_due_soon'
  | 'payable_overdue'
  | 'loan_due_soon'
  | 'loan_overdue'
  | 'bill_due_soon'
  | 'bill_overdue'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'financial_goal_reached'
  | 'financial_goal_approaching';

export interface Notification {
  id: number;
  uuid: string;
  notification_type: NotificationType;
  notification_type_display: string;
  title: string;
  message: string;
  is_read: boolean;
  due_date: string | null;
  content_type: string;
  object_id: number;
  created_at: string;
}

export interface NotificationSummary {
  unread_count: number;
}

export type NotificationChannel = 'in_app' | 'email' | 'both';

export interface NotificationPreference {
  id: number;
  uuid: string;
  notification_type: NotificationType;
  notification_type_display: string;
  channel: NotificationChannel;
  channel_display: string;
}

export type CreateNotificationPreference = Pick<
  NotificationPreference,
  'notification_type' | 'channel'
>;

export type UpdateNotificationPreference = Pick<NotificationPreference, 'channel'>;
