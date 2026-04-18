import { useQuery } from '@tanstack/react-query';
import {
  Target,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Award,
  ListTodo,
  Flag,
  Smile,
  Frown,
  Meh,
  SmilePlus,
  Angry,
  Activity,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useChartColors, useTaskCategoryColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';
import type { DailyReflection } from '@/types';

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

  // Processar dados para gráficos
  const weeklyProgressData = stats?.weekly_progress
    ? stats.weekly_progress.map((item) => {
        // Parse da data sem problemas de timezone - a data vem como "YYYY-MM-DD"
        const parts = item.date.split('-');
        const day = parts[2];
        const month = parts[1];
        const dateStr = `${day}/${month}`;
        return {
          date: dateStr,
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

  // Função para obter cor por categoria (usa cores do tema)
  const getCategoryColor = (category: string) => {
    return (
      categoryColors[category as keyof typeof categoryColors] || categoryColors.other
    );
  };

  // Ícone de mood - usando cores Dracula
  const getMoodIcon = (mood?: string) => {
    switch (mood) {
      case 'excellent':
        return <SmilePlus className="h-4 w-4 text-success" />;
      case 'good':
        return <Smile className="h-4 w-4 text-info" />;
      case 'neutral':
        return <Meh className="h-4 w-4" />;
      case 'bad':
        return <Frown className="h-4 w-4 text-warning" />;
      case 'terrible':
        return <Angry className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

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

      {/* Grid 1: 8 Cards de Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('pages.planningDashboard.todayTasks')}
          value={`${stats.completed_tasks_today} / ${stats.total_tasks_today}`}
          icon={<Calendar className="h-4 w-4" />}
        />

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

        <StatCard
          title={t('pages.planningDashboard.activeGoals')}
          value={stats.active_goals}
          icon={<Target className="h-4 w-4" />}
        />

        <StatCard
          title={t('pages.planningDashboard.bestStreak')}
          value={`${stats.best_streak} ${t('pages.planningDashboard.days')}`}
          icon={<Award className="h-4 w-4" />}
        />

        <StatCard
          title={t('pages.planningDashboard.currentStreak')}
          value={`${stats.current_streak} ${t('pages.planningDashboard.days')}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <StatCard
          title={t('pages.planningDashboard.completedGoals')}
          value={stats.completed_goals}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Grid 2: Gráficos de Visualização */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Gráfico 1: Progresso Semanal */}
        {weeklyProgressData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
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
                height={350}
              />
            </CardContent>
          </Card>
        )}

        {/* Gráfico 2: Tarefas por Categoria */}
        {tasksByCategoryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
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
                height={350}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Grid 3: Progresso de Objetivos Ativos */}
      {stats.active_goals_progress && stats.active_goals_progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              {t('pages.planningDashboard.activeGoalsProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stats.active_goals_progress.map((goal, index) => (
                <div key={index}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{goal.title}</span>
                    <span className="text-sm">{goal.progress_percentage}%</span>
                  </div>
                  <Progress value={goal.progress_percentage} className="h-3" />
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span>
                      {goal.current_value}/{goal.target_value}
                    </span>
                    <span>
                      {goal.days_active} {t('pages.planningDashboard.activeDays')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid 4: Heatmap de Consistência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('pages.planningDashboard.habitConsistency')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HabitHeatmap />
        </CardContent>
      </Card>

      {/* Grid 5: Reflexões Recentes com Ícones de Mood */}
      {stats.recent_reflections && stats.recent_reflections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5" />
              {t('pages.planningDashboard.recentReflections')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recent_reflections.map((reflection: DailyReflection) => (
                <div
                  key={reflection.id}
                  className="border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="text-sm font-medium">
                      {new Date(reflection.date).toLocaleDateString('pt-BR')}
                    </span>
                    {reflection.mood && (
                      <div className="flex items-center gap-2">
                        {getMoodIcon(reflection.mood)}
                        <span className="text-sm capitalize">
                          {reflection.mood_display}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{reflection.reflection}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid 6: Analytics — Desempenho por Dia da Semana */}
      {analytics && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
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
