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
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useChartColors, useTaskCategoryColors } from '@/lib/chart-colors';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';
import type { PersonalPlanningDashboardStats, DailyReflection } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function PersonalPlanningDashboard() {
  const [stats, setStats] = useState<PersonalPlanningDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const COLORS = useChartColors();
  const categoryColors = useTaskCategoryColors();

  useEffect(() => {
    void loadData();

    // Recarregar dados quando a aba/janela volta ao foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    };

    const handleFocus = () => {
      void loadData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await personalPlanningDashboardService.getStats();
      setStats(data);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Processar dados para gráficos
  const weeklyProgressData = useMemo(() => {
    if (!stats?.weekly_progress) return [];
    return stats.weekly_progress.map((item) => {
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
    });
  }, [stats?.weekly_progress]);

  const tasksByCategoryData = useMemo(() => {
    if (!stats?.tasks_by_category) return [];
    return stats.tasks_by_category.map((item) => ({
      category: item.category,
      name: item.category_display,
      count: item.count,
    }));
  }, [stats?.tasks_by_category]);

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
      <div className="space-y-6 px-4 py-8">
        <PageHeader title="Dashboard de Planejamento Pessoal" icon={<Calendar />} />
        <p className="text-center">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-8">
      <PageHeader title="Dashboard de Planejamento Pessoal" icon={<Calendar />} />

      {/* Grid 1: 8 Cards de Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tarefas de Hoje"
          value={`${stats.completed_tasks_today} / ${stats.total_tasks_today}`}
          icon={<Calendar className="h-4 w-4" />}
        />

        <StatCard
          title="Taxa Cumprimento 7d"
          value={`${stats.completion_rate_7d.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <StatCard
          title="Tarefas Ativas"
          value={stats.active_tasks}
          icon={<ListTodo className="h-4 w-4" />}
        />

        <StatCard
          title="Taxa Cumprimento 30d"
          value={`${stats.completion_rate_30d.toFixed(1)}%`}
          icon={<Calendar className="h-4 w-4" />}
        />

        <StatCard
          title="Objetivos Ativos"
          value={stats.active_goals}
          icon={<Target className="h-4 w-4" />}
        />

        <StatCard
          title="Melhor Sequência"
          value={`${stats.best_streak} dias`}
          icon={<Award className="h-4 w-4" />}
        />

        <StatCard
          title="Sequência Atual"
          value={`${stats.current_streak} dias`}
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <StatCard
          title="Objetivos Completados"
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
                Progresso Semanal
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
                emptyMessage="Nenhum dado de progresso"
                lockChartType="line"
                dualYAxis={{
                  left: { dataKey: 'total', label: 'Tarefas', color: COLORS[0] },
                  right: { dataKey: 'taxa', label: 'Taxa %', color: COLORS[1] },
                }}
                lines={[
                  {
                    dataKey: 'total',
                    stroke: COLORS[0],
                    yAxisId: 'left',
                    name: 'Total',
                  },
                  {
                    dataKey: 'completadas',
                    stroke: COLORS[3],
                    yAxisId: 'left',
                    name: 'Completadas',
                  },
                  {
                    dataKey: 'taxa',
                    stroke: COLORS[1],
                    yAxisId: 'right',
                    name: 'Taxa %',
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
                Tarefas por Categoria
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
                emptyMessage="Nenhuma tarefa cadastrada"
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
              Progresso de Objetivos Ativos
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
                    <span>{goal.days_active} dias ativos</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid 4: Reflexões Recentes com Ícones de Mood */}
      {stats.recent_reflections && stats.recent_reflections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5" />
              Reflexões Recentes
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
    </div>
  );
}
