/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate } from '@/lib/utils';
import { taskInstancesService } from '@/services/task-instances-service';
import type { TaskInstance } from '@/types';

const OVERLOAD_MINUTES = 240;

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
  finance: 'bg-category-finance/10 border-category-finance/30 text-category-finance',
  other: 'bg-muted/30 border-border text-foreground',
};

function getWeekStart(offset: number = 0): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function estimateTaskMinutes(_task: TaskInstance): number {
  return 30;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function WeeklyPlanning() {
  const { t, i18n } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);
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

  const weekLabel = (() => {
    const locale = i18n.language;
    const start = weekStart.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
    });
    const end = weekEnd.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `${start} – ${end}`;
  })();

  const totalTasks = instances.length;
  const completedTasks = instances.filter((i) => i.status === 'completed').length;

  if (isLoading) return <LoadingState />;

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('weeklyPlanning.title')}
          icon={<Calendar />}
          subtitle={weekLabel}
        >
          <div className="flex items-center gap-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              {t('weeklyPlanning.thisWeek')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </PageHeader>

        {/* Week summary */}
        <div className="mb-md grid grid-cols-3 gap-md">
          <Card>
            <CardContent className="flex items-center gap-sm p-md">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{totalTasks}</p>
                <p className="text-xs text-muted-foreground">
                  {t('weeklyPlanning.tasks')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-sm p-md">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-lg font-bold">{completedTasks}</p>
                <p className="text-xs text-muted-foreground">
                  {t('weeklyPlanning.completed')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-sm p-md">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">
                  {formatMinutes(Object.values(loadByDate).reduce((s, v) => s + v, 0))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('weeklyPlanning.estimatedLoad')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 7-day grid */}
        <div className="grid grid-cols-1 gap-md sm:grid-cols-7">
          {days.map((day) => {
            const key = formatLocalDate(day);
            const dayInsts = instancesByDate[key] ?? [];
            const load = loadByDate[key] ?? 0;
            const isOverloaded = load > OVERLOAD_MINUTES;
            const isToday = key === today;

            return (
              <Card
                key={key}
                className={cn(
                  'flex flex-col',
                  isToday && 'ring-2 ring-primary/60',
                  isOverloaded && 'border-warning/40'
                )}
              >
                <CardHeader className="pb-xs pt-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={cn(
                          'text-xs font-semibold uppercase tracking-wide',
                          isToday ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
                      </p>
                      <p
                        className={cn('text-base font-bold', isToday && 'text-primary')}
                      >
                        {day.getDate()}
                      </p>
                    </div>
                    {isOverloaded && (
                      <AlertTriangle
                        className="h-4 w-4 text-warning"
                        aria-label={t('weeklyPlanning.overloadedDay')}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-xs">
                    <div
                      className={cn(
                        'h-1 flex-1 rounded-full',
                        isOverloaded ? 'bg-warning/30' : 'bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          isOverloaded ? 'bg-warning' : 'bg-primary'
                        )}
                        style={{
                          width: `${Math.min(100, (load / OVERLOAD_MINUTES) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatMinutes(load)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-xs p-sm pt-0">
                  {dayInsts.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground/50">
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

        {Object.values(loadByDate).some((load) => load > OVERLOAD_MINUTES) && (
          <div className="mt-md rounded-lg border border-warning/30 bg-warning/5 p-md">
            <div className="flex items-center gap-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <p className="text-sm text-warning">
                <strong>{t('weeklyPlanning.overloadWarningTitle')}:</strong>{' '}
                {t('weeklyPlanning.overloadWarning', {
                  time: formatMinutes(OVERLOAD_MINUTES),
                })}
              </p>
            </div>
          </div>
        )}
      </PageContainer>
    </AnimatedPage>
  );
}

function TaskPill({ instance }: { instance: TaskInstance }) {
  const category = instance.category ?? 'other';
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  const isDone = instance.status === 'completed';

  return (
    <div
      className={cn(
        'rounded border px-xs py-xs text-xs leading-tight transition-opacity',
        colorClass,
        isDone && 'line-through opacity-50'
      )}
      title={instance.task_name}
    >
      <span className="block truncate">{instance.task_name}</span>
      {instance.scheduled_time && (
        <span className="opacity-70">{instance.scheduled_time}</span>
      )}
    </div>
  );
}
