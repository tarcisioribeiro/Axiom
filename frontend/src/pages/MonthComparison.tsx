/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  ArrowDown,
  ArrowUp,
  Minus,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translate } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services/dashboard-service';

function buildMonthOptions(locale: Locale): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => ({
    value: format(subMonths(now, i), 'yyyy-MM'),
    label: format(subMonths(now, i), 'MMMM yyyy', { locale }),
  }));
}

function parseYearMonth(value: string): { year: number; month: number } {
  const [y, m] = value.split('-').map(Number);
  return { year: y, month: m };
}

interface VariationBadgeProps {
  pct: number;
  inverse?: boolean;
}

function VariationBadge({ pct, inverse = false }: VariationBadgeProps) {
  const { t } = useTranslation();
  if (Math.abs(pct) < 0.1)
    return (
      <span className="inline-flex items-center gap-xs text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> {t('monthComparison.noChange')}
      </span>
    );
  const isPositive = pct > 0;
  const isGood = inverse ? !isPositive : isPositive;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs text-xs font-medium',
        isGood ? 'text-success' : 'text-destructive'
      )}
    >
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface SummaryCardProps {
  title: string;
  icon: React.ReactNode;
  valueA: number;
  valueB: number;
  inverse?: boolean;
}

function SummaryCard({
  title,
  icon,
  valueA,
  valueB,
  inverse = false,
}: SummaryCardProps) {
  const pct = valueA !== 0 ? ((valueB - valueA) / Math.abs(valueA)) * 100 : 0;
  const diff = valueB - valueA;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="rounded-lg bg-muted p-sm">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-sm">
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <p className="text-xs text-muted-foreground">A</p>
            <p className="text-lg font-bold">{formatCurrency(valueA)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">B</p>
            <p className="text-lg font-bold">{formatCurrency(valueB)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-sm">
          <span className="text-xs text-muted-foreground">
            {diff >= 0 ? '+' : ''}
            {formatCurrency(diff)}
          </span>
          <VariationBadge pct={pct} inverse={inverse} />
        </div>
      </CardContent>
    </Card>
  );
}

interface MonthSelectorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

function MonthSelector({
  label,
  value,
  onChange,
  options,
  placeholder,
}: MonthSelectorProps) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function MonthComparison({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  const monthOptions = useMemo(() => buildMonthOptions(dateFnsLocale), [dateFnsLocale]);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  const [monthA, setMonthA] = useState(prevMonth);
  const [monthB, setMonthB] = useState(currentMonth);

  const parsedA = useMemo(() => parseYearMonth(monthA), [monthA]);
  const parsedB = useMemo(() => parseYearMonth(monthB), [monthB]);

  const queryA = useQuery({
    queryKey: ['dashboard', 'monthlyStatement', parsedA.year, parsedA.month],
    queryFn: () => dashboardService.getMonthlyStatement(parsedA.year, parsedA.month),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const queryB = useQuery({
    queryKey: ['dashboard', 'monthlyStatement', parsedB.year, parsedB.month],
    queryFn: () => dashboardService.getMonthlyStatement(parsedB.year, parsedB.month),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading = queryA.isLoading || queryB.isLoading;

  const dataA = queryA.data;
  const dataB = queryB.data;

  const labelA = monthOptions.find((m) => m.value === monthA)?.label ?? monthA;
  const labelB = monthOptions.find((m) => m.value === monthB)?.label ?? monthB;

  const expenseCategoryMap = useMemo(() => {
    if (!dataA || !dataB) return [];
    const allCategories = new Set([
      ...dataA.expenses_by_category.map((c) => c.category),
      ...dataB.expenses_by_category.map((c) => c.category),
    ]);
    return Array.from(allCategories)
      .map((cat) => {
        const a = dataA.expenses_by_category.find((c) => c.category === cat);
        const b = dataB.expenses_by_category.find((c) => c.category === cat);
        const totalA = parseFloat(a?.total ?? '0');
        const totalB = parseFloat(b?.total ?? '0');
        return { cat, totalA, totalB, diff: totalB - totalA };
      })
      .sort((a, b) => Math.max(b.totalA, b.totalB) - Math.max(a.totalA, a.totalB));
  }, [dataA, dataB]);

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader
        title={t('monthComparison.title')}
        icon={<BarChart3 />}
        subtitle={t('monthComparison.subtitle')}
      />

      <div className="flex flex-wrap items-end gap-md rounded-lg border bg-muted/40 p-md">
        <MonthSelector
          label={t('monthComparison.monthA')}
          value={monthA}
          onChange={setMonthA}
          options={monthOptions}
          placeholder={t('monthComparison.selectMonthA')}
        />
        <MonthSelector
          label={t('monthComparison.monthB')}
          value={monthB}
          onChange={setMonthB}
          options={monthOptions}
          placeholder={t('monthComparison.selectMonthB')}
        />
      </div>

      {isLoading && <LoadingState />}

      {!isLoading && dataA && dataB && (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">A</strong> = {labelA} &nbsp;·&nbsp;{' '}
              <strong className="text-foreground">B</strong> = {labelB}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <SummaryCard
              title={t('monthComparison.revenues')}
              icon={<TrendingUp className="h-4 w-4 text-success" />}
              valueA={parseFloat(dataA.total_revenues)}
              valueB={parseFloat(dataB.total_revenues)}
            />
            <SummaryCard
              title={t('monthComparison.expenses')}
              icon={<TrendingDown className="h-4 w-4 text-destructive" />}
              valueA={parseFloat(dataA.total_expenses)}
              valueB={parseFloat(dataB.total_expenses)}
              inverse
            />
            <SummaryCard
              title={t('monthComparison.balance')}
              icon={<Wallet className="h-4 w-4 text-primary" />}
              valueA={parseFloat(dataA.balance)}
              valueB={parseFloat(dataB.balance)}
            />
          </div>

          {expenseCategoryMap.length > 0 && (
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="text-base">
                  {t('monthComparison.expenseBreakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-sm">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-sm text-xs font-medium text-muted-foreground">
                    <span>{t('common.fields.category')}</span>
                    <span className="text-right">A</span>
                    <span className="text-right">B</span>
                    <span className="text-right">{t('monthComparison.variation')}</span>
                  </div>
                  {expenseCategoryMap.map(({ cat, totalA, totalB, diff: _diff }) => {
                    const pct =
                      totalA !== 0 ? ((totalB - totalA) / Math.abs(totalA)) * 100 : 0;
                    return (
                      <div
                        key={cat}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-sm border-t pt-sm text-sm"
                      >
                        <span className="truncate font-medium">
                          {translate('expenseCategories', cat)}
                        </span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(totalA)}
                        </span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(totalB)}
                        </span>
                        <div className="text-right">
                          <VariationBadge pct={pct} inverse />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!isLoading && (!dataA || !dataB) && (
        <EmptyState
          icon={<BarChart3 className="h-10 w-10" />}
          title={t('monthComparison.emptyState')}
        />
      )}
    </Wrapper>
  );
}
