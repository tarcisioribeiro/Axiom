import { CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { TaskCategoryBadge } from '@/components/today-tasks/TaskCategoryBadge';
import { getStatusBadge } from '@/components/today-tasks/taskCategoryUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { translate } from '@/config/constants';
import { formatLocalDate, parseLocalDate, cn } from '@/lib/utils';
import type { TaskInstance } from '@/types';

interface TodayListViewProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  tasks: TaskInstance[];
  updatingTaskId: number | null;
  isLoading: boolean;
  onToggleComplete: (task: TaskInstance) => void;
  onSync: () => void;
}

export function TodayListView({
  selectedDate,
  onDateChange,
  tasks,
  updatingTaskId,
  isLoading,
  onToggleComplete,
  onSync,
}: TodayListViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-end gap-sm">
        <div>
          <Label htmlFor="list-date">{t('common.fields.date')}</Label>
          <DatePicker
            value={selectedDate ? parseLocalDate(selectedDate) : undefined}
            onChange={(date) => onDateChange(date ? formatLocalDate(date) : '')}
            placeholder={t('pages.dailyChecklist.datePlaceholder')}
            className="max-w-xs"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onSync}
          disabled={isLoading}
          title={t('pages.dailyChecklist.syncBtn')}
          aria-label={t('pages.dailyChecklist.syncBtn')}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
          message={t('pages.todayTasks.emptyState')}
        />
      ) : (
        <div className="space-y-sm">
          {tasks.map((task) => {
            const badge = getStatusBadge(task.status, t);
            const isCompleted = task.status === 'completed';
            const isUpdating = updatingTaskId === task.id;
            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-md rounded-lg border p-md transition-opacity',
                  isCompleted && 'opacity-60'
                )}
              >
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onToggleComplete(task)}
                  title={
                    isCompleted
                      ? t('pages.todayTasks.markPending')
                      : t('pages.todayTasks.markCompleted')
                  }
                  className="shrink-0 text-muted-foreground hover:text-primary disabled:opacity-50"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : (
                    <Circle className="h-6 w-6" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-sm">
                    <h3 className={cn('font-semibold', isCompleted && 'line-through')}>
                      {task.task_name}
                    </h3>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  {(task.time_display || task.closing_time) && (
                    <p className="text-sm text-muted-foreground">
                      {task.time_display &&
                        t('pages.todayTasks.timeLabel', { time: task.time_display })}
                      {task.closing_time && (
                        <span>
                          {task.time_display ? ' — ' : ''}
                          {t('pages.todayTasks.closingTimeLabel', {
                            time: task.closing_time.substring(0, 5),
                          })}
                        </span>
                      )}
                    </p>
                  )}
                  {task.notes && (
                    <p className="text-sm text-muted-foreground">{task.notes}</p>
                  )}
                </div>
                {task.category && (
                  <TaskCategoryBadge
                    icon={task.icon}
                    label={translate('taskCategories', task.category)}
                    category={task.category}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
