/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { format, getISODay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import {
  Target,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Award,
  ListTodo,
  Flag,
  Activity,
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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StreakBadge } from '@/components/common/StreakBadge';
import {
  DailyCaloricSummaryCard,
  type DailyCaloricSummaryData,
} from '@/components/personal-planning/DailyCaloricSummaryCard';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import { PlanningOnboarding } from '@/components/personal-planning/PlanningOnboarding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Collapse } from '@/components/ui/collapsible-section';
import { Progress } from '@/components/ui/progress';
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

type Section = 'overview' | 'workout-nutrition' | 'detailed-analysis';

function SectionToggle({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="py-sm flex w-full items-center gap-3 text-left"
      aria-expanded={open}
    >
      <div className="bg-border h-px flex-1" />
      <span className="gap-xs text-muted-foreground flex items-center text-xs font-medium tracking-wider uppercase">
        {label}
        <ChevronDown
          className={cn(
            'duration-normal h-3.5 w-3.5 transition-transform',
            open && 'rotate-180'
          )}
        />
      </span>
      <div className="bg-border h-px flex-1" />
    </button>
  );
}

export default function PersonalPlanningDashboard() {
  const { t } = useTranslation();
  const COLORS = useChartColors();
  const categoryColors = useTaskCategoryColors();
  const { shouldShow: showOnboarding } = usePlanningOnboarding();
  const [onboardingDone, setOnboardingDone] = useState(false);

  // Seções em acordeão: abrir uma recolhe as demais
  const [openSection, setOpenSection] = useState<Section | null>('overview');
  const toggleSection = (section: Section) =>
    setOpenSection((current) => (current === section ? null : section));

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

  return (
    <PageContainer>
      {showOnboarding && !onboardingDone && (
        <PlanningOnboarding onDone={() => setOnboardingDone(true)} />
      )}
      <PageHeader title={t('pages.planningDashboard.title')} icon={<Calendar />} />

      {/* ── Seção Visão Geral (colapsável, aberta por padrão) ─────────────── */}
      <SectionToggle
        label={t('pages.planningDashboard.sectionOverview')}
        open={openSection === 'overview'}
        onToggle={() => toggleSection('overview')}
      />

      <Collapse open={openSection === 'overview'}>
        <div className="space-y-lg">
          {/* Nível/Gamificação (+ objetivos e sequências) | Progresso Semanal (+ tarefas) */}
          <div className="gap-md grid grid-cols-1 lg:grid-cols-2">
            <Card className="gap-sm flex flex-col p-5">
              {gamification && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="gap-sm flex items-center">
                      <div className="bg-primary/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                        <Zap className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xl leading-none font-bold">
                          {t('pages.planningDashboard.level')}{' '}
                          {gamification.current_level}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {gamification.total_xp} XP ·{' '}
                          {gamification.tasks_completed_total}{' '}
                          {t('pages.planningDashboard.tasksCompleted')}
                        </p>
                      </div>
                    </div>
                    {gamification.badges.length > 0 && (
                      <div className="-space-x-xs flex">
                        {gamification.badges.slice(0, 5).map((b) => (
                          <span
                            key={b.slug}
                            title={b.name}
                            className="border-background bg-muted flex h-7 w-7 items-center justify-center rounded-full border text-sm"
                          >
                            <Trophy className="text-primary h-3.5 w-3.5" />
                          </span>
                        ))}
                        {gamification.badges.length > 5 && (
                          <span className="border-background bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium">
                            +{gamification.badges.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-xs text-muted-foreground flex justify-between text-xs">
                      <span>{gamification.xp_in_level} XP</span>
                      <span>
                        {gamification.xp_needed_for_next_level} XP{' '}
                        {t('pages.planningDashboard.toNextLevel')}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(gamification.level_progress_pct, 100)}
                      className="bg-muted h-2"
                      indicatorClassName="duration-slow"
                    />
                  </div>
                </>
              )}

              {/* XP Semanal */}
              <div className="gap-md pt-md flex items-center border-t first:border-t-0 first:pt-0">
                <div className="gap-sm flex items-center">
                  <div className="bg-warning/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Star className="text-warning h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl leading-none font-bold">{weeklyXP.xp}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {t('pages.planningDashboard.xpLabel')}
                    </p>
                  </div>
                </div>
                <div className="space-y-xs flex-1">
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>
                      {t('pages.planningDashboard.xpProgress', {
                        level: weeklyXP.level,
                      })}
                    </span>
                    <span>{weeklyXP.xpInLevel}/100 XP</span>
                  </div>
                  <Progress
                    value={weeklyXP.xpInLevel}
                    className="bg-muted h-2"
                    indicatorClassName="bg-warning duration-slow"
                  />
                </div>
                {weeklyXP.streak > 3 && (
                  <StreakBadge days={weeklyXP.streak} size="sm" pulse />
                )}
              </div>

              {/* Objetivos e sequências */}
              <div className="gap-md pt-md mt-auto grid grid-cols-2 border-t sm:grid-cols-4">
                {[
                  {
                    label: t('pages.planningDashboard.activeGoals'),
                    value: stats.active_goals,
                    icon: <Target className="h-4 w-4" />,
                  },
                  {
                    label: t('pages.planningDashboard.completedGoals'),
                    value: stats.completed_goals,
                    icon: <CheckCircle2 className="h-4 w-4" />,
                  },
                  {
                    label: t('pages.planningDashboard.currentStreak'),
                    value: `${stats.current_streak} ${t('pages.planningDashboard.days')}`,
                    icon: <Award className="text-info h-4 w-4" />,
                  },
                  {
                    label: t('pages.planningDashboard.bestStreak'),
                    value: `${stats.best_streak} ${t('pages.planningDashboard.days')}`,
                    icon: <Flame className="h-4 w-4 text-orange-500" />,
                  },
                ].map((item) => (
                  <div key={item.label} className="gap-xs flex flex-col">
                    <div className="gap-xs text-muted-foreground flex items-center">
                      {item.icon}
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <span className="text-xl font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="gap-sm flex items-center text-sm">
                  <TrendingUp className="h-4 w-4" />
                  {t('pages.planningDashboard.weeklyProgress')}
                </CardTitle>
              </CardHeader>
              <CardContent className="gap-md flex flex-col sm:flex-row">
                <div className="min-w-0 flex-1">
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
                </div>

                {/* Tarefas: hoje | ativas | taxa 7d | taxa 30d */}
                <div className="gap-md pt-md sm:pl-md grid shrink-0 grid-cols-2 border-t sm:flex sm:w-44 sm:flex-col sm:justify-between sm:border-t-0 sm:border-l sm:pt-0">
                  <div className="gap-sm flex items-center">
                    <CircularProgress
                      value={todayRate}
                      size={48}
                      strokeWidth={5}
                      color={todayRingColor}
                    >
                      <span className="text-xs font-bold">
                        {stats.completed_tasks_today}/{stats.total_tasks_today}
                      </span>
                    </CircularProgress>
                    <span className="text-muted-foreground text-xs">
                      {t('pages.planningDashboard.todayTasks')}
                    </span>
                  </div>
                  {[
                    {
                      label: t('pages.planningDashboard.activeTasks'),
                      value: stats.active_tasks,
                      icon: <ListTodo className="h-4 w-4" />,
                    },
                    {
                      label: t('pages.planningDashboard.completionRate7d'),
                      value: `${stats.completion_rate_7d.toFixed(1)}%`,
                      icon: <TrendingUp className="h-4 w-4" />,
                    },
                    {
                      label: t('pages.planningDashboard.completionRate30d'),
                      value: `${stats.completion_rate_30d.toFixed(1)}%`,
                      icon: <Calendar className="h-4 w-4" />,
                    },
                  ].map((item) => (
                    <div key={item.label} className="gap-xs flex flex-col">
                      <div className="gap-xs text-muted-foreground flex items-center">
                        {item.icon}
                        <span className="text-xs">{item.label}</span>
                      </div>
                      <span className="text-xl font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Collapse>

      {/* ── Seção Treinos & Nutrição (colapsável) ─────────────────────────── */}
      <SectionToggle
        label={t('pages.planningDashboard.sectionWorkoutNutrition')}
        open={openSection === 'workout-nutrition'}
        onToggle={() => toggleSection('workout-nutrition')}
      />

      <Collapse open={openSection === 'workout-nutrition'}>
        {/* Resumo Calórico | Treinos + Nutrição | Treinos por dia (30d) */}
        <div className="gap-md grid grid-cols-1 lg:grid-cols-3">
          <DailyCaloricSummaryCard
            data={caloricSummary}
            isLoading={caloricSummaryLoading}
          />

          <div className="gap-md flex flex-col">
            <Card>
              <CardHeader className="pb-sm">
                <div className="flex items-center justify-between">
                  <CardTitle className="gap-sm flex items-center text-sm">
                    <Dumbbell className="text-category-health h-4 w-4" />
                    {t('pages.planningDashboard.workoutsTitle')}
                  </CardTitle>
                  <Link
                    to="/planning/workout"
                    className="bg-primary/10 px-sm text-primary hover:bg-primary/20 rounded-md py-0.5 text-xs font-medium transition-colors"
                  >
                    {t('pages.planningDashboard.ctaLogWorkout')}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="gap-md grid grid-cols-2">
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
                      <Dumbbell className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.planningDashboard.sessions30d')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {workoutStats.sessions30d}
                    </span>
                  </div>
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.planningDashboard.thisWeek')}
                      </span>
                    </div>
                    <span className="text-info text-2xl font-bold">
                      {workoutStats.sessionsWeek}
                    </span>
                  </div>
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
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
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
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
                      <span className="text-muted-foreground text-sm">
                        {t('common.actions.none')}
                      </span>
                    )}
                  </div>
                </div>

                {workoutStats.activePlanName && (
                  <div className="mt-md gap-lg pt-md text-muted-foreground flex items-center border-t text-sm">
                    <span>
                      <span className="text-foreground font-semibold">
                        {workoutStats.activePlanDays}
                      </span>{' '}
                      {t('pages.planningDashboard.days')}
                    </span>
                    <span>
                      <span className="text-foreground font-semibold">
                        {workoutStats.activePlanExercises}
                      </span>{' '}
                      {t('pages.planningDashboard.planExercises')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-sm">
                <div className="flex items-center justify-between">
                  <CardTitle className="gap-sm flex items-center text-sm">
                    <UtensilsCrossed className="text-category-health h-4 w-4" />
                    {t('pages.planningDashboard.nutritionTitle')}
                  </CardTitle>
                  <Link
                    to="/planning/nutrition"
                    className="bg-success/10 px-sm text-success hover:bg-success/20 rounded-md py-0.5 text-xs font-medium transition-colors"
                  >
                    {t('pages.planningDashboard.ctaLogMeal')}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="gap-md grid grid-cols-3">
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
                      <Utensils className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.planningDashboard.mealsToday')}
                      </span>
                    </div>
                    <span className="text-success text-2xl font-bold">
                      {nutritionStats.todayMeals}
                    </span>
                  </div>
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.planningDashboard.thisWeek')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {nutritionStats.weekMeals}
                    </span>
                  </div>
                  <div className="gap-xs flex flex-col">
                    <div className="gap-sm text-muted-foreground flex items-center">
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
                  <div className="mt-md space-y-sm pt-md border-t">
                    {nutritionStats.byMealTypeData
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 4)
                      .map((item, i) => {
                        const max = nutritionStats.byMealTypeData[0]?.count ?? 1;
                        const pct = Math.round((item.count / max) * 100);
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-muted-foreground w-28 shrink-0 truncate text-xs">
                              {item.name}
                            </span>
                            <div className="gap-sm flex flex-1 items-center">
                              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                                <div
                                  className="bg-primary/70 h-full rounded-full transition-[width]"
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

          {workoutByDayData.length > 0 && (
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="gap-sm flex items-center text-sm">
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
        </div>
      </Collapse>

      {/* ── Seção Análise Detalhada (colapsável, lazy) ──────────────────────── */}
      <SectionToggle
        label={t('pages.planningDashboard.sectionDetailedAnalysis')}
        open={openSection === 'detailed-analysis'}
        onToggle={() => toggleSection('detailed-analysis')}
      />

      <Collapse open={openSection === 'detailed-analysis'}>
        <div className="space-y-lg">
          <div className="gap-lg grid grid-cols-1 lg:grid-cols-2">
            {/* Tarefas por categoria | Desempenho por dia da semana */}
            <Card>
              <CardContent className="gap-lg pt-md grid grid-cols-1 sm:grid-cols-2">
                <div>
                  <h3 className="gap-sm mb-sm flex items-center text-sm font-semibold">
                    <ListTodo className="h-4 w-4" />
                    {t('pages.planningDashboard.tasksByCategory')}
                  </h3>
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
                </div>
                {analytics && (
                  <div>
                    <h3 className="gap-sm mb-sm flex items-center text-sm font-semibold">
                      <BarChart3 className="h-4 w-4" />
                      {t('pages.planningDashboard.weekdayAnalytics')}
                    </h3>
                    <div className="space-y-sm">
                      {analytics.completion_by_weekday.map((day) => (
                        <div key={day.weekday} className="flex items-center gap-3">
                          <span className="text-muted-foreground w-28 shrink-0 text-sm">
                            {t(`pages.planningDashboard.weekdayShort.${day.weekday}`)}
                          </span>
                          <div className="gap-sm flex flex-1 items-center">
                            <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                              <div
                                className="bg-primary h-full rounded-full transition-[width]"
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
                    <p className="text-muted-foreground mt-3 text-xs">
                      {t('pages.planningDashboard.analyticsPeriod', {
                        days: analytics.period_days,
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Consistência de hábitos | Progresso de objetivos ativos */}
            <Card>
              <CardContent className="gap-lg pt-md grid grid-cols-1 sm:grid-cols-2">
                <div>
                  <h3 className="gap-sm mb-sm flex items-center text-sm font-semibold">
                    <Activity className="h-4 w-4" />
                    {t('pages.planningDashboard.habitConsistency')}
                  </h3>
                  <HabitHeatmap />
                </div>
                {stats.active_goals_progress &&
                  stats.active_goals_progress.length > 0 && (
                    <div>
                      <h3 className="gap-sm mb-sm flex items-center text-sm font-semibold">
                        <Flag className="h-4 w-4" />
                        {t('pages.planningDashboard.activeGoalsProgress')}
                      </h3>
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
                                <span className="text-xs font-bold">
                                  {pct.toFixed(0)}%
                                </span>
                              </CircularProgress>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {goal.title}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {goal.current_value} / {goal.target_value}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Linha 5b: Humor × Conclusão */}
          {reflectionCorrelation.length > 0 && (
            <Card>
              <CardHeader className="pb-sm">
                <div className="flex items-center justify-between">
                  <CardTitle className="gap-sm flex items-center text-sm">
                    <Activity className="text-info h-4 w-4" />
                    {t('pages.planningDashboard.reflectionCorrelationTitle', {
                      defaultValue: 'Humor × Conclusão de Tarefas',
                    })}
                  </CardTitle>
                  <Link
                    to="/planning/reflections"
                    className="bg-muted px-sm text-muted-foreground hover:text-foreground rounded-md py-0.5 text-xs font-medium transition-colors"
                  >
                    {t('pages.planningDashboard.ctaReflect')}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="gap-md flex flex-wrap">
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
                        className="gap-xs p-sm flex min-w-[120px] flex-1 flex-col rounded-lg border"
                      >
                        <div className="gap-xs flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            {dateLabel}
                          </span>
                          {entry.mood && (
                            <span
                              className={`px-xs rounded-full py-0.5 text-xs font-medium ${moodColor}`}
                            >
                              {entry.mood_display}
                            </span>
                          )}
                        </div>
                        <div className="gap-xs flex items-center">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full transition-[width]"
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
        </div>
      </Collapse>
    </PageContainer>
  );
}
