/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { format, getISODay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Target,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Award,
  ListTodo,
  Flag,
  Activity,
  Lightbulb,
  BarChart3,
  Flame,
  Dumbbell,
  UtensilsCrossed,
  Timer,
  Utensils,
  ClipboardList,
  Zap,
  Star,
  Trophy,
  ChevronDown,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import {
  DailyCaloricSummaryCard,
  type DailyCaloricSummaryData,
} from '@/components/personal-planning/DailyCaloricSummaryCard';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import { PlanningOnboarding } from '@/components/personal-planning/PlanningOnboarding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import { API_CONFIG } from '@/config/api-config';
import { translate } from '@/config/constants';
import { usePlanningOnboarding } from '@/hooks/use-planning-onboarding';
import { useChartColors, useTaskCategoryColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { mealLogService, mealTypeService } from '@/services/nutrition-service';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';
import { workoutPlanService, workoutSessionService } from '@/services/workout-service';
import type { HabitInsight } from '@/types';

function renderInsight(
  insight: HabitInsight,
  t: ReturnType<typeof useTranslation>['t']
): string {
  const weekdayLong =
    insight.weekday !== undefined
      ? t(`pages.planningDashboard.weekdayLong.${insight.weekday}`)
      : '';

  switch (insight.type) {
    case 'best_day':
      return t('pages.planningDashboard.insightBestDay', {
        weekday: weekdayLong.toLowerCase(),
        rate: Math.round(insight.rate ?? 0),
      });
    case 'worst_day':
      return t('pages.planningDashboard.insightWorstDay', {
        weekday: weekdayLong,
        rate: Math.round(insight.rate ?? 0),
      });
    case 'weekend_drop':
      return t('pages.planningDashboard.insightWeekendDrop', {
        diff: Math.round(insight.diff ?? 0),
        weekendRate: Math.round(insight.weekend_rate ?? 0),
        weekdayRate: Math.round(insight.weekday_rate ?? 0),
      });
    case 'weekend_better':
      return t('pages.planningDashboard.insightWeekendBetter', {
        weekendRate: Math.round(insight.weekend_rate ?? 0),
        weekdayRate: Math.round(insight.weekday_rate ?? 0),
      });
    case 'overall_excellent':
      return t('pages.planningDashboard.insightOverallExcellent', {
        rate: Math.round(insight.rate ?? 0),
      });
    case 'overall_low':
      return t('pages.planningDashboard.insightOverallLow', {
        rate: Math.round(insight.rate ?? 0),
      });
    default:
      return '';
  }
}

export default function PersonalPlanningDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const COLORS = useChartColors();
  const categoryColors = useTaskCategoryColors();
  const { shouldShow: showOnboarding } = usePlanningOnboarding();
  const [onboardingDone, setOnboardingDone] = useState(false);

  // Collapsible section state — persisted to localStorage
  const [workoutNutritionOpen, setWorkoutNutritionOpen] = useState(
    () => localStorage.getItem('planning-workout-nutrition') !== 'false'
  );
  const [detailedAnalysisOpen, setDetailedAnalysisOpen] = useState(
    () => localStorage.getItem('planning-detailed-analysis') === 'true'
  );

  useEffect(() => {
    localStorage.setItem(
      'planning-workout-nutrition',
      workoutNutritionOpen ? 'true' : 'false'
    );
  }, [workoutNutritionOpen]);

  useEffect(() => {
    localStorage.setItem(
      'planning-detailed-analysis',
      detailedAnalysisOpen ? 'true' : 'false'
    );
  }, [detailedAnalysisOpen]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['personalPlanningDashboard'],
    queryFn: () => personalPlanningDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: analytics } = useQuery({
    queryKey: ['personalPlanningAnalytics'],
    queryFn: () => personalPlanningDashboardService.getAnalytics(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: workoutSessions30d = [] } = useQuery({
    queryKey: ['workoutSessions30d', thirtyDaysAgo, today],
    queryFn: () => workoutSessionService.getByDateRange(thirtyDaysAgo, today),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: workoutPlans = [] } = useQuery({
    queryKey: ['workoutPlans'],
    queryFn: () => workoutPlanService.getAll({ page_size: 50 }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: mealLogsWeek = [] } = useQuery({
    queryKey: ['mealLogsWeek', weekStart, weekEnd],
    queryFn: () => mealLogService.getByDateRange(weekStart, weekEnd),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: mealTypes = [] } = useQuery({
    queryKey: ['mealTypes'],
    queryFn: () => mealTypeService.getAll({ page_size: 50 }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: caloricSummary, isLoading: caloricSummaryLoading } = useQuery({
    queryKey: ['dailyCaloricSummary', today],
    queryFn: () =>
      apiClient.get<DailyCaloricSummaryData>(
        `${API_CONFIG.ENDPOINTS.DAILY_CALORIC_SUMMARY}?date=${today}`
      ),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: gamification } = useQuery({
    queryKey: ['gamificationProfile'],
    queryFn: () =>
      apiClient.get<{
        total_xp: number;
        current_level: number;
        level_progress_pct: number;
        xp_in_level: number;
        xp_needed_for_next_level: number;
        tasks_completed_total: number;
        badges: Array<{ slug: string; name: string; icon: string; category: string }>;
      }>(API_CONFIG.ENDPOINTS.GAMIFICATION_PROFILE),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const workoutStats = useMemo(() => {
    const sessionsWeek = workoutSessions30d.filter(
      (s) => s.date >= weekStart && s.date <= weekEnd
    );
    const totalMinutes = workoutSessions30d.reduce(
      (sum, s) => sum + (s.duration_minutes ?? 0),
      0
    );
    const activePlan = workoutPlans.find((p) => p.is_active);
    return {
      sessions30d: workoutSessions30d.length,
      sessionsWeek: sessionsWeek.length,
      totalMinutes30d: totalMinutes,
      activePlanName: activePlan?.name ?? null,
      activePlanDays: activePlan?.day_count ?? 0,
      activePlanExercises: activePlan?.exercise_count ?? 0,
    };
  }, [workoutSessions30d, workoutPlans, weekStart, weekEnd]);

  const nutritionStats = useMemo(() => {
    const todayLogs = mealLogsWeek.filter((l) => l.date === today);
    const mealTypesActive = mealTypes.filter((mt) => mt.is_active);

    const byMealType: Record<string, number> = {};
    mealLogsWeek.forEach((log) => {
      byMealType[log.meal_type_name] = (byMealType[log.meal_type_name] ?? 0) + 1;
    });
    const byMealTypeData = Object.entries(byMealType).map(([name, count]) => ({
      name,
      count,
    }));

    return {
      todayMeals: todayLogs.length,
      weekMeals: mealLogsWeek.length,
      activeMealTypes: mealTypesActive.length,
      byMealTypeData,
    };
  }, [mealLogsWeek, mealTypes, today]);

  const weeklyXP = useMemo(() => {
    const sessionsWeek = workoutSessions30d.filter(
      (s) => s.date >= weekStart && s.date <= weekEnd
    );
    const weeklyTasksCompleted =
      stats?.weekly_progress?.reduce((sum, d) => sum + d.completed, 0) ?? 0;
    const reflectionsCount = mealLogsWeek.length > 0 ? 1 : 0;
    const xp =
      weeklyTasksCompleted * 10 + sessionsWeek.length * 20 + reflectionsCount * 5;
    const level = Math.floor(xp / 100);
    const xpInLevel = xp % 100;
    const streak = stats?.current_streak ?? 0;
    return { xp, level, xpInLevel, streak };
  }, [stats, workoutSessions30d, mealLogsWeek, weekStart, weekEnd]);

  const workoutByDayData = useMemo(() => {
    const weekDays: Record<number, number> = {};
    workoutSessions30d.forEach((s) => {
      const dayIdx = getISODay(new Date(s.date + 'T00:00:00')) - 1; // 0=Mon, 6=Sun
      weekDays[dayIdx] = (weekDays[dayIdx] ?? 0) + 1;
    });
    return Object.entries(weekDays)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([dayIdx, count]) => ({
        day: t(`pages.planningDashboard.weekdayShort.${dayIdx}`),
        count,
      }));
  }, [workoutSessions30d, t]);

  const weeklyProgressData = stats?.weekly_progress
    ? stats.weekly_progress.map((item) => {
        const parts = item.date.split('-');
        const day = parts[2];
        const month = parts[1];
        return {
          date: `${day}/${month}`,
          total: item.total,
          completadas: item.completed,
          taxa: parseFloat(item.rate.toFixed(1)),
        };
      })
    : [];

  const tasksByCategoryData = stats?.tasks_by_category
    ? stats.tasks_by_category.map((item) => ({
        category: item.category,
        name: translate('taskCategories', item.category),
        count: item.count,
      }))
    : [];

  const reflectionCorrelation = useMemo(() => {
    if (!stats?.recent_reflections || !stats?.weekly_progress) return [];
    const progressByDate: Record<string, number> = {};
    stats.weekly_progress.forEach((p) => {
      progressByDate[p.date] = p.rate;
    });
    return stats.recent_reflections
      .filter((r) => progressByDate[r.date] !== undefined)
      .map((r) => ({
        date: r.date,
        mood: r.mood ?? '',
        mood_display: r.mood_display ?? '',
        rate: progressByDate[r.date],
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [stats]);

  const getCategoryColor = (category: string) =>
    categoryColors[category as keyof typeof categoryColors] || categoryColors.other;

  const todayRate =
    stats && stats.total_tasks_today > 0
      ? (stats.completed_tasks_today / stats.total_tasks_today) * 100
      : 0;

  const todayRingColor =
    todayRate >= 80
      ? 'hsl(var(--chart-2))'
      : todayRate >= 40
        ? 'hsl(var(--warning))'
        : 'hsl(var(--primary))';

  if (isLoading) {
    return <LoadingState />;
  }

  if (!stats) {
    return (
      <PageContainer>
        <PageHeader title={t('pages.planningDashboard.title')} icon={<Calendar />} />
        <p className="text-center">{t('pages.planningDashboard.noData')}</p>
      </PageContainer>
    );
  }

  const MODULE_CARDS = [
    {
      titleKey: 'pages.planningDashboard.moduleCards.workoutTitle' as const,
      subtitleKey: 'pages.planningDashboard.moduleCards.workoutSubtitle' as const,
      icon: Dumbbell,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
      route: '/planning/workout',
    },
    {
      titleKey: 'pages.planningDashboard.moduleCards.nutritionTitle' as const,
      subtitleKey: 'pages.planningDashboard.moduleCards.nutritionSubtitle' as const,
      icon: UtensilsCrossed,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      route: '/planning/nutrition',
    },
    {
      titleKey: 'pages.planningDashboard.moduleCards.tasksTitle' as const,
      subtitleKey: 'pages.planningDashboard.moduleCards.tasksSubtitle' as const,
      icon: ListTodo,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20',
      route: '/planning/tasks-goals',
    },
    {
      titleKey: 'pages.planningDashboard.moduleCards.goalsTitle' as const,
      subtitleKey: 'pages.planningDashboard.moduleCards.goalsSubtitle' as const,
      icon: Target,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/20',
      route: '/planning/tasks-goals',
    },
  ] as const;

  return (
    <PageContainer>
      {showOnboarding && !onboardingDone && (
        <PlanningOnboarding onDone={() => setOnboardingDone(true)} />
      )}
      <PageHeader title={t('pages.planningDashboard.title')} icon={<Calendar />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MODULE_CARDS.map((card) => (
          <button
            key={card.route + card.titleKey}
            onClick={() => void navigate(card.route)}
            className={cn(
              'flex flex-col items-start gap-sm rounded-lg border p-md text-left transition-all hover:scale-[1.02]',
              card.bg
            )}
          >
            <card.icon className={cn('h-6 w-6', card.color)} />
            <div>
              <p className="text-sm font-semibold">{t(card.titleKey)}</p>
              <p className="text-xs text-muted-foreground">{t(card.subtitleKey)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Linha 1: Tarefas de Hoje | Taxa 7d | Tarefas ativas | Taxa 30d */}
      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        <Card className="flex items-center gap-md p-5">
          <CircularProgress
            value={todayRate}
            size={80}
            strokeWidth={7}
            color={todayRingColor}
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-lg font-bold">{stats.completed_tasks_today}</span>
              <span className="text-xs text-muted-foreground">
                /{stats.total_tasks_today}
              </span>
            </div>
          </CircularProgress>
          <p className="text-sm font-medium text-muted-foreground">
            {t('pages.planningDashboard.todayTasks')}
          </p>
        </Card>

        <StatCard
          title={t('pages.planningDashboard.completionRate7d')}
          value={`${stats.completion_rate_7d.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <StatCard
          title={t('pages.planningDashboard.activeTasks')}
          value={stats.active_tasks}
          icon={<ListTodo className="h-4 w-4" />}
        />

        <StatCard
          title={t('pages.planningDashboard.completionRate30d')}
          value={`${stats.completion_rate_30d.toFixed(1)}%`}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      {/* Linha 2: Objetivos ativos | Melhor Sequência | Sequência atual | Objetivos Completados */}
      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        <StatCard
          title={t('pages.planningDashboard.activeGoals')}
          value={stats.active_goals}
          icon={<Target className="h-4 w-4" />}
        />

        <Card className="flex items-center gap-md p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">
              {stats.best_streak}
              <span className="ml-xs text-sm font-normal text-muted-foreground">
                {t('pages.planningDashboard.days')}
              </span>
            </p>
            <p className="mt-xs text-sm text-muted-foreground">
              {t('pages.planningDashboard.bestStreak')}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-md p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">
              {stats.current_streak}
              <span className="ml-xs text-sm font-normal text-muted-foreground">
                {t('pages.planningDashboard.days')}
              </span>
            </p>
            <p className="mt-xs text-sm text-muted-foreground">
              {t('pages.planningDashboard.currentStreak')}
            </p>
          </div>
        </Card>

        {gamification && (
          <Card className="col-span-1 flex flex-col gap-sm p-5 sm:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">
                    {t('pages.planningDashboard.level')} {gamification.current_level}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {gamification.total_xp} XP · {gamification.tasks_completed_total}{' '}
                    {t('pages.planningDashboard.tasksCompleted')}
                  </p>
                </div>
              </div>
              {gamification.badges.length > 0 && (
                <div className="flex -space-x-xs">
                  {gamification.badges.slice(0, 5).map((b) => (
                    <span
                      key={b.slug}
                      title={b.name}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-background bg-muted text-sm"
                    >
                      <Trophy className="h-3.5 w-3.5 text-primary" />
                    </span>
                  ))}
                  {gamification.badges.length > 5 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-background bg-muted text-xs font-medium text-muted-foreground">
                      +{gamification.badges.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="mb-xs flex justify-between text-xs text-muted-foreground">
                <span>{gamification.xp_in_level} XP</span>
                <span>
                  {gamification.xp_needed_for_next_level} XP{' '}
                  {t('pages.planningDashboard.toNextLevel')}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(gamification.level_progress_pct, 100)}%`,
                  }}
                />
              </div>
            </div>
          </Card>
        )}

        <StatCard
          title={t('pages.planningDashboard.completedGoals')}
          value={stats.completed_goals}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Linha 2b: XP Semanal */}
      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="flex items-center gap-sm text-sm">
            <Zap className="h-4 w-4 text-warning" />
            {t('pages.planningDashboard.weeklyXP')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-lg">
            <div className="flex items-center gap-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <Star className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{weeklyXP.xp}</p>
                <p className="mt-xs text-xs text-muted-foreground">
                  {t('pages.planningDashboard.xpLabel')}
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-xs">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {t('pages.planningDashboard.xpProgress', { level: weeklyXP.level })}
                </span>
                <span>{weeklyXP.xpInLevel}/100 XP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-warning"
                  initial={{ width: 0 }}
                  animate={{ width: `${weeklyXP.xpInLevel}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
            {weeklyXP.streak > 3 && (
              <motion.div
                className="flex items-center gap-xs rounded-full bg-orange-500/15 px-sm py-xs"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-bold text-orange-500">
                  {weeklyXP.streak}
                </span>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Seção Treinos & Nutrição (colapsável) ─────────────────────────── */}
      <button
        type="button"
        onClick={() => setWorkoutNutritionOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-sm text-left"
        aria-expanded={workoutNutritionOpen}
      >
        <div className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-xs text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('pages.planningDashboard.sectionWorkoutNutrition')}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              workoutNutritionOpen && 'rotate-180'
            )}
          />
        </span>
        <div className="h-px flex-1 bg-border" />
      </button>

      <AnimatePresence initial={false}>
        {workoutNutritionOpen && (
          <motion.div
            key="workout-nutrition"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-lg">
              {/* Resumo Calórico */}
              <DailyCaloricSummaryCard
                data={caloricSummary}
                isLoading={caloricSummaryLoading}
              />

              {/* Linha 3: Treinos */}
              <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
                {/* Card: Resumo de Treinos */}
                <Card>
                  <CardHeader className="pb-sm">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-sm text-sm">
                        <Dumbbell className="h-4 w-4 text-category-health" />
                        {t('pages.planningDashboard.workoutsTitle')}
                      </CardTitle>
                      <Link
                        to="/planning/workout"
                        className="rounded-md bg-primary/10 px-sm py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        {t('pages.planningDashboard.ctaLogWorkout')}
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <Dumbbell className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.sessions30d')}
                          </span>
                        </div>
                        <span className="text-2xl font-bold">
                          {workoutStats.sessions30d}
                        </span>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.thisWeek')}
                          </span>
                        </div>
                        <span className="text-2xl font-bold text-info">
                          {workoutStats.sessionsWeek}
                        </span>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.totalTime30d')}
                          </span>
                        </div>
                        <span className="text-2xl font-bold">
                          {workoutStats.totalMinutes30d > 0
                            ? `${Math.round(workoutStats.totalMinutes30d / 60)}h`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <ClipboardList className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.activeWorkoutPlan')}
                          </span>
                        </div>
                        {workoutStats.activePlanName ? (
                          <span
                            className="truncate text-sm font-bold"
                            title={workoutStats.activePlanName}
                          >
                            {workoutStats.activePlanName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t('common.actions.none')}
                          </span>
                        )}
                      </div>
                    </div>

                    {workoutStats.activePlanName && (
                      <div className="mt-md flex items-center gap-lg border-t pt-md text-sm text-muted-foreground">
                        <span>
                          <span className="font-semibold text-foreground">
                            {workoutStats.activePlanDays}
                          </span>{' '}
                          {t('pages.planningDashboard.days')}
                        </span>
                        <span>
                          <span className="font-semibold text-foreground">
                            {workoutStats.activePlanExercises}
                          </span>{' '}
                          {t('pages.planningDashboard.planExercises')}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Card: Nutrição */}
                <Card>
                  <CardHeader className="pb-sm">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-sm text-sm">
                        <UtensilsCrossed className="h-4 w-4 text-category-health" />
                        {t('pages.planningDashboard.nutritionTitle')}
                      </CardTitle>
                      <Link
                        to="/planning/nutrition"
                        className="rounded-md bg-success/10 px-sm py-0.5 text-xs font-medium text-success transition-colors hover:bg-success/20"
                      >
                        {t('pages.planningDashboard.ctaLogMeal')}
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-md">
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <Utensils className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.mealsToday')}
                          </span>
                        </div>
                        <span className="text-2xl font-bold text-success">
                          {nutritionStats.todayMeals}
                        </span>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.thisWeek')}
                          </span>
                        </div>
                        <span className="text-2xl font-bold">
                          {nutritionStats.weekMeals}
                        </span>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-sm text-muted-foreground">
                          <ClipboardList className="h-4 w-4" />
                          <span className="text-xs">
                            {t('pages.planningDashboard.activeMealTypes')}
                          </span>
                        </div>
                        <span className="text-2xl font-bold">
                          {nutritionStats.activeMealTypes}
                        </span>
                      </div>
                    </div>

                    {nutritionStats.byMealTypeData.length > 0 && (
                      <div className="mt-md space-y-sm border-t pt-md">
                        {nutritionStats.byMealTypeData
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 4)
                          .map((item, i) => {
                            const max = nutritionStats.byMealTypeData[0]?.count ?? 1;
                            const pct = Math.round((item.count / max) * 100);
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                                  {item.name}
                                </span>
                                <div className="flex flex-1 items-center gap-sm">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary/70 transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="w-6 text-right text-xs font-medium">
                                    {item.count}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Seção Análise Detalhada (colapsável, lazy) ──────────────────────── */}
      <button
        type="button"
        onClick={() => setDetailedAnalysisOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-sm text-left"
        aria-expanded={detailedAnalysisOpen}
      >
        <div className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-xs text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('pages.planningDashboard.sectionDetailedAnalysis')}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              detailedAnalysisOpen && 'rotate-180'
            )}
          />
        </span>
        <div className="h-px flex-1 bg-border" />
      </button>

      <AnimatePresence initial={false}>
        {detailedAnalysisOpen && (
          <motion.div
            key="detailed-analysis"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-lg">
              {/* Linha 4: Progresso Semanal | Tarefas por categoria | Progresso de objetivos | Consistência | Treinos/dia */}
              <div className="grid grid-cols-1 gap-lg lg:grid-cols-4">
                {weeklyProgressData.length > 0 && (
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-sm">
                      <CardTitle className="flex items-center gap-sm text-sm">
                        <TrendingUp className="h-4 w-4" />
                        {t('pages.planningDashboard.weeklyProgress')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        chartId="planning-weekly-progress"
                        data={weeklyProgressData}
                        dataKey="total"
                        nameKey="date"
                        formatter={(value) => value.toString()}
                        colors={COLORS}
                        emptyMessage={t('pages.planningDashboard.noProgressData')}
                        lockChartType="line"
                        dualYAxis={{
                          left: {
                            dataKey: 'total',
                            label: t('pages.planningDashboard.total'),
                            color: COLORS[0],
                          },
                          right: {
                            dataKey: 'taxa',
                            label: t('pages.planningDashboard.rate'),
                            color: COLORS[1],
                          },
                        }}
                        lines={[
                          {
                            dataKey: 'total',
                            stroke: COLORS[0],
                            yAxisId: 'left',
                            name: t('pages.planningDashboard.total'),
                          },
                          {
                            dataKey: 'completadas',
                            stroke: COLORS[3],
                            yAxisId: 'left',
                            name: t('pages.planningDashboard.completed'),
                          },
                          {
                            dataKey: 'taxa',
                            stroke: COLORS[1],
                            yAxisId: 'right',
                            name: t('pages.planningDashboard.rate'),
                          },
                        ]}
                        height={280}
                      />
                    </CardContent>
                  </Card>
                )}

                {tasksByCategoryData.length > 0 && (
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-sm">
                      <CardTitle className="flex items-center gap-sm text-sm">
                        <ListTodo className="h-4 w-4" />
                        {t('pages.planningDashboard.tasksByCategory')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        chartId="planning-tasks-category"
                        data={tasksByCategoryData}
                        dataKey="count"
                        nameKey="name"
                        formatter={(value) => {
                          const count: number = Number(value);
                          return t('pages.planningDashboard.taskCount', { count });
                        }}
                        colors={COLORS}
                        customColors={(entry) =>
                          getCategoryColor(String(entry.category || 'other'))
                        }
                        emptyMessage={t('pages.planningDashboard.noTasks')}
                        lockChartType="pie"
                        layout="horizontal"
                        height={280}
                      />
                    </CardContent>
                  </Card>
                )}

                {stats.active_goals_progress &&
                  stats.active_goals_progress.length > 0 && (
                    <Card className="lg:col-span-1">
                      <CardHeader className="pb-sm">
                        <CardTitle className="flex items-center gap-sm text-sm">
                          <Flag className="h-4 w-4" />
                          {t('pages.planningDashboard.activeGoalsProgress')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {stats.active_goals_progress
                            .slice(0, 4)
                            .map((goal, index) => {
                              const pct = goal.progress_percentage;
                              const ringColor =
                                pct >= 80
                                  ? 'hsl(var(--chart-2))'
                                  : pct >= 40
                                    ? 'hsl(var(--warning))'
                                    : 'hsl(var(--primary))';
                              return (
                                <div key={index} className="flex items-center gap-3">
                                  <CircularProgress
                                    value={pct}
                                    size={48}
                                    strokeWidth={5}
                                    color={ringColor}
                                  >
                                    <span className="text-xs font-bold">
                                      {pct.toFixed(0)}%
                                    </span>
                                  </CircularProgress>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      {goal.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {goal.current_value} / {goal.target_value}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                <Card className="lg:col-span-1">
                  <CardHeader className="pb-sm">
                    <CardTitle className="flex items-center gap-sm text-sm">
                      <Activity className="h-4 w-4" />
                      {t('pages.planningDashboard.habitConsistency')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HabitHeatmap />
                  </CardContent>
                </Card>
              </div>

              {/* Linha 5: Treinos por dia (30d) */}
              {workoutByDayData.length > 0 && (
                <Card>
                  <CardHeader className="pb-sm">
                    <CardTitle className="flex items-center gap-sm text-sm">
                      <Dumbbell className="h-4 w-4" />
                      {t('pages.planningDashboard.workoutsByDayTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      chartId="planning-workout-by-day"
                      data={workoutByDayData}
                      dataKey="count"
                      nameKey="day"
                      formatter={(value) =>
                        t('pages.planningDashboard.sessionCount', {
                          count: Number(value),
                        })
                      }
                      colors={COLORS}
                      emptyMessage={t('pages.planningDashboard.noWorkoutsRegistered')}
                      lockChartType="bar"
                      height={200}
                      tooltipNameFormatter={() => null}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Linha 5b: Humor × Conclusão */}
              {reflectionCorrelation.length > 0 && (
                <Card>
                  <CardHeader className="pb-sm">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-sm text-sm">
                        <Activity className="h-4 w-4 text-info" />
                        {t('pages.planningDashboard.reflectionCorrelationTitle', {
                          defaultValue: 'Humor × Conclusão de Tarefas',
                        })}
                      </CardTitle>
                      <Link
                        to="/planning/reflections"
                        className="rounded-md bg-muted px-sm py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {t('pages.planningDashboard.ctaReflect')}
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-md">
                      {reflectionCorrelation.map((entry) => {
                        const parts = entry.date.split('-');
                        const dateLabel = `${parts[2]}/${parts[1]}`;
                        const moodColor =
                          entry.mood === 'excellent'
                            ? 'bg-success text-success-foreground'
                            : entry.mood === 'good'
                              ? 'bg-info text-info-foreground'
                              : entry.mood === 'neutral'
                                ? 'bg-warning text-warning-foreground'
                                : entry.mood === 'bad'
                                  ? 'bg-orange-500 text-white'
                                  : entry.mood === 'terrible'
                                    ? 'bg-destructive text-destructive-foreground'
                                    : 'bg-muted text-muted-foreground';
                        const barWidth = Math.min(entry.rate, 100);
                        return (
                          <div
                            key={entry.date}
                            className="flex min-w-[120px] flex-1 flex-col gap-xs rounded-lg border p-sm"
                          >
                            <div className="flex items-center justify-between gap-xs">
                              <span className="text-xs text-muted-foreground">
                                {dateLabel}
                              </span>
                              {entry.mood && (
                                <span
                                  className={`rounded-full px-xs py-0.5 text-xs font-medium ${moodColor}`}
                                >
                                  {entry.mood_display}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-xs">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="w-9 text-right text-xs font-semibold">
                                {entry.rate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Linha 6: Desempenho Dia Por Semana | Insight de Hábitos */}
              {analytics && (
                <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-sm">
                        <BarChart3 className="h-5 w-5" />
                        {t('pages.planningDashboard.weekdayAnalytics')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-sm">
                        {analytics.completion_by_weekday.map((day) => (
                          <div key={day.weekday} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-sm text-muted-foreground">
                              {t(`pages.planningDashboard.weekdayShort.${day.weekday}`)}
                            </span>
                            <div className="flex flex-1 items-center gap-sm">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${day.rate ?? 0}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-sm font-medium">
                                {day.rate !== null ? `${day.rate.toFixed(0)}%` : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t('pages.planningDashboard.analyticsPeriod', {
                          days: analytics.period_days,
                        })}
                      </p>
                    </CardContent>
                  </Card>

                  {analytics.insights.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-sm">
                          <Lightbulb className="h-5 w-5" />
                          {t('pages.planningDashboard.insights')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-md">
                        <ul className="space-y-3">
                          {analytics.insights.map((insight, i) => {
                            const insightCTA =
                              insight.type === 'worst_day'
                                ? {
                                    label: t(
                                      'pages.planningDashboard.insightCTAWorstDay'
                                    ),
                                    onClick: () => navigate('/planning/routine-tasks'),
                                  }
                                : insight.type === 'overall_low'
                                  ? {
                                      label: t(
                                        'pages.planningDashboard.insightCTAWorkout'
                                      ),
                                      onClick: () => navigate('/planning/workout'),
                                    }
                                  : insight.type === 'overall_excellent' ||
                                      insight.type === 'best_day'
                                    ? {
                                        label: t(
                                          'pages.planningDashboard.insightCTAGoals'
                                        ),
                                        onClick: () => navigate('/planning/goals'),
                                      }
                                    : null;

                            return (
                              <li
                                key={i}
                                className="flex items-start justify-between gap-sm text-sm leading-relaxed"
                              >
                                <div className="flex gap-sm">
                                  <span className="mt-0.5 shrink-0 text-primary">
                                    •
                                  </span>
                                  <span>{renderInsight(insight, t)}</span>
                                </div>
                                {insightCTA && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto shrink-0 px-sm py-xs text-xs text-primary hover:text-primary"
                                    onClick={insightCTA.onClick}
                                  >
                                    {insightCTA.label}
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <div className="flex flex-wrap gap-sm border-t pt-sm">
                          <Link
                            to="/planning/daily-checklist"
                            className="rounded-md bg-primary/10 px-sm py-xs text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            {t('pages.planningDashboard.ctaChecklist')}
                          </Link>
                          <Link
                            to="/planning/tasks-goals"
                            className="rounded-md bg-muted px-sm py-xs text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                          >
                            {t('pages.planningDashboard.ctaTasks')}
                          </Link>
                          <Link
                            to="/planning/reflections"
                            className="rounded-md bg-muted px-sm py-xs text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                          >
                            {t('pages.planningDashboard.ctaReflect')}
                          </Link>
                          <Link
                            to="/planning/emotional-wellness"
                            className="rounded-md bg-rose-500/10 px-sm py-xs text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
                          >
                            Bem-Estar Emocional
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
