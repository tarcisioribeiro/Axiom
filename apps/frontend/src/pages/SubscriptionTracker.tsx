import {
  ArrowPathIcon as RefreshCcw,
  ExclamationTriangleIcon as AlertTriangle,
  CalendarDateRangeIcon as CalendarClock,
} from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type { FixedExpense } from '@/types';

const SUBSCRIPTION_CATEGORIES = new Set([
  'digital signs',
  'entertainment',
  'bills and services',
]);

type SubscriptionGroup =
  'digital_signs' | 'entertainment' | 'bills_and_services' | 'other';

function getGroup(category: string): SubscriptionGroup {
  if (category === 'digital signs') return 'digital_signs';
  if (category === 'entertainment') return 'entertainment';
  if (category === 'bills and services') return 'bills_and_services';
  return 'other';
}

function isDueSoon(dueDay: number): boolean {
  const today = new Date().getDate();
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const diff = dueDay - today;
  if (diff >= 0 && diff <= 7) return true;
  if (diff < 0 && daysInMonth + diff <= 7) return true;
  return false;
}

function EmbeddedWrapper({ children }: { children: React.ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function SubscriptionTracker({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t } = useTranslation();

  const fixedExpensesQuery = useQuery({
    queryKey: ['fixedExpenses', 'subscriptions'],
    queryFn: () => fixedExpensesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading = fixedExpensesQuery.isLoading;

  const subscriptions = useMemo<FixedExpense[]>(() => {
    const all: FixedExpense[] = fixedExpensesQuery.data ?? [];
    return all.filter(
      (e) => e.is_active && (SUBSCRIPTION_CATEGORIES.has(e.category) || !!e.credit_card)
    );
  }, [fixedExpensesQuery.data]);

  const monthlyTotal = useMemo(
    () => subscriptions.reduce((s, e) => s + parseFloat(e.default_value), 0),
    [subscriptions]
  );

  const grouped = useMemo(() => {
    const map: Record<SubscriptionGroup, FixedExpense[]> = {
      digital_signs: [],
      entertainment: [],
      bills_and_services: [],
      other: [],
    };
    for (const s of subscriptions) {
      map[getGroup(s.category)].push(s);
    }
    return map;
  }, [subscriptions]);

  const dueSoon = useMemo(
    () => subscriptions.filter((s) => isDueSoon(s.due_day)),
    [subscriptions]
  );

  if (isLoading) return <LoadingState fullScreen />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader
        title={t('subscriptions.title')}
        icon={<RefreshCcw />}
        subtitle={t('subscriptions.subtitle')}
      />

      <div className="mt-md gap-md grid grid-cols-1 md:grid-cols-2">
        <StatCard
          title={t('subscriptions.monthlyTotal')}
          value={formatCurrency(monthlyTotal)}
          icon={<CalendarClock className="h-5 w-5" />}
          accentColor="blue"
          prominent
          description={t('subscriptions.activeCount', {
            count: subscriptions.length,
          })}
        />
        {dueSoon.length > 0 && (
          <StatCard
            title={t('subscriptions.dueSoon')}
            value={dueSoon.length}
            icon={<AlertTriangle className="h-4 w-4" />}
            accentColor="orange"
            description={t('subscriptions.dueSoonDesc')}
          />
        )}
      </div>

      {subscriptions.length === 0 ? (
        <div className="mt-md">
          <EmptyState
            title={t('subscriptions.noSubscriptions')}
            message={t('subscriptions.noSubscriptionsDesc')}
            icon={<RefreshCcw className="h-8 w-8" />}
          />
        </div>
      ) : (
        <div className="mt-md space-y-md">
          {(Object.keys(grouped) as SubscriptionGroup[])
            .filter((g) => grouped[g].length > 0)
            .map((group) => (
              <Card key={group}>
                <CardHeader className="pb-sm">
                  <CardTitle as="h3" className="text-base">
                    {t(`subscriptions.groups.${group}`)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-sm">
                    {grouped[group].map((sub) => {
                      const soon = isDueSoon(sub.due_day);
                      return (
                        <div
                          key={sub.id}
                          className={cn(
                            'p-sm flex items-center justify-between rounded-lg border transition-colors',
                            soon ? 'border-warning/40 bg-warning/5' : 'bg-muted/20'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="gap-sm flex items-center">
                              <span className="truncate text-sm font-medium">
                                {sub.description}
                              </span>
                              {soon && (
                                <Badge
                                  variant="outline"
                                  className="border-warning/40 text-warning text-xs"
                                >
                                  <AlertTriangle className="mr-xs h-3 w-3" />
                                  {t('subscriptions.dueSoon')}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-xs gap-sm text-muted-foreground flex items-center text-xs">
                              <span>{translateCategory(sub.category, 'expense')}</span>
                              <span>·</span>
                              <span>
                                {t('subscriptions.renewalOn', { day: sub.due_day })}
                              </span>
                            </div>
                          </div>
                          <span className="ml-md text-sm font-bold">
                            {formatCurrency(parseFloat(sub.default_value))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </Wrapper>
  );
}
