import { useQuery } from '@tanstack/react-query';
import { Award, Flame, Star, Target, TrendingUp, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { goalsService } from '@/services/goals-service';
import type { IntellectBadge } from '@/services/intellect-badges-service';
import { intellectBadgesService } from '@/services/intellect-badges-service';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import type { Goal } from '@/types';

const BADGE_LEVEL_COLORS: Record<string, string> = {
  bronze:
    'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300',
  silver:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const BADGE_LEVEL_ICONS: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
};

type TimelineEvent =
  | { kind: 'badge'; date: string; badge: IntellectBadge }
  | { kind: 'goal'; date: string; goal: Goal };

export default function Journey() {
  const { t } = useTranslation();

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
                <Star className="h-4 w-4 text-yellow-500" />
                {t('pages.journey.badgesTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(badges ?? []).length === 0 ? (
                <EmptyState
                  title={t('pages.journey.noBadges')}
                  description={t('pages.journey.noBadgesDesc')}
                />
              ) : (
                <div className="gap-sm grid grid-cols-2">
                  {(badges ?? []).map((b) => (
                    <div
                      key={b.id}
                      className={`p-sm flex flex-col items-center rounded-lg border text-center ${BADGE_LEVEL_COLORS[b.level] ?? ''}`}
                    >
                      <span className="text-2xl">
                        {BADGE_LEVEL_ICONS[b.level] ?? '🏅'}
                      </span>
                      <span className="mt-xs text-xs font-semibold">
                        {b.code_display}
                      </span>
                      <span className="text-[10px] opacity-70">{b.level_display}</span>
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
                  title={t('pages.journey.noEvents')}
                  description={t('pages.journey.noEventsDesc')}
                />
              ) : (
                <ol className="border-border/50 pl-lg relative border-l">
                  {events.map((ev, idx) => (
                    <li key={idx} className="mb-md ml-sm last:mb-0">
                      <div className="mt-xs bg-background absolute -left-1.5 h-3 w-3 rounded-full border">
                        {ev.kind === 'badge' ? (
                          <span className="absolute -top-0.5 -left-0.5 text-[10px]">
                            🏅
                          </span>
                        ) : (
                          <span className="absolute -top-0.5 -left-0.5 text-[10px]">
                            ✅
                          </span>
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
                            className={`ml-xs text-[10px] ${BADGE_LEVEL_COLORS[ev.badge.level] ?? ''}`}
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
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AnimatedPage>
  );
}
