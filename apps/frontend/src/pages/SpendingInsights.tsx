/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Flame,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChartColors, useSemanticColors } from '@/lib/chart-colors';
import { axisFormatCurrency } from '@/lib/chart-formatters';
import { formatCurrency } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services/dashboard-service';

type TrendDirection = 'up' | 'down' | 'stable';

function TrendBadge({ direction, pct }: { direction: TrendDirection; pct: number }) {
  const { t } = useTranslation();
  if (direction === 'stable' || Math.abs(pct) < 0.5) {
    return (
      <span className="gap-xs text-muted-foreground inline-flex items-center text-xs">
        <Minus className="h-3 w-3" />
        {t('spendingInsights.stable')}
      </span>
    );
  }
  const isUp = direction === 'up';
  return (
    <span
      className={cn(
        'gap-xs px-sm py-xs inline-flex items-center rounded-full text-xs font-semibold',
        isUp ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
      )}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface TooltipEntry {
  dataKey: string | number;
  value: number;
  color: string;
}

function CurrencyTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover px-md py-sm rounded-lg border text-sm shadow-lg">
      <p className="mb-xs text-foreground font-medium">
        {labelFormatter && label ? labelFormatter(label) : label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="text-xs">
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// Backend retorna "YYYY-MM"; exibimos no padrão brasileiro MM/YYYY.
function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  if (!year || !m) return month;
  return `${m}/${year}`;
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function SpendingInsights({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation();
  const chartColors = useChartColors();
  const semanticColors = useSemanticColors();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'spendingInsights'],
    queryFn: () => dashboardService.getSpendingInsights(),
    staleTime: STALE_TIMES.DASHBOARD_STATS,
  });

  if (isLoading) return <LoadingState />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  if (isError || !data) {
    return (
      <Wrapper>
        <PageHeader title={t('spendingInsights.title')} />
        <EmptyState
          title={t('spendingInsights.unavailable')}
          description={t('spendingInsights.unavailableDesc')}
          icon={<BarChart3 className="h-8 w-8" />}
        />
      </Wrapper>
    );
  }

  const {
    current_month,
    trend,
    top_categories,
    growing_categories,
    monthly_breakdown,
  } = data;

  const trendDirection: TrendDirection =
    trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'down' : 'stable';

  const TrendIcon =
    trendDirection === 'up'
      ? TrendingUp
      : trendDirection === 'down'
        ? TrendingDown
        : Minus;

  const monthName = new Date(
    current_month.year,
    current_month.month - 1
  ).toLocaleString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <Wrapper>
      <PageHeader
        title={t('spendingInsights.title')}
        description={t('spendingInsights.description', { month: monthName })}
      />

      {/* Trend summary row */}
      <div className="gap-lg grid grid-cols-1 sm:grid-cols-3">
        {/* Current month total */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t('spendingInsights.totalMonth', { month: monthName })}
            </CardTitle>
            <div
              className={cn(
                'p-sm rounded-lg',
                trendDirection === 'up'
                  ? 'bg-destructive/10'
                  : trendDirection === 'down'
                    ? 'bg-success/10'
                    : 'bg-muted'
              )}
            >
              <TrendIcon
                className={cn(
                  'h-4 w-4',
                  trendDirection === 'up'
                    ? 'text-destructive'
                    : trendDirection === 'down'
                      ? 'text-success'
                      : 'text-muted-foreground'
                )}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-sm">
            <p className="text-3xl font-bold tracking-tight">
              {formatCurrency(current_month.total_expenses)}
            </p>
            <div className="gap-md flex items-center">
              <TrendBadge direction={trendDirection} pct={trend.pct_change} />
              <span className="text-muted-foreground text-xs">
                {t('spendingInsights.vsPriorAvg', {
                  value: formatCurrency(trend.prior_avg),
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Growing categories count */}
        <Card>
          <CardHeader className="pb-sm flex flex-row items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t('spendingInsights.risingCategories')}
            </CardTitle>
            <div className="bg-destructive/10 p-sm rounded-lg">
              <Flame className="text-destructive h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">
              {growing_categories.length}
            </p>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('spendingInsights.aboveAverage')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="gap-lg grid grid-cols-1 lg:grid-cols-2">
        {/* Top categories bar chart */}
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-medium">
              {t('spendingInsights.topCategories')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top_categories.length === 0 ? (
              <p className="py-lg text-muted-foreground text-center text-sm">
                {t('spendingInsights.noCategories')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={top_categories.map((c) => ({
                    ...c,
                    name: translateCategory(c.category, 'expense'),
                  }))}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={axisFormatCurrency}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {top_categories.map((_, idx) => (
                      <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly breakdown line chart */}
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-medium">
              {t('spendingInsights.monthlyEvolution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthly_breakdown.length === 0 ? (
              <p className="py-lg text-muted-foreground text-center text-sm">
                {t('spendingInsights.noHistoryData')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={monthly_breakdown}
                  margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={axisFormatCurrency}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    content={<CurrencyTooltip labelFormatter={formatMonthLabel} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={semanticColors.primary}
                    strokeWidth={2}
                    dot={{ r: 4, fill: semanticColors.primary }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growing categories list */}
      {growing_categories.length > 0 && (
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-medium">
              {t('spendingInsights.highestGrowthCategories')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-border divide-y">
              {growing_categories.map((item, idx) => (
                <div
                  key={item.category}
                  className="py-sm flex items-center justify-between"
                >
                  <div className="gap-sm flex items-center">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{
                        backgroundColor: chartColors[idx % chartColors.length],
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium">
                      {translateCategory(item.category, 'expense')}
                    </span>
                  </div>
                  <div className="gap-md flex items-center text-right">
                    <div className="hidden sm:block">
                      <p className="text-muted-foreground text-xs">
                        {t('spendingInsights.current')}: {formatCurrency(item.current)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t('spendingInsights.average')}:{' '}
                        {formatCurrency(item.prior_avg)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-destructive/50 text-destructive text-xs font-semibold"
                    >
                      +{item.pct_change.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </Wrapper>
  );
}
