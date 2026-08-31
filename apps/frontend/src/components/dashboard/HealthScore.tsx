import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ProgressGauge } from '@/components/common/ProgressGauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_CONFIG } from '@/config/api-config';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';

interface HealthDimension {
  score: number;
  max: number;
  label: string;
  description: string;
  ratio?: number | null;
  rate?: number;
  overdue_count?: number;
  total_commitments?: number;
  on_time_rate?: number;
}

interface HealthScoreData {
  score: number;
  grade: string;
  dimensions: {
    liquidity: HealthDimension;
    debt: HealthDimension;
    savings: HealthDimension;
    compliance: HealthDimension;
  };
}

const GRADE_COLORS: Record<string, { color: string; hex: string }> = {
  A: { color: 'text-emerald-500', hex: '#10b981' },
  B: { color: 'text-green-500', hex: '#22c55e' },
  C: { color: 'text-yellow-500', hex: '#eab308' },
  D: { color: 'text-orange-500', hex: '#f97316' },
  F: { color: 'text-red-500', hex: '#ef4444' },
};

const DIMENSION_ICONS = {
  liquidity: TrendingUp,
  debt: TrendingDown,
  savings: Activity,
  compliance: CheckCircle,
};

function DimensionBar({
  dimension,
  value,
}: {
  dimension: string;
  value: HealthDimension;
}) {
  const { t } = useTranslation();
  const Icon = DIMENSION_ICONS[dimension as keyof typeof DIMENSION_ICONS] ?? Activity;
  const pct = Math.round((value.score / value.max) * 100);

  const barColor =
    pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  let detail = '';
  if (dimension === 'liquidity' && value.ratio != null) {
    detail = t('pages.dashboard.healthScore.dimensions.liquidityDetail', {
      ratio: value.ratio.toFixed(1),
    });
  } else if (dimension === 'debt' && value.ratio != null) {
    detail = t('pages.dashboard.healthScore.dimensions.debtDetail', {
      ratio: (value.ratio * 100).toFixed(0),
    });
  } else if (dimension === 'savings' && value.rate != null) {
    detail = t('pages.dashboard.healthScore.dimensions.savingsDetail', {
      rate: value.rate.toFixed(1),
    });
  } else if (dimension === 'compliance' && value.on_time_rate != null) {
    detail = t('pages.dashboard.healthScore.dimensions.complianceDetail', {
      rate: value.on_time_rate.toFixed(0),
    });
    if (value.overdue_count) {
      detail += ` ${t('pages.dashboard.healthScore.dimensions.overdue', { count: value.overdue_count })}`;
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          <Icon className="text-muted-foreground h-3.5 w-3.5" />
          {t(`pages.dashboard.healthScore.dimensions.${dimension}`, {
            defaultValue: value.label,
          })}
        </div>
        <span className="text-muted-foreground tabular-nums">
          {value.score.toFixed(1)} / {value.max}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full w-full origin-left rounded-full transition-transform duration-700',
            barColor
          )}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
    </div>
  );
}

export function HealthScore() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery<HealthScoreData>({
    queryKey: ['dashboard', 'healthScore'],
    queryFn: () =>
      apiClient.get<HealthScoreData>(API_CONFIG.ENDPOINTS.DASHBOARD_HEALTH_SCORE),
    staleTime: STALE_TIMES.DASHBOARD_STATS,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('pages.dashboard.healthScore.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="bg-muted mx-auto h-16 w-16 rounded-full" />
            <div className="bg-muted h-3 w-full rounded" />
            <div className="bg-muted h-3 w-full rounded" />
            <div className="bg-muted h-3 w-full rounded" />
            <div className="bg-muted h-3 w-full rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <AlertCircle className="h-4 w-4" />
          {t('pages.dashboard.healthScore.loadError')}
        </CardContent>
      </Card>
    );
  }

  const gradeColors = GRADE_COLORS[data.grade] ?? GRADE_COLORS['F'];
  const gradeLabel = t(`pages.dashboard.healthScore.grades.${data.grade}`, {
    defaultValue: data.grade,
  });
  const dimOrder = ['liquidity', 'savings', 'debt', 'compliance'] as const;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {t('pages.dashboard.healthScore.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score gauge */}
        <div className="flex flex-col items-center gap-1">
          <ProgressGauge
            value={data.score}
            size={80}
            strokeWidth={7}
            color={gradeColors.hex}
            label={
              <span className={cn('text-2xl', gradeColors.color)}>{data.grade}</span>
            }
            sublabel={`${data.score.toFixed(0)}/100`}
          />
          <p className={cn('text-sm font-medium', gradeColors.color)}>{gradeLabel}</p>
        </div>

        {/* Dimension bars */}
        <div className="space-y-3">
          {dimOrder.map((key) => (
            <DimensionBar key={key} dimension={key} value={data.dimensions[key]} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
