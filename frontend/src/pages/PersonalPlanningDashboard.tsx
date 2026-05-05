import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import { useChartColors, useTaskCategoryColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';

export default function PersonalPlanningDashboard() {
  const { t } = useTranslation();
  const COLORS = useChartColors();
  const categoryColors = useTaskCategoryColors();

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
        name: item.category_display,
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
      <PageHeader title={t('pages.planningDashboard.title')} icon={<Calendar />} />

      {/* Linha 1: Tarefas de Hoje | Taxa 7d | Tarefas ativas | Taxa 30d */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5">
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title={t('pages.planningDashboard.activeGoals')}
          value={stats.active_goals}
          icon={<Target className="h-4 w-4" />}
        />

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">
              {stats.best_streak}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {t('pages.planningDashboard.days')}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.planningDashboard.bestStreak')}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">
              {stats.current_streak}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {t('pages.planningDashboard.days')}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.planningDashboard.currentStreak')}
            </p>
          </div>
        </Card>

        <StatCard
          title={t('pages.planningDashboard.completedGoals')}
          value={stats.completed_goals}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Linha 3: Progresso Semanal | Tarefas por categoria | Progresso de objetivos | Consistência */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {weeklyProgressData.length > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
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
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
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
                formatter={(value) => `${value} ${value === 1 ? 'tarefa' : 'tarefas'}`}
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
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
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
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              {t('pages.planningDashboard.habitConsistency')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HabitHeatmap />
          </CardContent>
        </Card>
      </div>

      {/* Linha 4: Desempenho Dia Por Semana | Insight de Hábitos */}
      {analytics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('pages.planningDashboard.weekdayAnalytics')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.completion_by_weekday.map((day) => (
                  <div key={day.weekday} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-muted-foreground">
                      {day.weekday_display.slice(0, 3)}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
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
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  {t('pages.planningDashboard.insights')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analytics.insights.map((insight, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span className="mt-0.5 shrink-0 text-primary">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
