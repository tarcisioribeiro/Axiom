/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Star,
  AlertTriangle,
  Sun,
  Award,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { useSemanticColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { habitHeatmapService } from '@/services/habit-heatmap-service';
import { personalPlanningDashboardService } from '@/services/personal-planning-dashboard-service';
import type { HabitInsight, WeekdayAnalytics } from '@/types';

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'Seg',
  1: 'Ter',
  2: 'Qua',
  3: 'Qui',
  4: 'Sex',
  5: 'Sáb',
  6: 'Dom',
};

function InsightCard({ insight }: { insight: HabitInsight }) {
  const { t } = useTranslation();

  const config: Record<
    string,
    {
      icon: React.ReactNode;
      label: string;
      variant: 'success' | 'warning' | 'danger' | 'default';
    }
  > = {
    best_day: {
      icon: <Star className="h-4 w-4" />,
      label: t('pages.personalAnalytics.insights.bestDay', {
        day: insight.weekday !== undefined ? WEEKDAY_SHORT[insight.weekday] : '',
        rate: insight.rate,
      }),
      variant: 'success',
    },
    worst_day: {
      icon: <TrendingDown className="h-4 w-4" />,
      label: t('pages.personalAnalytics.insights.worstDay', {
        day: insight.weekday !== undefined ? WEEKDAY_SHORT[insight.weekday] : '',
        rate: insight.rate,
      }),
      variant: 'warning',
    },
    weekend_drop: {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: t('pages.personalAnalytics.insights.weekendDrop', {
        weekday: insight.weekday_rate,
        weekend: insight.weekend_rate,
      }),
      variant: 'warning',
    },
    weekend_better: {
      icon: <Sun className="h-4 w-4" />,
      label: t('pages.personalAnalytics.insights.weekendBetter', {
        weekend: insight.weekend_rate,
        weekday: insight.weekday_rate,
      }),
      variant: 'default',
    },
    overall_excellent: {
      icon: <Award className="h-4 w-4" />,
      label: t('pages.personalAnalytics.insights.overallExcellent', {
        rate: insight.rate,
      }),
      variant: 'success',
    },
    overall_low: {
      icon: <TrendingUp className="h-4 w-4" />,
      label: t('pages.personalAnalytics.insights.overallLow', { rate: insight.rate }),
      variant: 'danger',
    },
  };

  const item = config[insight.type];
  if (!item) return null;

  const variantClass = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-destructive/30 bg-destructive/10 text-destructive',
    default: 'border-primary/30 bg-primary/10 text-primary',
  }[item.variant];

  return (
    <div
      className={cn('gap-sm p-md flex items-center rounded-lg border', variantClass)}
    >
      {item.icon}
      <p className="text-sm font-medium">{item.label}</p>
    </div>
  );
}

interface HeatmapCalendarProps {
  data: Array<{
    date: string;
    completed: number;
    expected: number;
    is_scheduled: boolean;
  }>;
  year: number;
}

function HeatmapCalendar({ data, year }: HeatmapCalendarProps) {
  const { t } = useTranslation();
  const dataByDate = Object.fromEntries(data.map((d) => [d.date, d]));

  const weeks: Array<Array<{ date: Date | null; key: string }>> = [];
  const jan1 = new Date(year, 0, 1);
  const startDay = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1;
  const dec31 = new Date(year, 11, 31);
  const totalDays = Math.floor((dec31.getTime() - jan1.getTime()) / 86400000) + 1;

  const cells: Array<{ date: Date | null; key: string }> = [];
  for (let i = 0; i < startDay; i++) cells.push({ date: null, key: `pad-${i}` });
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(year, 0, 1 + i);
    cells.push({ date: d, key: d.toISOString().slice(0, 10) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, key: `end-${cells.length}` });

  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const getColor = (key: string): string => {
    const d = dataByDate[key];
    if (!d?.is_scheduled) return 'bg-muted/30';
    if (d.completed === 0) return 'bg-muted';
    const pct = d.expected > 0 ? d.completed / d.expected : 0;
    if (pct >= 1) return 'bg-success';
    if (pct >= 0.6) return 'bg-success/60';
    return 'bg-success/30';
  };

  const MONTH_LABELS = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const weekdayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

  return (
    <div className="overflow-x-auto">
      <div className="gap-xs flex">
        {/* Weekday labels column */}
        <div className="pt-lg flex flex-col gap-px">
          {weekdayLabels.map((label, i) => (
            <div
              key={i}
              className="text-muted-foreground text-2xs flex h-3 w-3 items-center justify-center"
            >
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>
        {/* Weeks */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-px">
            {weeks.map((week, wIdx) => {
              const firstReal = week.find((c) => c.date !== null);
              const monthLabel =
                firstReal?.date && firstReal.date.getDate() <= 7
                  ? MONTH_LABELS[firstReal.date.getMonth()]
                  : '';
              return (
                <div key={wIdx} className="flex flex-col gap-px">
                  <div className="text-muted-foreground text-2xs h-4">{monthLabel}</div>
                  {week.map((cell) => {
                    if (!cell.date)
                      return <div key={cell.key} className="h-3 w-3 rounded-sm" />;
                    const d = dataByDate[cell.key];
                    const label = d
                      ? t('pages.personalAnalytics.heatmapTooltip', {
                          date: cell.date.toLocaleDateString('pt-BR'),
                          completed: d.completed,
                          expected: d.expected,
                        })
                      : cell.date.toLocaleDateString('pt-BR');
                    return (
                      <div
                        key={cell.key}
                        title={label}
                        className={cn('h-3 w-3 rounded-sm', getColor(cell.key))}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-sm gap-sm text-muted-foreground flex items-center text-xs">
        <span>{t('pages.personalAnalytics.less')}</span>
        {['bg-muted', 'bg-success/30', 'bg-success/60', 'bg-success'].map((cls) => (
          <div key={cls} className={cn('h-3 w-3 rounded-sm', cls)} />
        ))}
        <span>{t('pages.personalAnalytics.more')}</span>
      </div>
    </div>
  );
}

function WeekdayBarChart({ data }: { data: WeekdayAnalytics[] }) {
  const semanticColors = useSemanticColors();
  const { t } = useTranslation();

  const chartData = data.map((d) => ({
    name: WEEKDAY_SHORT[d.weekday],
    rate: d.rate ?? 0,
    total: d.total,
    completed: d.completed,
  }));

  const getBarColor = (rate: number) => {
    if (rate >= 75) return semanticColors.success;
    if (rate >= 50) return semanticColors.warning;
    return semanticColors.danger;
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [
            `${Number(value)}%`,
            t('pages.personalAnalytics.completionRate'),
          ]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.rate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function PersonalAnalytics() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const analyticsQuery = useQuery({
    queryKey: ['personalPlanning', 'analytics'],
    queryFn: () => personalPlanningDashboardService.getAnalytics(),
    staleTime: STALE_TIMES.DASHBOARD_STATS,
  });

  const statsQuery = useQuery({
    queryKey: ['personalPlanning', 'stats'],
    queryFn: () => personalPlanningDashboardService.getStats(),
    staleTime: STALE_TIMES.DASHBOARD_STATS,
  });

  const heatmapQuery = useQuery({
    queryKey: ['habitHeatmap', currentYear],
    queryFn: () => habitHeatmapService.getHeatmap({ year: currentYear }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading = analyticsQuery.isLoading || statsQuery.isLoading;

  if (isLoading) return <LoadingState />;

  const analytics = analyticsQuery.data;
  const stats = statsQuery.data;
  const heatmap = heatmapQuery.data;

  const overallAvg = analytics
    ? (() => {
        const withData = analytics.completion_by_weekday.filter((d) => d.rate !== null);
        if (!withData.length) return null;
        return Math.round(
          withData.reduce((s, d) => s + (d.rate ?? 0), 0) / withData.length
        );
      })()
    : null;

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.personalAnalytics.title')}
          description={t('pages.personalAnalytics.description')}
          icon={<BarChart3 className="text-primary h-6 w-6" />}
        />

        {/* Summary stats */}
        <div className="mb-lg gap-md grid grid-cols-2 sm:grid-cols-4">
          <StatCard
            title={t('pages.personalAnalytics.rate7d')}
            value={`${stats?.completion_rate_7d ?? 0}%`}
            variant={
              (stats?.completion_rate_7d ?? 0) >= 75
                ? 'success'
                : (stats?.completion_rate_7d ?? 0) >= 50
                  ? 'warning'
                  : 'danger'
            }
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            title={t('pages.personalAnalytics.rate30d')}
            value={`${stats?.completion_rate_30d ?? 0}%`}
            variant={
              (stats?.completion_rate_30d ?? 0) >= 75
                ? 'success'
                : (stats?.completion_rate_30d ?? 0) >= 50
                  ? 'warning'
                  : 'danger'
            }
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            title={t('pages.personalAnalytics.currentStreak')}
            value={`${stats?.current_streak ?? 0} ${t('pages.personalAnalytics.days')}`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title={t('pages.personalAnalytics.bestStreak')}
            value={`${stats?.best_streak ?? 0} ${t('pages.personalAnalytics.days')}`}
            icon={<Award className="h-4 w-4" />}
          />
        </div>

        <div className="gap-lg grid lg:grid-cols-3">
          {/* Left: weekday bar chart + insights */}
          <div className="space-y-lg lg:col-span-2">
            {/* Weekday completion chart */}
            <div className="bg-card p-md rounded-lg border">
              <div className="mb-md flex items-center justify-between">
                <h3 className="font-semibold">
                  {t('pages.personalAnalytics.weekdayChart')}
                </h3>
                {overallAvg !== null && (
                  <Badge variant="secondary">
                    {t('pages.personalAnalytics.avg90d')}: {overallAvg}%
                  </Badge>
                )}
              </div>
              {analytics?.completion_by_weekday.some((d) => d.total > 0) ? (
                <WeekdayBarChart data={analytics.completion_by_weekday} />
              ) : (
                <p className="py-lg text-muted-foreground text-center text-sm">
                  {t('pages.personalAnalytics.noData')}
                </p>
              )}
            </div>

            {/* Heatmap */}
            <div className="bg-card p-md rounded-lg border">
              <h3 className="mb-md font-semibold">
                {t('pages.personalAnalytics.heatmap')} {currentYear}
              </h3>
              {heatmap ? (
                <HeatmapCalendar data={heatmap.data} year={currentYear} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('pages.personalAnalytics.noData')}
                </p>
              )}
            </div>
          </div>

          {/* Right: insights */}
          <div className="space-y-md">
            <div className="bg-card p-md rounded-lg border">
              <h3 className="mb-md font-semibold">
                {t('pages.personalAnalytics.insightsTitle')}
              </h3>
              {analytics && analytics.insights.length > 0 ? (
                <div className="space-y-sm">
                  {analytics.insights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('pages.personalAnalytics.noInsights')}
                </p>
              )}
            </div>

            {/* Category distribution */}
            {stats && stats.tasks_by_category.length > 0 && (
              <div className="bg-card p-md rounded-lg border">
                <h3 className="mb-md font-semibold">
                  {t('pages.personalAnalytics.byCategory')}
                </h3>
                <div className="space-y-sm">
                  {stats.tasks_by_category.slice(0, 6).map((cat) => {
                    const maxCount = Math.max(
                      ...stats.tasks_by_category.map((c) => c.count)
                    );
                    const pct = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
                    return (
                      <div key={cat.category} className="space-y-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{cat.category_display}</span>
                          <span className="text-muted-foreground">{cat.count}</span>
                        </div>
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </AnimatedPage>
  );
}
