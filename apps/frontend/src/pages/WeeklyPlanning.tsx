/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getIconByName } from '@/components/ui/icon-picker';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate } from '@/lib/utils';
import { taskInstancesService } from '@/services/task-instances-service';
import type { TaskInstance } from '@/types';

const OVERLOAD_MINUTES = 480;

const CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-category-health/10 border-category-health/30 text-category-health',
  exercise:
    'bg-category-exercise/10 border-category-exercise/30 text-category-exercise',
  studies: 'bg-category-studies/10 border-category-studies/30 text-category-studies',
  intellect: 'bg-category-studies/10 border-category-studies/30 text-category-studies',
  spiritual:
    'bg-category-spiritual/10 border-category-spiritual/30 text-category-spiritual',
  nutrition:
    'bg-category-nutrition/10 border-category-nutrition/30 text-category-nutrition',
  work: 'bg-category-work/10 border-category-work/30 text-category-work',
  leisure: 'bg-category-leisure/10 border-category-leisure/30 text-category-leisure',
  finance: 'bg-category-finance/10 border-category-finance/30 text-category-finance',
  other: 'bg-muted/30 border-border text-foreground',
};

function getWeekStart(): Date {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function estimateTaskMinutes(task: TaskInstance): number {
  if (!task.scheduled_time || !task.closing_time) return 30;
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMinutes(task.closing_time) - toMinutes(task.scheduled_time);
  return diff > 0 ? diff : diff + 24 * 60;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function InstanceIcon({ name, className }: { name: string; className?: string }) {
  const icon = getIconByName(name);
  if (!icon) return null;
  return createElement(icon, { className });
}

function StatusIcon({ status }: { status: TaskInstance['status'] }) {
  if (status === 'completed')
    return <CheckCircle2 className="text-success h-3 w-3 shrink-0" />;
  if (status === 'in_progress')
    return <Clock className="text-warning h-3 w-3 shrink-0" />;
  if (status === 'skipped')
    return <AlertCircle className="text-muted-foreground h-3 w-3 shrink-0" />;
  return <Circle className="text-muted-foreground h-3 w-3 shrink-0" />;
}

function TaskPill({ instance }: { instance: TaskInstance }) {
  const category = instance.category ?? 'other';
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  const isDone = instance.status === 'completed';

  return (
    <div
      className={cn(
        'gap-xs px-xs flex items-center rounded border py-0.5 text-xs leading-tight transition-opacity',
        colorClass,
        isDone && 'opacity-50'
      )}
      title={instance.task_name}
    >
      <StatusIcon status={instance.status} />
      {instance.scheduled_time && (
        <span className="shrink-0 opacity-70">
          {instance.scheduled_time.slice(0, 5)}
        </span>
      )}
      <p
        className={cn('min-w-0 flex-1 truncate font-medium', isDone && 'line-through')}
      >
        <InstanceIcon name={instance.icon ?? ''} className="mr-xs inline h-3 w-3" />
        {instance.task_name}
      </p>
    </div>
  );
}

export default function WeeklyPlanning() {
  const { t, i18n } = useTranslation();
  const weekStart = getWeekStart();
  const weekEnd = getWeekDays(weekStart)[6];
  const days = getWeekDays(weekStart);

  const dateFrom = formatLocalDate(weekStart);
  const dateTo = formatLocalDate(weekEnd);

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['weekly-planning', dateFrom, dateTo],
    queryFn: () =>
      taskInstancesService.getAll({ date_from: dateFrom, date_to: dateTo }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const instancesByDate = days.reduce<Record<string, TaskInstance[]>>((acc, day) => {
    const key = formatLocalDate(day);
    acc[key] = instances.filter((inst) => inst.scheduled_date === key);
    return acc;
  }, {});

  const loadByDate = days.reduce<Record<string, number>>((acc, day) => {
    const key = formatLocalDate(day);
    const dayInstances = instancesByDate[key] ?? [];
    acc[key] = dayInstances.reduce((sum, inst) => sum + estimateTaskMinutes(inst), 0);
    return acc;
  }, {});

  const today = formatLocalDate(new Date());

  const formatDayMonth = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const weekLabel = `${formatDayMonth(weekStart)} - ${formatDayMonth(weekEnd)}/${weekEnd.getFullYear()}`;

  if (isLoading) return <LoadingState />;

  return (
    <AnimatedPage>
      <PageContainer>
        <div className="mb-md gap-md flex flex-wrap items-center">
          <PageHeader title={t('weeklyPlanning.title')} icon={<Calendar />} />

          <div className="flex min-w-0 flex-1 justify-center">
            {Object.values(loadByDate).some((load) => load > OVERLOAD_MINUTES) && (
              <div className="border-warning/30 bg-warning/5 px-sm py-xs gap-sm flex items-center rounded-lg border">
                <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
                <p className="text-warning text-xs">
                  <strong>{t('weeklyPlanning.overloadWarningTitle')}:</strong>{' '}
                  {t('weeklyPlanning.overloadWarning', {
                    time: formatMinutes(OVERLOAD_MINUTES),
                  })}
                </p>
              </div>
            )}
          </div>

          <span className="text-muted-foreground text-sm">{weekLabel}</span>
        </div>

        {/* 7-day grid */}
        <div className="gap-md grid grid-cols-1 sm:h-[calc(100dvh-13rem)] sm:grid-cols-7">
          {days.map((day) => {
            const key = formatLocalDate(day);
            const dayInsts = instancesByDate[key] ?? [];
            const load = loadByDate[key] ?? 0;
            const isOverloaded = load > OVERLOAD_MINUTES;
            const isToday = key === today;
            const dayCompleted = dayInsts.filter(
              (i) => i.status === 'completed'
            ).length;
            const dayTotal = dayInsts.length;
            const dayPct =
              dayTotal > 0 ? Math.round((dayCompleted / dayTotal) * 100) : 0;

            return (
              <Card key={key} className="flex min-h-0 flex-col">
                <CardHeader className="pb-xs pt-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={cn(
                          'text-xs font-semibold tracking-wide uppercase',
                          isToday ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
                      </p>
                      <div className="gap-xs flex items-center">
                        <p
                          className={cn(
                            'text-base font-bold',
                            isToday && 'text-primary'
                          )}
                        >
                          {day.getDate()}
                        </p>
                        {isToday && (
                          <Badge variant="default" className="text-2xs px-xs py-0">
                            {t('weeklyPlanning.today')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {isOverloaded && (
                        <AlertTriangle
                          className="mb-xs text-warning h-4 w-4"
                          aria-label={t('weeklyPlanning.overloadedDay')}
                        />
                      )}
                      {dayTotal > 0 && (
                        <p className="text-muted-foreground text-xs font-medium">
                          {dayCompleted}/{dayTotal}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Per-day completion progress */}
                  {dayTotal > 0 && (
                    <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full rounded-full transition',
                          dayPct >= 100
                            ? 'bg-success'
                            : dayPct >= 60
                              ? 'bg-primary'
                              : 'bg-muted-foreground/30'
                        )}
                        style={{ width: `${dayPct}%` }}
                      />
                    </div>
                  )}

                  {/* Load bar */}
                  <div className="gap-xs flex items-center">
                    <div
                      className={cn(
                        'h-1 flex-1 rounded-full',
                        isOverloaded ? 'bg-warning/30' : 'bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full transition',
                          isOverloaded ? 'bg-warning' : 'bg-primary/40'
                        )}
                        style={{
                          width: `${Math.min(100, (load / OVERLOAD_MINUTES) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatMinutes(load)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="gap-xs p-sm flex min-h-0 flex-1 flex-col overflow-y-auto pt-0">
                  {dayInsts.length === 0 ? (
                    <p className="text-muted-foreground/50 text-center text-xs">
                      {t('weeklyPlanning.noTasks')}
                    </p>
                  ) : (
                    dayInsts.map((inst) => <TaskPill key={inst.id} instance={inst} />)
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContainer>
    </AnimatedPage>
  );
}
