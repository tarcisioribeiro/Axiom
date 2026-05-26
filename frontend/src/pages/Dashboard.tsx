/* eslint-disable max-lines */
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  format,
  subMonths,
  subWeeks,
  subYears,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  eachDayOfInterval,
  parseISO,
} from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  LayoutDashboard,
  Building2,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  FileDown,
  AlertTriangle,
  Download,
  FileText,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatementExportModal } from '@/components/common/StatementExportModal';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { HealthScore } from '@/components/dashboard/HealthScore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { translate, TRANSLATIONS } from '@/config/constants';
import { GREETING_ICONS } from '@/config/icons';
import { useToast } from '@/hooks/use-toast';
import { containerVariants, itemVariants } from '@/lib/animations';
import { useChartColors } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { budgetsService } from '@/services/budgets-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { dashboardService, type IRReport } from '@/services/dashboard-service';
import { expensesService } from '@/services/expenses-service';
import { revenuesService } from '@/services/revenues-service';
import { useAuthStore } from '@/stores/auth-store';

type CategoryStat = { category: string; name: string; value: number };

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const user = useAuthStore((s) => s.user);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12)
      return {
        icon: GREETING_ICONS.morning,
        text: t('pages.dashboard.greetingMorning'),
      };
    if (hour < 18)
      return {
        icon: GREETING_ICONS.afternoon,
        text: t('pages.dashboard.greetingAfternoon'),
      };
    return { icon: GREETING_ICONS.evening, text: t('pages.dashboard.greetingEvening') };
  }, [t]);
  const displayName = user?.first_name || user?.username || '';

  // Filter state
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [selectedBill, setSelectedBill] = useState<string>('all');
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [evolutionPeriod, setEvolutionPeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('daily');
  const [forecastDays, setForecastDays] = useState<30 | 60 | 90>(30);
  const [irYear, setIrYear] = useState<number>(new Date().getFullYear() - 1);
  const [irReport, setIrReport] = useState<IRReport | null>(null);
  const [showIrReport, setShowIrReport] = useState(false);
  const { toast } = useToast();

  const now = new Date();

  // ── Queries ────────────────────────────────────────────────────────────────
  // staleTime mirrors backend Redis cache TTLs (see STALE_TIMES in query-client.ts).
  // refetchOnWindowFocus is enabled by default — replaces the manual
  // visibilitychange / focus event listeners that were here before.

  // Compute the earliest date required by the current evolution period so the
  // API returns only the records needed for the chart — not an arbitrary first
  // page of 50 items that silently truncates multi-year data.
  const queryStartDate = useMemo(() => {
    const today = new Date();
    switch (evolutionPeriod) {
      case 'daily':
        return format(subDays(today, 29), 'yyyy-MM-dd');
      case 'weekly':
        return format(subWeeks(today, 7), 'yyyy-MM-dd');
      case 'monthly':
        return format(subMonths(today, 5), 'yyyy-MM-dd');
      case 'yearly':
        return format(subYears(today, 4), 'yyyy-MM-dd');
    }
  }, [evolutionPeriod]);

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: STALE_TIMES.DASHBOARD_STATS,
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses', 'dashboard', queryStartDate],
    queryFn: () => expensesService.getAll({ date_from: queryStartDate }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const revenuesQuery = useQuery({
    queryKey: ['revenues', 'dashboard', queryStartDate],
    queryFn: () => revenuesService.getAll({ date_from: queryStartDate }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const accountBalancesQuery = useQuery({
    queryKey: ['dashboard', 'accountBalances'],
    queryFn: () => dashboardService.getAccountBalances(),
    staleTime: STALE_TIMES.ACCOUNT_BALANCES,
  });

  const creditCardsQuery = useQuery({
    queryKey: ['creditCards'],
    queryFn: () => creditCardsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const creditCardBillsQuery = useQuery({
    queryKey: ['creditCardBills'],
    queryFn: () => creditCardBillsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  // Card/bill filters are part of the query key so the cache entry is separate
  // per combination — no manual effect needed.
  const ccExpensesCategoryQuery = useQuery({
    queryKey: ['dashboard', 'ccExpensesByCategory', selectedCard, selectedBill],
    queryFn: () => {
      const params: { card?: number; bill?: number } = {};
      if (selectedCard !== 'all') params.card = parseInt(selectedCard);
      if (selectedBill !== 'all') params.bill = parseInt(selectedBill);
      return dashboardService.getCreditCardExpensesByCategory(params);
    },
    staleTime: STALE_TIMES.CATEGORY_BREAKDOWN,
  });

  const balanceForecastQuery = useQuery({
    queryKey: ['dashboard', 'balanceForecast'],
    queryFn: () => dashboardService.getBalanceForecast(),
    staleTime: STALE_TIMES.BALANCE_FORECAST,
  });

  const budgetStatusQuery = useQuery({
    queryKey: ['budgets', 'status', now.getMonth() + 1, now.getFullYear()],
    queryFn: () =>
      budgetsService.getStatus({ month: now.getMonth() + 1, year: now.getFullYear() }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  // forecastDays is in the key — changing it transparently fetches a new result
  // while the previous period's data stays cached (no loading flash when switching back).
  const cashFlowForecastQuery = useQuery({
    queryKey: ['dashboard', 'cashFlowForecast', forecastDays],
    queryFn: () => dashboardService.getCashFlowForecast(forecastDays),
    staleTime: STALE_TIMES.CASH_FLOW_FORECAST,
  });

  const financialAlertsQuery = useQuery({
    queryKey: ['dashboard', 'financialAlerts'],
    queryFn: () => dashboardService.getFinancialAlerts(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['dashboard', 'anomalies'],
    queryFn: () => dashboardService.getAnomalies(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const lgpdMutation = useMutation({
    mutationFn: () => dashboardService.requestLGPDExport(),
    onSuccess: () => {
      toast({
        title: t('pages.dashboard.lgpdExport.successTitle'),
        description: t('pages.dashboard.lgpdExport.successDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('pages.dashboard.lgpdExport.errorTitle'),
        description: t('pages.dashboard.lgpdExport.errorDesc'),
        variant: 'destructive',
      });
    },
  });

  const handleLoadIRReport = useCallback(async () => {
    try {
      const data = await dashboardService.getIRReport(irYear);
      setIrReport(data);
      setShowIrReport(true);
    } catch {
      toast({
        title: t('pages.dashboard.lgpdExport.errorTitle'),
        description: t('pages.dashboard.irReport.errorDesc'),
        variant: 'destructive',
      });
    }
  }, [irYear, toast, t]);

  // ── Derived data ───────────────────────────────────────────────────────────
  // Arrays are wrapped in useMemo so the `?? []` fallback doesn't create a new
  // reference every render during the loading phase (which would break the
  // downstream useMemo hooks that list these as dependencies).
  const stats = statsQuery.data ?? null;
  const expenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const revenues = useMemo(() => revenuesQuery.data ?? [], [revenuesQuery.data]);
  const accountBalances = useMemo(
    () => accountBalancesQuery.data ?? [],
    [accountBalancesQuery.data]
  );
  const creditCards = useMemo(
    () => creditCardsQuery.data ?? [],
    [creditCardsQuery.data]
  );
  const creditCardBills = useMemo(
    () => creditCardBillsQuery.data ?? [],
    [creditCardBillsQuery.data]
  );
  const creditCardExpensesByCategory = useMemo(
    () => ccExpensesCategoryQuery.data ?? [],
    [ccExpensesCategoryQuery.data]
  );
  const balanceForecast = balanceForecastQuery.data ?? null;
  const budgetStatus = useMemo(
    () => (Array.isArray(budgetStatusQuery.data) ? budgetStatusQuery.data : []),
    [budgetStatusQuery.data]
  );
  const cashFlowForecast = cashFlowForecastQuery.data ?? null;
  const financialAlerts = useMemo(
    () => (Array.isArray(financialAlertsQuery.data) ? financialAlertsQuery.data : []),
    [financialAlertsQuery.data]
  );

  const anomalies = useMemo(
    () => (Array.isArray(anomaliesQuery.data) ? anomaliesQuery.data : []),
    [anomaliesQuery.data]
  );

  // Overall loading: show full-screen spinner only until the primary stats
  // query resolves. Secondary queries (charts, forecast, alerts) load in the
  // background and each section handles its own loading state. This prevents
  // slow/hung secondary queries from blocking the entire page.
  const isLoading = statsQuery.isLoading;

  // isForecastLoading: true while a forecastDays-triggered refetch is in flight.
  const isForecastLoading = cashFlowForecastQuery.isFetching;
  // Errors are handled globally by the QueryCache in query-client.ts.

  // Filter bills by selected card
  const filteredBills = useMemo(() => {
    if (selectedCard === 'all') return creditCardBills;
    return creditCardBills.filter((b) => b.credit_card.toString() === selectedCard);
  }, [selectedCard, creditCardBills]);

  // Bill filter reset is handled inline in the card Select's onValueChange below
  // to avoid calling setSelectedBill synchronously inside a useEffect.

  // Format credit card expenses for chart
  const creditCardExpensesChartData = useMemo(() => {
    return creditCardExpensesByCategory
      .map((item) => ({
        category: item.category,
        name: translate('expenseCategories', item.category),
        value: item.total,
        count: item.count,
      }))
      .slice(0, 8); // Top 8 categories
  }, [creditCardExpensesByCategory]);

  const creditCardExpensesTotal = useMemo(() => {
    return creditCardExpensesByCategory.reduce((sum, item) => sum + item.total, 0);
  }, [creditCardExpensesByCategory]);

  // Memoize cálculos pesados para evitar re-renders desnecessários
  // Filtra apenas despesas pagas e receitas recebidas para os gráficos
  const expensesByCategory = useMemo(() => {
    return expenses
      .filter((exp) => exp.payed) // Apenas despesas pagas
      .reduce((acc: CategoryStat[], exp) => {
        const existing = acc.find((item) => item.category === exp.category);
        if (existing) {
          existing.value += parseFloat(exp.value);
        } else {
          acc.push({
            category: exp.category,
            name: translate('expenseCategories', exp.category),
            value: parseFloat(exp.value),
          });
        }
        return acc;
      }, [])
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [expenses]);

  const revenuesByCategory = useMemo(() => {
    return revenues
      .filter((rev) => rev.received && rev.category !== 'transfer') // Apenas receitas recebidas, excluindo transferências
      .reduce((acc: CategoryStat[], rev) => {
        const existing = acc.find((item) => item.category === rev.category);
        if (existing) {
          existing.value += parseFloat(rev.value);
        } else {
          acc.push({
            category: rev.category,
            name: translate('revenueCategories', rev.category),
            value: parseFloat(rev.value),
          });
        }
        return acc;
      }, [])
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [revenues]);

  const evolutionData = useMemo(() => {
    const now = new Date();

    // Função auxiliar para verificar se uma data (string "YYYY-MM-DD") está dentro de um intervalo
    // Usa comparação de strings para evitar problemas de timezone
    const isDateInRange = (dateStr: string, start: Date, end: Date): boolean => {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      return dateStr >= startStr && dateStr <= endStr;
    };

    // Função auxiliar para verificar se uma data está em um dia específico
    const isDateOnDay = (dateStr: string, day: Date): boolean => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return dateStr === dayStr;
    };

    if (evolutionPeriod === 'daily') {
      // Últimos 30 dias
      return eachDayOfInterval({ start: subDays(now, 29), end: now }).map((day) => {
        const dayExpenses = expenses
          .filter((e) => e.payed && isDateOnDay(e.date, day))
          .reduce((sum, e) => sum + parseFloat(e.value), 0);
        const dayRevenues = revenues
          .filter(
            (r) => r.received && r.category !== 'transfer' && isDateOnDay(r.date, day)
          )
          .reduce((sum, r) => sum + parseFloat(r.value), 0);
        return {
          month: format(day, 'dd/MM', { locale: dateFnsLocale }),
          despesas: dayExpenses,
          receitas: dayRevenues,
          saldo: dayRevenues - dayExpenses,
        };
      });
    } else if (evolutionPeriod === 'weekly') {
      // Últimas 8 semanas
      return eachWeekOfInterval(
        { start: subWeeks(now, 7), end: now },
        { weekStartsOn: 0 }
      ).map((week) => {
        const weekStart = startOfWeek(week, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(week, { weekStartsOn: 0 });
        const weekExpenses = expenses
          .filter((e) => e.payed && isDateInRange(e.date, weekStart, weekEnd))
          .reduce((sum, e) => sum + parseFloat(e.value), 0);
        const weekRevenues = revenues
          .filter(
            (r) =>
              r.received &&
              r.category !== 'transfer' &&
              isDateInRange(r.date, weekStart, weekEnd)
          )
          .reduce((sum, r) => sum + parseFloat(r.value), 0);
        return {
          month: format(weekStart, 'dd/MM', { locale: dateFnsLocale }),
          despesas: weekExpenses,
          receitas: weekRevenues,
          saldo: weekRevenues - weekExpenses,
        };
      });
    } else if (evolutionPeriod === 'yearly') {
      // Últimos 5 anos
      return eachYearOfInterval({ start: subYears(now, 4), end: now }).map((year) => {
        const yearStart = startOfYear(year);
        const yearEnd = endOfYear(year);
        const yearExpenses = expenses
          .filter((e) => e.payed && isDateInRange(e.date, yearStart, yearEnd))
          .reduce((sum, e) => sum + parseFloat(e.value), 0);
        const yearRevenues = revenues
          .filter(
            (r) =>
              r.received &&
              r.category !== 'transfer' &&
              isDateInRange(r.date, yearStart, yearEnd)
          )
          .reduce((sum, r) => sum + parseFloat(r.value), 0);
        return {
          month: format(year, 'yyyy', { locale: dateFnsLocale }),
          despesas: yearExpenses,
          receitas: yearRevenues,
          saldo: yearRevenues - yearExpenses,
        };
      });
    } else {
      // Mensal (padrão) - Últimos 6 meses
      return eachMonthOfInterval({ start: subMonths(now, 5), end: now }).map(
        (month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const monthExpenses = expenses
            .filter((e) => e.payed && isDateInRange(e.date, monthStart, monthEnd))
            .reduce((sum, e) => sum + parseFloat(e.value), 0);
          const monthRevenues = revenues
            .filter(
              (r) =>
                r.received &&
                r.category !== 'transfer' &&
                isDateInRange(r.date, monthStart, monthEnd)
            )
            .reduce((sum, r) => sum + parseFloat(r.value), 0);
          return {
            month: format(month, 'MMM/yy', { locale: dateFnsLocale }),
            despesas: monthExpenses,
            receitas: monthRevenues,
            saldo: monthRevenues - monthExpenses,
          };
        }
      );
    }
  }, [expenses, revenues, evolutionPeriod, dateFnsLocale]);

  const COLORS = useChartColors();

  const cashFlowChartData = useMemo(() => {
    if (!cashFlowForecast) return [];
    return cashFlowForecast.daily_breakdown.map((day) => ({
      date: day.date,
      despesas: day.expenses,
      receitas: day.revenues,
      saldo: day.balance,
    }));
  }, [cashFlowForecast]);

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <AnimatedPage>
      <div className="space-y-lg px-sm py-md md:px-md md:py-xl">
        {/* 1. PageHeader */}
        <PageHeader
          title={`${greeting.text}${displayName ? `, ${displayName}` : ''}`}
          icon={<LayoutDashboard />}
          subtitle={t('pages.dashboard.subtitle')}
          action={{
            label: t('pages.dashboard.exportStatement'),
            icon: <FileDown className="h-4 w-4" />,
            onClick: () => setStatementModalOpen(true),
          }}
        />

        {/* 2. StatementExportModal */}
        <StatementExportModal
          open={statementModalOpen}
          onOpenChange={setStatementModalOpen}
        />

        {/* 3. Ferramentas: LGPD + IR + Botão Alertas Financeiros */}
        <div className="flex flex-wrap gap-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => lgpdMutation.mutate()}
            disabled={lgpdMutation.isPending}
            className="gap-xs"
          >
            <Download className="h-4 w-4" />
            {t('pages.dashboard.lgpdExport.title')}
          </Button>
          <div className="flex items-center gap-xs">
            <Select
              value={String(irYear)}
              onValueChange={(v) => setIrYear(parseInt(v))}
            >
              <SelectTrigger
                className="h-9 w-28"
                aria-label={t('pages.dashboard.irReport.year')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                  (y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLoadIRReport()}
              className="gap-xs"
            >
              <FileText className="h-4 w-4" />
              {t('pages.dashboard.irReport.title')}
            </Button>
          </div>
          {financialAlerts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAlertsModalOpen(true)}
              className="gap-xs"
            >
              <AlertTriangle className="h-4 w-4" />
              {t('pages.dashboard.financialAlerts.title')}
              <Badge variant="destructive" className="ml-xs h-5 min-w-5 px-xs text-xs">
                {financialAlerts.length}
              </Badge>
            </Button>
          )}
        </div>

        {/* 4. Relatório IR (quando visível) */}
        {showIrReport && irReport && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <FileText className="h-5 w-5" />
                    <CardTitle as="h2">
                      {t('pages.dashboard.irReport.title')} {irReport.year}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowIrReport(false)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-md md:grid-cols-2">
                  <div>
                    <h3 className="mb-sm font-semibold">
                      {t('pages.dashboard.irReport.revenues')}
                    </h3>
                    {irReport.revenues.map((r) => (
                      <div key={r.category} className="flex justify-between text-sm">
                        <span>{translate('revenueCategories', r.category)}</span>
                        <span>{formatCurrency(r.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3 className="mb-sm font-semibold">
                      {t('pages.dashboard.irReport.deductible')}
                    </h3>
                    {irReport.deductible_expenses.map((d) => (
                      <div key={d.category} className="flex justify-between text-sm">
                        <span>{translate('expenseCategories', d.category)}</span>
                        <span>{formatCurrency(d.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 5. Faixa de Superávit / Déficit */}
        {stats && (
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-md py-sm text-sm font-medium',
              stats.total_revenues > stats.total_expenses
                ? 'bg-success/10 text-success'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            {stats.total_revenues > stats.total_expenses ? (
              <TrendingUp className="h-4 w-4 shrink-0" />
            ) : (
              <TrendingDown className="h-4 w-4 shrink-0" />
            )}
            <span>
              {stats.total_revenues > stats.total_expenses
                ? t('pages.dashboard.surplusThisMonth', {
                    amount: formatCurrency(stats.total_revenues - stats.total_expenses),
                  })
                : t('pages.dashboard.deficitThisMonth', {
                    amount: formatCurrency(stats.total_expenses - stats.total_revenues),
                  })}
            </span>
          </div>
        )}

        {/* 6. 4 StatCards */}
        <motion.div
          className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.totalBalance')}
              value={formatCurrency(stats?.total_balance || 0)}
              icon={<Wallet className="h-4 w-4" />}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.monthExpenses')}
              value={formatCurrency(stats?.total_expenses || 0)}
              icon={<TrendingDown className="h-4 w-4" />}
              variant="danger"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.monthRevenues')}
              value={formatCurrency(stats?.total_revenues || 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="success"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.creditLimit')}
              value={`${formatCurrency(stats?.available_credit_limit || 0)} / ${formatCurrency(stats?.total_credit_limit || 0)}`}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </motion.div>
        </motion.div>

        {/* 7. Score de Saúde Financeira */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <HealthScore />
        </motion.div>

        {/* 8. Anomalias de Gastos */}
        {anomalies.length > 0 && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-sm">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <CardTitle as="h2">{t('pages.dashboard.anomalies.title')}</CardTitle>
                </div>
                <p className="text-sm">{t('pages.dashboard.anomalies.subtitle')}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-sm">
                  {anomalies.map((anomaly) => (
                    <div
                      key={anomaly.category}
                      className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div>
                          <p className="font-medium">
                            {translate('expenseCategories', anomaly.category)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {anomaly.message}
                          </p>
                        </div>
                      </div>
                      <div className="ml-md flex flex-col items-end gap-xs">
                        <p className="font-semibold">
                          {formatCurrency(anomaly.current_amount)}
                        </p>
                        <div className="flex items-center gap-sm">
                          <span className="rounded bg-destructive/10 px-sm py-0.5 text-xs font-bold text-destructive">
                            +
                            {anomaly.average > 0
                              ? (
                                  ((anomaly.current_amount - anomaly.average) /
                                    anomaly.average) *
                                  100
                                ).toFixed(0)
                              : '0'}
                            %
                          </span>
                          <Badge variant="outline" className="text-xs">
                            z={anomaly.z_score.toFixed(1)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 9. Balanço de Contas | Previsão de Saldo (2 cols) */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          {/* Balanço de Contas */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-sm">
                  <Building2 className="h-5 w-5" />
                  <CardTitle as="h2">{t('pages.dashboard.accountBalance')}</CardTitle>
                </div>
                <p className="text-sm">{t('pages.dashboard.accountBalanceDesc')}</p>
              </CardHeader>
              <CardContent>
                {accountBalances.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('pages.dashboard.columns.account')}</TableHead>
                          <TableHead className="text-right">
                            {t('pages.dashboard.columns.currentBalance')}
                          </TableHead>
                          <TableHead className="text-right">
                            {t('pages.dashboard.columns.futureBalance')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountBalances.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-sm">
                                <div
                                  className={cn(
                                    'h-2 w-2 shrink-0 rounded-full',
                                    account.current_balance >= 0
                                      ? 'bg-success'
                                      : 'bg-destructive'
                                  )}
                                />
                                <div>
                                  <div>{account.account_name}</div>
                                  <div className="text-xs">
                                    {translate(
                                      'institutions',
                                      account.institution_name
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  'font-semibold',
                                  account.current_balance >= 0
                                    ? 'text-success'
                                    : 'text-destructive'
                                )}
                              >
                                {formatCurrency(account.current_balance)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div>
                                <span
                                  className={cn(
                                    'font-semibold',
                                    account.future_balance >= 0
                                      ? 'text-success'
                                      : 'text-destructive'
                                  )}
                                >
                                  {formatCurrency(account.future_balance)}
                                </span>
                                {(account.pending_revenues > 0 ||
                                  account.pending_expenses > 0 ||
                                  account.pending_transfers_in > 0 ||
                                  account.pending_transfers_out > 0) && (
                                  <div className="mt-xs flex flex-wrap gap-x-1 text-xs">
                                    {account.pending_revenues > 0 && (
                                      <span
                                        className="text-success"
                                        title={t('pages.dashboard.pendingRevenues')}
                                      >
                                        +{formatCurrency(account.pending_revenues)}
                                      </span>
                                    )}
                                    {account.pending_transfers_in > 0 && (
                                      <span
                                        className="text-success"
                                        title={t('pages.dashboard.pendingTransfersIn')}
                                      >
                                        ↓+{formatCurrency(account.pending_transfers_in)}
                                      </span>
                                    )}
                                    {account.pending_expenses > 0 && (
                                      <span
                                        className="text-destructive"
                                        title={t('pages.dashboard.pendingExpenses')}
                                      >
                                        -{formatCurrency(account.pending_expenses)}
                                      </span>
                                    )}
                                    {account.pending_transfers_out > 0 && (
                                      <span
                                        className="text-destructive"
                                        title={t('pages.dashboard.pendingTransfersOut')}
                                      >
                                        ↑-
                                        {formatCurrency(account.pending_transfers_out)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-xl text-center">
                    {t('pages.dashboard.noAccounts')}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Previsão de Saldo */}
          {balanceForecast && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-sm">
                    <Calculator className="h-5 w-5" />
                    <CardTitle as="h2">
                      {t('pages.dashboard.balanceForecast')}
                    </CardTitle>
                  </div>
                  <p className="text-sm">{t('pages.dashboard.balanceForecastDesc')}</p>
                </CardHeader>
                <CardContent>
                  <div className="mb-lg grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 p-md text-center">
                      <p className="mb-xs text-xs text-muted-foreground">
                        {t('pages.dashboard.currentBalance')}
                      </p>
                      <p
                        className={cn(
                          'text-xl font-bold',
                          balanceForecast.current_total_balance >= 0
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {formatCurrency(balanceForecast.current_total_balance)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-md text-center">
                      <p className="mb-xs text-xs text-muted-foreground">
                        {t('pages.dashboard.expectedChange')}
                      </p>
                      <p
                        className={cn(
                          'flex items-center justify-center gap-xs text-xl font-bold',
                          balanceForecast.summary.net_change >= 0
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {balanceForecast.summary.net_change >= 0 ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5" />
                        )}
                        {formatCurrency(Math.abs(balanceForecast.summary.net_change))}
                      </p>
                    </div>
                    <div className="col-span-1 rounded-lg bg-muted/50 p-md text-center md:col-span-2">
                      <p className="mb-xs text-xs text-muted-foreground">
                        {t('pages.dashboard.expectedBalance')}
                      </p>
                      <p
                        className={cn(
                          'text-2xl font-bold',
                          balanceForecast.forecast_balance >= 0
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {formatCurrency(balanceForecast.forecast_balance)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
                    {/* Entradas Previstas */}
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-sm text-sm font-semibold text-success">
                        <ArrowUpRight className="h-4 w-4" />
                        {t('pages.dashboard.inflows')}
                      </h3>
                      <div className="space-y-sm">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.pendingRevenues')}
                          </span>
                          <span className="font-medium text-success">
                            +{formatCurrency(balanceForecast.pending_revenues)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.loansReceivable')}
                          </span>
                          <span className="font-medium text-success">
                            +{formatCurrency(balanceForecast.loans_to_receive)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-sm text-sm">
                          <span className="font-semibold">
                            {t('pages.dashboard.totalInflows')}
                          </span>
                          <span className="font-bold text-success">
                            +{formatCurrency(balanceForecast.summary.total_income)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Saídas Previstas */}
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-sm text-sm font-semibold text-destructive">
                        <ArrowDownRight className="h-4 w-4" />
                        {t('pages.dashboard.outflows')}
                      </h3>
                      <div className="space-y-sm">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.pendingExpenses')}
                          </span>
                          <span className="font-medium text-destructive">
                            -{formatCurrency(balanceForecast.pending_expenses)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.creditCardBills')}
                          </span>
                          <span className="font-medium text-destructive">
                            -{formatCurrency(balanceForecast.pending_card_bills)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.loansToPay')}
                          </span>
                          <span className="font-medium text-destructive">
                            -{formatCurrency(balanceForecast.loans_to_pay)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.valuesToPay')}
                          </span>
                          <span className="font-medium text-destructive">
                            -{formatCurrency(balanceForecast.pending_payables)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-sm text-sm">
                          <span className="font-semibold">
                            {t('pages.dashboard.totalOutflows')}
                          </span>
                          <span className="font-bold text-destructive">
                            -{formatCurrency(balanceForecast.summary.total_outcome)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* 9. Projeção de Fluxo de Caixa | Evolução Diária (2 cols) */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          {/* Projeção de Fluxo de Caixa */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className="h-full">
              <CardHeader>
                <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-sm">
                    <Calculator className="h-5 w-5" />
                    <CardTitle as="h2">
                      {t('pages.dashboard.cashFlowProjection')}
                    </CardTitle>
                  </div>
                  <Select
                    value={String(forecastDays)}
                    onValueChange={(v) => setForecastDays(Number(v) as 30 | 60 | 90)}
                  >
                    <SelectTrigger
                      className="w-[140px]"
                      aria-label={t('pages.dashboard.selectForecastPeriod')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">
                        {t('pages.dashboard.period30')}
                      </SelectItem>
                      <SelectItem value="60">
                        {t('pages.dashboard.period60')}
                      </SelectItem>
                      <SelectItem value="90">
                        {t('pages.dashboard.period90')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {cashFlowForecast && (
                  <div className="flex flex-wrap gap-md pt-xs text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {t('pages.dashboard.startBalance')}:{' '}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(cashFlowForecast.start_balance)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t('pages.dashboard.endBalance')}:{' '}
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          cashFlowForecast.net_change >= 0
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {formatCurrency(cashFlowForecast.end_balance)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t('pages.dashboard.variation')}:{' '}
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          cashFlowForecast.net_change >= 0
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {cashFlowForecast.net_change >= 0 ? '+' : ''}
                        {formatCurrency(cashFlowForecast.net_change)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t('pages.dashboard.minBalance')}:{' '}
                      </span>
                      <span className="font-semibold text-destructive">
                        {formatCurrency(cashFlowForecast.min_balance)}
                      </span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isForecastLoading ? (
                  <LoadingState />
                ) : (
                  <ChartContainer
                    chartId="cash-flow-forecast"
                    data={cashFlowChartData}
                    dataKey="saldo"
                    nameKey="date"
                    formatter={formatCurrency}
                    colors={COLORS}
                    lockChartType="line"
                    lines={[
                      {
                        dataKey: 'despesas',
                        stroke: COLORS[5],
                        name: t('pages.dashboard.expenses'),
                      },
                      {
                        dataKey: 'receitas',
                        stroke: COLORS[3],
                        name: t('pages.dashboard.revenues'),
                      },
                      {
                        dataKey: 'saldo',
                        stroke: COLORS[0],
                        name: t('pages.dashboard.balance'),
                      },
                    ]}
                    xAxisTickFormatter={(d) =>
                      format(parseISO(d), 'dd/MM', { locale: dateFnsLocale })
                    }
                    tooltipLabelFormatter={(d) =>
                      format(parseISO(String(d)), "dd 'de' MMMM", {
                        locale: dateFnsLocale,
                      })
                    }
                    emptyMessage={t('pages.dashboard.noProjection')}
                    height={350}
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Evolução Diária/Semanal/Mensal/Anual */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className="h-full">
              <CardHeader>
                <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
                  <CardTitle as="h2">
                    {evolutionPeriod === 'daily'
                      ? t('pages.dashboard.evolutionDaily')
                      : evolutionPeriod === 'weekly'
                        ? t('pages.dashboard.evolutionWeekly')
                        : evolutionPeriod === 'yearly'
                          ? t('pages.dashboard.evolutionYearly')
                          : t('pages.dashboard.evolutionMonthly')}
                  </CardTitle>
                  <Select
                    value={evolutionPeriod}
                    onValueChange={(v) =>
                      setEvolutionPeriod(v as 'daily' | 'weekly' | 'monthly' | 'yearly')
                    }
                  >
                    <SelectTrigger
                      className="w-[160px]"
                      aria-label={t('pages.dashboard.selectEvolutionPeriod')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">
                        {t('pages.dashboard.daily')}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {t('pages.dashboard.weekly')}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {t('pages.dashboard.monthly')}
                      </SelectItem>
                      <SelectItem value="yearly">
                        {t('pages.dashboard.annual')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="financial-monthly-evolution"
                  data={evolutionData}
                  dataKey="saldo"
                  nameKey="month"
                  formatter={formatCurrency}
                  colors={COLORS}
                  emptyMessage={t('pages.dashboard.noData')}
                  lockChartType="line"
                  lines={[
                    {
                      dataKey: 'despesas',
                      stroke: COLORS[5],
                      name: t('pages.dashboard.expenses'),
                    },
                    {
                      dataKey: 'receitas',
                      stroke: COLORS[3],
                      name: t('pages.dashboard.revenues'),
                    },
                    {
                      dataKey: 'saldo',
                      stroke: COLORS[0],
                      name: t('pages.dashboard.balance'),
                    },
                  ]}
                  height={400}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* 10. Separador: Composição do mês */}
        <div className="flex items-center gap-3 py-sm">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Composição do mês
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* 11. Despesas por Cat | Receitas por Cat | Cartão por Cat | Orçamentos (4 cols) */}
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
          {/* Despesas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">{t('pages.dashboard.expensesByCategory')}</CardTitle>
              <p className="text-sm">{t('pages.dashboard.expensesByCategoryDesc')}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="financial-expenses-category"
                data={expensesByCategory}
                dataKey="value"
                nameKey="name"
                formatter={formatCurrency}
                colors={COLORS}
                emptyMessage={t('pages.dashboard.noExpenses')}
                lockChartType="pie"
                height={280}
              />
            </CardContent>
          </Card>

          {/* Receitas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">{t('pages.dashboard.revenuesByCategory')}</CardTitle>
              <p className="text-sm">{t('pages.dashboard.revenuesByCategoryDesc')}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="financial-revenues-category"
                data={revenuesByCategory}
                dataKey="value"
                nameKey="name"
                formatter={formatCurrency}
                colors={COLORS}
                emptyMessage={t('pages.dashboard.noRevenues')}
                lockChartType="pie"
                height={280}
              />
            </CardContent>
          </Card>

          {/* Despesas de Cartão por Categoria */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="flex items-center gap-sm">
                <CreditCard className="h-4 w-4" />
                {t('pages.dashboard.cardExpensesByCategory')}
              </CardTitle>
              <p className="text-sm">
                {t('pages.dashboard.cardExpensesByCategoryDesc')}
              </p>
              <div className="flex flex-wrap gap-sm pt-sm">
                <Select
                  value={selectedCard}
                  onValueChange={(v) => {
                    setSelectedCard(v);
                    setSelectedBill('all');
                  }}
                >
                  <SelectTrigger
                    className="h-8 flex-1 text-xs"
                    aria-label={t('pages.dashboard.selectCard')}
                  >
                    <SelectValue placeholder={t('pages.dashboard.allCards')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.dashboard.allCards')}</SelectItem>
                    {creditCards.map((card) => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedBill}
                  onValueChange={setSelectedBill}
                  disabled={filteredBills.length === 0}
                >
                  <SelectTrigger
                    className="h-8 flex-1 text-xs"
                    aria-label={t('pages.dashboard.selectBill')}
                  >
                    <SelectValue
                      placeholder={
                        filteredBills.length === 0
                          ? t('pages.dashboard.noBills')
                          : t('pages.dashboard.allBills')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.dashboard.allBills')}</SelectItem>
                    {filteredBills.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id.toString()}>
                        {
                          TRANSLATIONS.months[
                            bill.month as keyof typeof TRANSLATIONS.months
                          ]
                        }
                        /{bill.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="credit-card-expenses-category"
                data={creditCardExpensesChartData}
                dataKey="value"
                nameKey="name"
                formatter={formatCurrency}
                colors={COLORS}
                emptyMessage={t('pages.dashboard.noCardExpenses')}
                lockChartType="pie"
                height={280}
              />
              {creditCardExpensesChartData.length > 0 && (
                <div className="mt-3 space-y-sm">
                  <div className="flex items-center justify-between border-b pb-xs text-sm">
                    <span className="font-semibold">{t('pages.dashboard.total')}</span>
                    <span className="font-bold text-destructive">
                      {formatCurrency(creditCardExpensesTotal)}
                    </span>
                  </div>
                  {creditCardExpensesChartData.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-sm">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{category.name}</span>
                        <span className="text-muted-foreground">
                          ({category.count})
                        </span>
                      </div>
                      <span className="font-semibold text-destructive">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orçamentos do mês */}
          {budgetStatus.length > 0 ? (
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-sm">
                    <PiggyBank className="h-4 w-4" />
                    <CardTitle as="h2">{t('pages.dashboard.monthBudgets')}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('pages.dashboard.monthBudgetsDesc')}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-md">
                    {budgetStatus.map((item) => {
                      const pct = Math.min(item.percentage, 100);
                      const barColor =
                        item.status === 'exceeded'
                          ? 'bg-destructive'
                          : item.status === 'warning'
                            ? 'bg-yellow-500'
                            : 'bg-success';
                      return (
                        <div key={item.id} className="space-y-xs">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {translate('expenseCategories', item.category)}
                            </span>
                            <div className="flex items-center gap-sm">
                              <span className="text-muted-foreground">
                                {formatCurrency(item.actual_spent)} /{' '}
                                {formatCurrency(item.limit_amount)}
                              </span>
                              <span
                                className={cn(
                                  'rounded px-sm py-0.5 text-xs font-semibold',
                                  item.status === 'exceeded'
                                    ? 'bg-destructive/10 text-destructive'
                                    : item.status === 'warning'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      : 'bg-success/10 text-success'
                                )}
                              >
                                {item.percentage.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                barColor
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-sm">
                  <PiggyBank className="h-4 w-4" />
                  <CardTitle as="h2">{t('pages.dashboard.monthBudgets')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="py-xl text-center text-sm text-muted-foreground">
                  {t('pages.dashboard.monthBudgetsDesc')}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Alertas Financeiros */}
      <Dialog open={alertsModalOpen} onOpenChange={setAlertsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('pages.dashboard.financialAlerts.title')}</DialogTitle>
          </DialogHeader>
          <AlertsPanel alerts={financialAlerts} />
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
