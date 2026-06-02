/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  addMonths,
  subMonths,
  isSameDay,
} from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { loansService } from '@/services/loans-service';
import { payablesService } from '@/services/payables-service';
import { receivablesService } from '@/services/receivables-service';
import type { Payable, Receivable, Loan, CreditCardBill } from '@/types';

type EventType = 'payable' | 'receivable' | 'creditCard' | 'loan';

interface CalendarEvent {
  id: string;
  type: EventType;
  description: string;
  value: number;
  date: string;
}

const EVENT_COLORS: Record<EventType, string> = {
  payable: 'bg-destructive/15 text-destructive border-destructive/30',
  receivable: 'bg-success/15 text-success border-success/30',
  creditCard: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  loan: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
};

const EVENT_DOT_COLORS: Record<EventType, string> = {
  payable: 'bg-destructive',
  receivable: 'bg-success',
  creditCard: 'bg-orange-500',
  loan: 'bg-purple-500',
};

export default function FinancialCalendar() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startStr = format(monthStart, 'yyyy-MM-dd');
  const endStr = format(monthEnd, 'yyyy-MM-dd');

  const payablesQuery = useQuery({
    queryKey: ['payables', 'calendar'],
    queryFn: () => payablesService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const receivablesQuery = useQuery({
    queryKey: ['receivables', 'calendar'],
    queryFn: () => receivablesService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const loansQuery = useQuery({
    queryKey: ['loans', 'calendar'],
    queryFn: () => loansService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const billsQuery = useQuery({
    queryKey: ['creditCardBills', 'calendar'],
    queryFn: () => creditCardBillsService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading =
    payablesQuery.isLoading ||
    receivablesQuery.isLoading ||
    loansQuery.isLoading ||
    billsQuery.isLoading;

  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    (payablesQuery.data ?? []).forEach((p: Payable) => {
      if (
        p.due_date &&
        p.status !== 'paid' &&
        p.status !== 'cancelled' &&
        p.due_date >= startStr &&
        p.due_date <= endStr
      ) {
        result.push({
          id: `payable-${p.id}`,
          type: 'payable',
          description: p.description,
          value: parseFloat(p.value),
          date: p.due_date,
        });
      }
    });

    (receivablesQuery.data ?? []).forEach((r: Receivable) => {
      if (
        r.due_date &&
        r.status !== 'received' &&
        r.status !== 'cancelled' &&
        r.due_date >= startStr &&
        r.due_date <= endStr
      ) {
        result.push({
          id: `receivable-${r.id}`,
          type: 'receivable',
          description: r.description,
          value: parseFloat(r.value),
          date: r.due_date,
        });
      }
    });

    (loansQuery.data ?? []).forEach((l: Loan) => {
      if (l.due_date && l.status !== 'paid') {
        const due = l.due_date;
        if (due >= startStr && due <= endStr) {
          result.push({
            id: `loan-${l.id}`,
            type: 'loan',
            description: l.description,
            value: parseFloat(l.value),
            date: due,
          });
        }
      }
    });

    (billsQuery.data ?? []).forEach((b: CreditCardBill) => {
      if (b.due_date && b.status !== 'paid') {
        const due = b.due_date;
        if (due >= startStr && due <= endStr) {
          result.push({
            id: `bill-${b.id}`,
            type: 'creditCard',
            description: `${b.credit_card_name ?? 'Cartão'} — ${b.month}/${b.year}`,
            value: parseFloat(b.total_amount),
            date: due,
          });
        }
      }
    });

    return result;
  }, [
    payablesQuery.data,
    receivablesQuery.data,
    loansQuery.data,
    billsQuery.data,
    startStr,
    endStr,
  ]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = getDay(monthStart);
    const leadingBlanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
    return { days, leadingBlanks };
  }, [monthStart, monthEnd]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return eventsByDate[key] ?? [];
  }, [selectedDay, eventsByDate]);

  const totalEventsThisMonth = events.length;

  if (isLoading) return <LoadingState fullScreen />;

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('financialCalendar.title')}
          icon={<CalendarDays />}
          subtitle={t('financialCalendar.subtitle')}
        />

        <div className="mt-md rounded-lg border bg-muted/30 px-md py-sm text-sm font-medium text-muted-foreground">
          {t('financialCalendar.summaryDue', { count: totalEventsThisMonth })}
        </div>

        <Card className="mt-md">
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
                {format(currentDate, 'MMMM yyyy', { locale: dateFnsLocale })}
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
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div
                  key={d}
                  className="py-sm text-center text-xs font-semibold uppercase text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {calendarDays.leadingBlanks.map((i) => (
                <div key={`blank-${i}`} className="min-h-[80px]" />
              ))}

              {calendarDays.days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate[key] ?? [];
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={cn(
                      'min-h-[80px] rounded-lg border p-xs text-left transition-colors',
                      isCurrentMonth
                        ? 'bg-card hover:bg-accent/50'
                        : 'bg-muted/20 text-muted-foreground',
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
                        {dayEvents.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className={cn(
                              'inline-block h-1.5 w-1.5 rounded-full',
                              EVENT_DOT_COLORS[ev.type]
                            )}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-md flex flex-wrap gap-md">
              {(Object.keys(EVENT_COLORS) as EventType[]).map((type) => (
                <div
                  key={type}
                  className="flex items-center gap-xs text-xs text-muted-foreground"
                >
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full', EVENT_DOT_COLORS[type])}
                  />
                  {t(`financialCalendar.eventTypes.${type}`)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedDay && (
          <Card className="mt-md">
            <CardHeader className="pb-sm">
              <div className="flex items-center justify-between">
                <CardTitle as="h3">
                  {t('financialCalendar.dayDetail', {
                    date: format(selectedDay, "dd 'de' MMMM", {
                      locale: dateFnsLocale,
                    }),
                  })}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDay(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedDayEvents.length === 0 ? (
                <p className="py-md text-center text-sm text-muted-foreground">
                  {t('financialCalendar.noEvents')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-sm',
                        EVENT_COLORS[ev.type]
                      )}
                    >
                      <div className="flex items-center gap-sm">
                        <Badge
                          variant="outline"
                          className={cn('border text-xs', EVENT_COLORS[ev.type])}
                        >
                          {t(`financialCalendar.eventTypes.${ev.type}`)}
                        </Badge>
                        <span className="text-sm font-medium">{ev.description}</span>
                      </div>
                      <span className="text-sm font-bold">
                        {formatCurrency(ev.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </AnimatedPage>
  );
}
