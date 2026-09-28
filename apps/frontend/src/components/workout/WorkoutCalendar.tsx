import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { buildWorkoutEvents } from '@/lib/workout-calendar';
import type { WorkoutCalendarEvent, WorkoutEventStatus } from '@/lib/workout-calendar';
import { workoutSessionService } from '@/services/workout-service';
import type { WorkoutPlan } from '@/types/workout';

const STATUS_VARIANTS: Record<
  WorkoutEventStatus,
  'success' | 'warning' | 'destructive'
> = {
  completed: 'success',
  pending: 'warning',
  missed: 'destructive',
};

const STATUS_DOT: Record<WorkoutEventStatus, string> = {
  completed: 'bg-success',
  pending: 'bg-warning',
  missed: 'bg-destructive',
};

export function WorkoutCalendar({ plans }: { plans: WorkoutPlan[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startStr = format(monthStart, 'yyyy-MM-dd');
  const endStr = format(monthEnd, 'yyyy-MM-dd');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['workout-sessions', 'calendar', startStr, endStr],
    queryFn: () =>
      workoutSessionService.getAllPages({ date_from: startStr, date_to: endStr }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startStr]
  );

  const events = useMemo(
    () =>
      buildWorkoutEvents(
        plans,
        sessions,
        monthDays.map((d) => format(d, 'yyyy-MM-dd')),
        format(new Date(), 'yyyy-MM-dd')
      ),
    [plans, sessions, monthDays]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, WorkoutCalendarEvent[]> = {};
    for (const ev of events) (map[ev.date] ??= []).push(ev);
    return map;
  }, [events]);

  const counts = { completed: 0, pending: 0, missed: 0 };
  for (const ev of events) counts[ev.status] += 1;

  const weekdayLabels = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), 'EEEEEE', { locale })
    );
  }, [locale]);

  const selectedEvents = selectedDay
    ? (eventsByDate[format(selectedDay, 'yyyy-MM-dd')] ?? [])
    : [];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-md">
      <div className="bg-muted/30 px-md py-sm text-muted-foreground rounded-lg border text-sm font-medium">
        {t('workoutCalendar.summary', {
          done: counts.completed,
          pending: counts.pending,
          missed: counts.missed,
        })}
      </div>

      <Card>
        <CardHeader className="pb-sm">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate((d) => subMonths(d, 1))}
              aria-label={t('financialCalendar.prevMonth')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle as="h2" className="capitalize">
              {format(currentDate, 'MMMM yyyy', { locale })}
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate((d) => addMonths(d, 1))}
              aria-label={t('financialCalendar.nextMonth')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {weekdayLabels.map((d) => (
              <div
                key={d}
                className="py-sm text-muted-foreground text-center text-xs font-semibold uppercase"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: getDay(monthStart) }, (_, i) => (
              <div key={`blank-${i}`} className="min-h-[72px]" />
            ))}
            {monthDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[key] ?? [];
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    'p-xs bg-card hover:bg-accent/50 min-h-[72px] rounded-lg border text-left transition-colors',
                    isSelected && 'border-primary bg-primary/5',
                    isToday && !isSelected && 'border-primary/50'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-xs flex flex-wrap gap-0.5">
                      {dayEvents.map((ev) => (
                        <span
                          key={ev.id}
                          className={cn(
                            'inline-block h-1.5 w-1.5 rounded-full',
                            STATUS_DOT[ev.status]
                          )}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-md gap-md flex flex-wrap">
            {(Object.keys(STATUS_DOT) as WorkoutEventStatus[]).map((status) => (
              <div
                key={status}
                className="gap-xs text-muted-foreground flex items-center text-xs"
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT[status])} />
                {t(`workoutCalendar.status.${status}`)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader className="pb-sm">
            <div className="flex items-center justify-between">
              <CardTitle as="h3">
                {t('workoutCalendar.dayDetail', {
                  date: format(selectedDay, "dd 'de' MMMM", { locale }),
                })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="py-md text-muted-foreground text-center text-sm">
                {t('workoutCalendar.noEvents')}
              </p>
            ) : (
              <div className="space-y-sm">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-sm flex items-center justify-between rounded-lg border"
                  >
                    <span className="text-foreground text-sm font-medium">
                      {ev.title ?? t('workoutCalendar.extraSession')}
                    </span>
                    <Badge variant={STATUS_VARIANTS[ev.status]} className="text-xs">
                      {t(`workoutCalendar.status.${ev.status}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
