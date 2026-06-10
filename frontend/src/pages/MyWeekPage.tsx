/* eslint-disable max-lines */
import { useQueries } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  CalendarDays,
  Zap,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getIconByName } from '@/components/ui/icon-picker';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate } from '@/lib/utils';
import { taskInstancesService } from '@/services/task-instances-service';
import type { TaskInstance } from '@/types';

const CATEGORY_BG: Record<string, string> = {
  health: 'bg-category-health/10 border-category-health/30 text-category-health',
  studies: 'bg-category-studies/10 border-category-studies/30 text-category-studies',
  spiritual:
    'bg-category-spiritual/10 border-category-spiritual/30 text-category-spiritual',
  exercise:
    'bg-category-exercise/10 border-category-exercise/30 text-category-exercise',
  nutrition:
    'bg-category-nutrition/10 border-category-nutrition/30 text-category-nutrition',
  work: 'bg-category-work/10 border-category-work/30 text-category-work',
  leisure: 'bg-category-leisure/10 border-category-leisure/30 text-category-leisure',
  finance: 'bg-category-finance/10 border-category-finance/30 text-category-finance',
  other: 'bg-muted/40 border-border text-muted-foreground',
};

function getWeekDates(referenceMonday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(referenceMonday);
    d.setDate(referenceMonday.getDate() + i);
    return d;
  });
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function StatusIcon({ status }: { status: TaskInstance['status'] }) {
  if (status === 'completed')
    return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === 'in_progress') return <Clock className="h-3.5 w-3.5 text-warning" />;
  if (status === 'skipped')
    return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

interface DayColumnProps {
  date: Date;
  instances: TaskInstance[];
  isToday: boolean;
  isLoading: boolean;
}

function DayColumn({ date, instances, isToday, isLoading }: DayColumnProps) {
  const { t } = useTranslation();
  const completedCount = instances.filter((i) => i.status === 'completed').length;
  const totalCount = instances.length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isOverloaded = totalCount > 8;

  const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'short' });
  const dayNum = date.getDate();
  const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short' });

  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-1 flex-col rounded-lg border bg-card',
        isToday && 'border-primary ring-1 ring-primary/20',
        isOverloaded && 'border-warning/40'
      )}
    >
      {/* Day header */}
      <div
        className={cn(
          'flex items-center justify-between rounded-t-lg px-sm py-xs',
          isToday ? 'bg-primary/5' : 'bg-muted/30'
        )}
      >
        <div>
          <p
            className={cn(
              'text-xs font-semibold uppercase',
              isToday ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {dayLabel}
          </p>
          <p className={cn('text-lg font-bold', isToday && 'text-primary')}>{dayNum}</p>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="text-right">
          {isOverloaded && (
            <Zap
              className="mb-xs h-4 w-4 text-warning"
              aria-label={t('pages.myWeekPage.overloaded')}
            />
          )}
          <p className="text-xs font-medium text-muted-foreground">
            {completedCount}/{totalCount}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className={cn(
            'h-full rounded-r transition-all',
            completionPct >= 100
              ? 'bg-success'
              : completionPct >= 60
                ? 'bg-primary'
                : 'bg-muted-foreground/30'
          )}
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Tasks */}
      <div className="flex-1 space-y-xs overflow-y-auto p-xs">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : instances.length === 0 ? (
          <p className="py-md text-center text-xs text-muted-foreground">
            {t('pages.myWeekPage.noTasks')}
          </p>
        ) : (
          instances.map((instance) => {
            const Icon = getIconByName(instance.icon ?? '');
            const categoryClass = CATEGORY_BG[instance.category] ?? CATEGORY_BG.other;

            return (
              <motion.div
                key={instance.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'flex items-start gap-xs rounded border px-xs py-xs text-xs',
                  categoryClass,
                  instance.status === 'completed' && 'opacity-60'
                )}
              >
                <StatusIcon status={instance.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate font-medium leading-tight',
                      instance.status === 'completed' && 'line-through'
                    )}
                  >
                    {Icon && <Icon className="mr-xs inline h-3 w-3" />}
                    {instance.task_name}
                  </p>
                  {instance.scheduled_time && (
                    <p className="text-[10px] opacity-70">{instance.time_display}</p>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function MyWeekPage() {
  const { t } = useTranslation();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(today));

  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);

  const weekDateStrings = useMemo(
    () => weekDates.map((d) => formatLocalDate(d)),
    [weekDates]
  );

  const dayQueries = useQueries({
    queries: weekDateStrings.map((dateStr) => ({
      queryKey: ['taskInstances', 'week', dateStr],
      queryFn: () => taskInstancesService.getForDate(dateStr, false),
      staleTime: STALE_TIMES.DEFAULT_LIST,
    })),
  });

  const weekInstances = dayQueries.map((q) => q.data?.instances ?? []);
  const totalCompleted = weekInstances
    .flat()
    .filter((i) => i.status === 'completed').length;
  const totalTasks = weekInstances.flat().length;
  const weekPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const isCurrentWeek =
    currentMonday.toDateString() === getMondayOfWeek(today).toDateString();

  const goToPrevWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToCurrentWeek = () => {
    setCurrentMonday(getMondayOfWeek(today));
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.myWeekPage.title')}
          description={t('pages.myWeekPage.description')}
          icon={<CalendarDays className="h-6 w-6 text-primary" />}
        />

        {/* Week navigation + progress */}
        <div className="mb-lg flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-sm">
            <Button size="icon" variant="outline" onClick={goToPrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[200px] text-center">
              <p className="text-sm font-semibold">{weekLabel}</p>
              {isCurrentWeek && (
                <p className="text-xs text-primary">
                  {t('pages.myWeekPage.currentWeek')}
                </p>
              )}
            </div>
            <Button size="icon" variant="outline" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button size="sm" variant="ghost" onClick={goToCurrentWeek}>
                {t('pages.myWeekPage.goToToday')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-sm">
            <Badge variant="secondary">
              {totalCompleted}/{totalTasks} {t('pages.myWeekPage.completed')}
            </Badge>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  weekPct >= 100 ? 'bg-success' : 'bg-primary'
                )}
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <span className="text-sm font-medium">{weekPct}%</span>
          </div>
        </div>

        {/* 7-day grid */}
        <div className="flex gap-xs overflow-x-auto pb-md">
          {weekDates.map((date, idx) => (
            <DayColumn
              key={idx}
              date={date}
              instances={weekInstances[idx]}
              isToday={date.toDateString() === today.toDateString()}
              isLoading={dayQueries[idx].isLoading}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-md flex flex-wrap items-center gap-sm text-xs text-muted-foreground">
          <span>{t('pages.myWeekPage.legend')}:</span>
          <span className="flex items-center gap-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {t('pages.myWeekPage.statusCompleted')}
          </span>
          <span className="flex items-center gap-xs">
            <Clock className="h-3.5 w-3.5 text-warning" />
            {t('pages.myWeekPage.statusInProgress')}
          </span>
          <span className="flex items-center gap-xs">
            <Circle className="h-3.5 w-3.5" />
            {t('pages.myWeekPage.statusPending')}
          </span>
          <span className="flex items-center gap-xs">
            <Zap className="h-3.5 w-3.5 text-warning" />
            {t('pages.myWeekPage.overloaded')}
          </span>
        </div>
      </PageContainer>
    </AnimatedPage>
  );
}
