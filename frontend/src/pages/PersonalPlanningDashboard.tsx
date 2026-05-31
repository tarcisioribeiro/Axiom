/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import { translate } from '@/config/constants';
import { useChartColors, useTaskCategoryColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_CONFIG } from '@/config/api-config';
import {
  PlanningOnboarding,
  usePlanningOnboarding,
} from '@/components/personal-planning/PlanningOnboarding';
import { mealLogService, mealTypeService } from '@/services/nutrition-service';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';
import { workoutPlanService, workoutSessionService } from '@/services/workout-service';
import { apiClient } from '@/services/api-client';
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
  const { shouldShow: showOnboarding } = usePlanningOnboarding();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const COLORS = useChartColors();
  const categoryColors = useTaskCategoryColors();

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

  const workoutByDayData = useMemo(() => {
    const weekDays: Record<string, number> = {};
    workoutSessions30d.forEach((s) => {
      const label = format(new Date(s.date + 'T00:00:00'), 'EEE', { locale: ptBR });
      weekDays[label] = (weekDays[label] ?? 0) + 1;
    });
    return Object.entries(weekDays).map(([day, count]) => ({ day, count }));
  }, [workoutSessions30d]);

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

  return (
    <PageContainer>
      {showOnboarding && !onboardingDone && (
        <PlanningOnboarding onDone={() => setOnboardingDone(true)} />
      )}
      <PageHeader title={t('pages.planningDashboard.title')} icon={<Calendar />} />

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
                <div className="flex -space-x-1">
                  {gamification.badges.slice(0, 5).map((b) => (
                    <span
                      key={b.slug}
                      title={b.name}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-background bg-muted text-sm"
                    >
                      {b.icon}
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
                <span className="text-2xl font-bold">{workoutStats.sessions30d}</span>
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
                <span className="text-2xl font-bold">{nutritionStats.weekMeals}</span>
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

        {stats.active_goals_progress && stats.active_goals_progress.length > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-sm">
              <CardTitle className="flex items-center gap-sm text-sm">
                <Flag className="h-4 w-4" />
                {t('pages.planningDashboard.activeGoalsProgress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.active_goals_progress.slice(0, 4).map((goal, index) => {
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
                        <span className="text-xs font-bold">{pct.toFixed(0)}%</span>
                      </CircularProgress>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{goal.title}</p>
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
                t('pages.planningDashboard.sessionCount', { count: Number(value) })
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
                  {analytics.insights.map((insight, i) => (
                    <li key={i} className="flex gap-sm text-sm leading-relaxed">
                      <span className="mt-0.5 shrink-0 text-primary">•</span>
                      <span>{renderInsight(insight, t)}</span>
                    </li>
                  ))}
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
