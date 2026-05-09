import {
  CheckSquare,
  AlertTriangle,
  Receipt,
  HandCoins,
  CreditCard,
  PiggyBank,
  Target,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

const iconMap: Record<string, React.ElementType> = {
  task_today: CheckSquare,
  task_overdue: AlertTriangle,
  payable_due_soon: Receipt,
  payable_overdue: Receipt,
  loan_due_soon: HandCoins,
  loan_overdue: HandCoins,
  bill_due_soon: CreditCard,
  bill_overdue: CreditCard,
  budget_warning: PiggyBank,
  budget_exceeded: PiggyBank,
  financial_goal_reached: Target,
  financial_goal_approaching: Target,
};

const colorMap: Record<string, string> = {
  task_today: 'text-primary',
  task_overdue: 'text-destructive',
  payable_due_soon: 'text-warning',
  payable_overdue: 'text-destructive',
  loan_due_soon: 'text-warning',
  loan_overdue: 'text-destructive',
  bill_due_soon: 'text-warning',
  bill_overdue: 'text-destructive',
  budget_warning: 'text-warning',
  budget_exceeded: 'text-destructive',
  financial_goal_reached: 'text-primary',
  financial_goal_approaching: 'text-warning',
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
}: NotificationItemProps) {
  const Icon = iconMap[notification.notification_type] || AlertTriangle;
  const iconColor = colorMap[notification.notification_type] || 'text-muted-foreground';

  return (
    <button
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-md py-3 text-left transition-colors hover:bg-accent',
        !notification.is_read && 'bg-accent/50'
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkAsRead(notification.id);
        }
      }}
    >
      <div className={cn('mt-0.5 shrink-0', iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-sm">
          <p
            className={cn('truncate text-sm', !notification.is_read && 'font-semibold')}
          >
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        {notification.message && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {notification.message}
          </p>
        )}
      </div>
    </button>
  );
}
