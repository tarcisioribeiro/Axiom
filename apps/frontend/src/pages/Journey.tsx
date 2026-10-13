/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Flame,
  Medal,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { formatLocalDate } from '@/lib/utils';
import { goalsService } from '@/services/goals-service';
import type { IntellectBadge } from '@/services/intellect-badges-service';
import { intellectBadgesService } from '@/services/intellect-badges-service';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import type { Goal } from '@/types';

const BADGE_LEVEL_COLORS: Record<string, string> = {
  bronze: 'bg-medal-bronze/15 text-medal-bronze border-medal-bronze/40',
  silver: 'bg-medal-silver/15 text-medal-silver border-medal-silver/40',
  gold: 'bg-medal-gold/15 text-medal-gold border-medal-gold/40',
};

type TimelineEvent =
  | { kind: 'badge'; date: string; badge: IntellectBadge }
  | { kind: 'goal'; date: string; goal: Goal };

export default function Journey() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: badges, isLoading: loadingBadges } = useQuery({
    queryKey: ['intellect-badges'],
    queryFn: () => intellectBadgesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: goals, isLoading: loadingGoals } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: streak, isLoading: loadingStreak } = useQuery({
    queryKey: ['library', 'streak'],
    queryFn: () => libraryDashboardService.getStreak(),
    staleTime: 30_000,
  });

  const isLoading = loadingBadges || loadingGoals || loadingStreak;

  const completedGoals = (goals ?? []).filter((g) => g.status === 'completed');

  const events: TimelineEvent[] = [
    ...(badges ?? []).map((b): TimelineEvent => ({
      kind: 'badge',
      date: b.awarded_at,
      badge: b,
    })),
    ...completedGoals.map((g): TimelineEvent => ({
      kind: 'goal',
      date: g.updated_at,
      goal: g,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredEvents = events.filter((ev) => {
    const d = ev.date.slice(0, 10);
    if (startDate && d < formatLocalDate(startDate)) return false;
    if (endDate && d > formatLocalDate(endDate)) return false;
    return true;
  });

  const hasActiveFilters = !!startDate || !!endDate;
  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageContainer>
          <LoadingState />
        </PageContainer>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader title={t('pages.journey.title')} icon={<Trophy />} />

        {/* Stats row */}
        <div className="gap-md grid grid-cols-2 sm:grid-cols-4">
          <StatCard
            title={t('pages.journey.badgesEarned')}
            value={badges?.length ?? 0}
            icon={<Award className="h-5 w-5" />}
          />
          <StatCard
            title={t('pages.journey.goalsCompleted')}
            value={completedGoals.length}
            icon={<Target className="h-5 w-5" />}
          />
          <StatCard
            title={t('pages.journey.currentStreak')}
            value={`${streak?.current ?? 0} ${t('intellect.streakDays')}`}
            icon={<Flame className="h-5 w-5" />}
          />
          <StatCard
            title={t('pages.journey.bestStreak')}
            value={`${streak?.longest ?? 0} ${t('intellect.streakDays')}`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        <div className="gap-lg grid lg:grid-cols-3">
          {/* Badge gallery */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="gap-sm flex items-center text-base">
                <Star className="text-star h-4 w-4" />
                {t('pages.journey.badgesTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(badges ?? []).length === 0 ? (
                <EmptyState
                  icon={<Medal className="h-6 w-6" />}
                  title={t('pages.journey.noBadges')}
                />
              ) : (
                <div className="gap-sm grid grid-cols-2">
                  {(badges ?? []).map((b) => (
                    <div
                      key={b.id}
                      className={`p-sm flex flex-col items-center rounded-lg border text-center ${BADGE_LEVEL_COLORS[b.level] ?? ''}`}
                    >
                      <Medal className="h-6 w-6" aria-hidden="true" />
                      <span className="mt-xs text-xs font-semibold">
                        {b.code_display}
                      </span>
                      <span className="text-2xs opacity-70">{b.level_display}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-sm">
              <CardTitle className="gap-sm flex items-center text-base">
                <Trophy className="text-primary h-4 w-4" />
                {t('pages.journey.timelineTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="h-6 w-6" />}
                  title={t('pages.journey.noEvents')}
                />
              ) : (
                <>
                  <FilterBar
                    className="mb-md"
                    hasActiveFilters={hasActiveFilters}
                    onClear={clearFilters}
                    activeFilters={[
                      ...(startDate
                        ? [
                            {
                              key: 'startDate',
                              label: `${t('common.fields.from')}: ${formatDate(startDate)}`,
                              onRemove: () => setStartDate(undefined),
                            },
                          ]
                        : []),
                      ...(endDate
                        ? [
                            {
                              key: 'endDate',
                              label: `${t('common.fields.to')}: ${formatDate(endDate)}`,
                              onRemove: () => setEndDate(undefined),
                            },
                          ]
                        : []),
                    ]}
                  >
                    <FilterField
                      label={t('common.filterLabels.period')}
                      icon={CalendarDays}
                    >
                      <DateRangeFilter
                        startDate={startDate}
                        endDate={endDate}
                        onStartChange={setStartDate}
                        onEndChange={setEndDate}
                      />
                    </FilterField>
                  </FilterBar>

                  {filteredEvents.length === 0 ? (
                    <EmptyState
                      icon={<Trophy className="h-6 w-6" />}
                      title={t('pages.journey.noEvents')}
                    />
                  ) : (
                    <PaginatedSlide
                      key={`${startDate ? formatLocalDate(startDate) : ''}|${endDate ? formatLocalDate(endDate) : ''}`}
                      items={filteredEvents}
                      pageSize={LIST_PAGE_SIZE}
                      pinNav={false}
                    >
                      {(pageEvents) => (
                        <ol className="border-border/50 pl-lg relative border-l">
                          {pageEvents.map((ev, idx) => (
                            <li key={idx} className="mb-md ml-sm last:mb-0">
                              <div className="mt-xs bg-background absolute -left-1.5 h-3 w-3 rounded-full border">
                                {ev.kind === 'badge' ? (
                                  <Award
                                    className="text-medal-gold absolute -top-0.5 -left-0.5 h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <CheckCircle2
                                    className="absolute -top-0.5 -left-0.5 h-2.5 w-2.5 text-[hsl(var(--success))]"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {formatDate(ev.date)}
                              </p>
                              {ev.kind === 'badge' ? (
                                <p className="mt-xs text-sm font-medium">
                                  {t('pages.journey.badgeEarned', {
                                    name: ev.badge.code_display,
                                  })}
                                  <Badge
                                    className={`ml-xs text-2xs ${BADGE_LEVEL_COLORS[ev.badge.level] ?? ''}`}
                                  >
                                    {ev.badge.level_display}
                                  </Badge>
                                </p>
                              ) : (
                                <p className="mt-xs text-sm font-medium">
                                  {t('pages.journey.goalCompleted', {
                                    name: ev.goal.title,
                                  })}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </PaginatedSlide>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AnimatedPage>
  );
}
