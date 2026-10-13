/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
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
  Activity,
  Wallet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  LayoutDashboard,
  Calculator,
  CalendarDays,
  PiggyBank,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StatCard } from '@/components/common/StatCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { HealthScore } from '@/components/dashboard/HealthScore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import {
  Dialog,
  DialogCloseFooter,
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
import { translate } from '@/config/constants';
import { GREETING_ICONS } from '@/config/icons';
import { useDismissedAlerts } from '@/hooks/use-dismissed-alerts';
import { useToast } from '@/hooks/use-toast';
import { itemVariants } from '@/lib/animations';
import { useChartColors } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services/dashboard-service';
import { expensesService } from '@/services/expenses-service';
import { notificationsService } from '@/services/notifications-service';
import { revenuesService } from '@/services/revenues-service';
import { useAuthStore } from '@/stores/auth-store';

type CategoryStat = { category: string; name: string; value: number };

// Botões da linha de ferramentas: mesmo tamanho e largura
const TOOL_BUTTON_CLASS = 'gap-xs w-44';

// Card "Orçamentos do mês": no máximo 5 barras por página
const BUDGET_PAGE_SIZE = 5;

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [evolutionPeriod, setEvolutionPeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('daily');
  const [forecastDays, setForecastDays] = useState<30 | 60 | 90>(30);
  const { toast } = useToast();

  // Toggles da tela — só um pode estar expandido por vez
  const [openSection, setOpenSection] = useState<
    'health' | 'monthly' | 'advanced' | null
  >('health');
  const toggleSection = (section: 'health' | 'monthly' | 'advanced') =>
    setOpenSection((current) => (current === section ? null : section));

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

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardService.getSummary(),
    staleTime: STALE_TIMES.ACCOUNT_BALANCES,
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

  // Lazy-load refs: anomalias e projeção de fluxo só disparam quando visíveis.
  // Usamos callback refs (em vez de useRef) porque a página renderiza um
  // fullscreen loading state até summaryQuery resolver — se o observer fosse
  // montado num useEffect([]) tradicional, ele rodaria contra current === null
  // (o card ainda não existe no DOM) e nunca mais seria reexecutado.
  const [anomaliesSectionEl, setAnomaliesSectionEl] = useState<HTMLDivElement | null>(
    null
  );
  const [cashFlowSectionEl, setCashFlowSectionEl] = useState<HTMLDivElement | null>(
    null
  );
  const [anomaliesInView, setAnomaliesInView] = useState(false);
  const [cashFlowInView, setCashFlowInView] = useState(false);

  useEffect(() => {
    if (!anomaliesSectionEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnomaliesInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(anomaliesSectionEl);
    return () => observer.disconnect();
  }, [anomaliesSectionEl]);

  useEffect(() => {
    if (!cashFlowSectionEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCashFlowInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(cashFlowSectionEl);
    return () => observer.disconnect();
  }, [cashFlowSectionEl]);

  // forecastDays is in the key — changing it transparently fetches a new result
  // while the previous period's data stays cached (no loading flash when switching back).
  const cashFlowForecastQuery = useQuery({
    queryKey: ['dashboard', 'cashFlowForecast', forecastDays],
    queryFn: () => dashboardService.getCashFlowForecast(forecastDays),
    staleTime: STALE_TIMES.CASH_FLOW_FORECAST,
    refetchOnWindowFocus: false,
    enabled: cashFlowInView,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['dashboard', 'anomalies'],
    queryFn: () => dashboardService.getAnomalies(),
    staleTime: STALE_TIMES.CATEGORY_BREAKDOWN,
    refetchOnWindowFocus: false,
    enabled: anomaliesInView,
  });

  const weeklyInsightQuery = useQuery({
    queryKey: ['dashboard', 'weeklyInsight'],
    queryFn: async () => {
      const all = await notificationsService.getAll();
      const insights = all.filter((n) => n.notification_type === 'agent_insight');
      return insights.length > 0 ? insights[0] : null;
    },
    staleTime: STALE_TIMES.DASHBOARD_STATS,
    refetchOnWindowFocus: false,
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  // Arrays are wrapped in useMemo so the `?? []` fallback doesn't create a new
  // reference every render during the loading phase (which would break the
  // downstream useMemo hooks that list these as dependencies).
  const stats = summaryQuery.data?.stats ?? null;
  const expenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const revenues = useMemo(() => revenuesQuery.data ?? [], [revenuesQuery.data]);
  const budgetStatus = useMemo(
    () =>
      Array.isArray(summaryQuery.data?.budget_status)
        ? summaryQuery.data.budget_status
        : [],
    [summaryQuery.data]
  );
  const cashFlowForecast = cashFlowForecastQuery.data ?? null;
  const allFinancialAlerts = useMemo(
    () =>
      Array.isArray(summaryQuery.data?.financial_alerts)
        ? summaryQuery.data.financial_alerts
        : [],
    [summaryQuery.data]
  );
  const { visibleAlerts: financialAlerts, dismiss: dismissAlert } = useDismissedAlerts(
    allFinancialAlerts,
    user?.id
  );

  const anomalies = useMemo(
    () => (Array.isArray(anomaliesQuery.data) ? anomaliesQuery.data : []),
    [anomaliesQuery.data]
  );

  // Show a proactive toast when critical alerts load for the first time
  const alertsNotifiedRef = useRef(false);
  useEffect(() => {
    if (alertsNotifiedRef.current) return;
    const critical = financialAlerts.filter(
      (a) => a.severity === 'danger' || a.severity === 'warning'
    );
    if (critical.length > 0) {
      alertsNotifiedRef.current = true;
      toast({
        title: t('pages.dashboard.financialAlerts.proactiveTitle', {
          count: critical.length,
        }),
        variant: 'destructive',
      });
    }
  }, [financialAlerts, t, toast]);

  // Overall loading: show full-screen spinner only until the primary stats
  // query resolves. Secondary queries (charts, forecast, alerts) load in the
  // background and each section handles its own loading state. This prevents
  // slow/hung secondary queries from blocking the entire page.
  const isLoading = summaryQuery.isLoading;

  // isForecastLoading: true while a forecastDays-triggered refetch is in flight.
  const isForecastLoading = cashFlowForecastQuery.isFetching;
  // Errors are handled globally by the QueryCache in query-client.ts.

  // Memoize cálculos pesados para evitar re-renders desnecessários
  // Filtra apenas despesas pagas e receitas recebidas para os gráficos
  const expensesByCategory = useMemo(() => {
    return expenses
      .filter((exp) => exp.payed && !exp.related_transfer)
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
          .filter((e) => e.payed && !e.related_transfer && isDateOnDay(e.date, day))
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
          .filter(
            (e) =>
              e.payed &&
              !e.related_transfer &&
              isDateInRange(e.date, weekStart, weekEnd)
          )
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
          .filter(
            (e) =>
              e.payed &&
              !e.related_transfer &&
              isDateInRange(e.date, yearStart, yearEnd)
          )
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
            .filter(
              (e) =>
                e.payed &&
                !e.related_transfer &&
                isDateInRange(e.date, monthStart, monthEnd)
            )
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
    <PageContainer>
      {/* 1. PageHeader */}
      <PageHeader
        title={`${greeting.text}${displayName ? `, ${displayName}` : ''}`}
        icon={<LayoutDashboard />}
      />

      {/* 2. Alertas (alinhadas à direita) */}
      <div className="gap-sm flex flex-wrap items-center justify-end">
        <div className="flex-1" />
        {financialAlerts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAlertsModalOpen(true)}
            className={TOOL_BUTTON_CLASS}
          >
            <AlertTriangle className="h-4 w-4" />
            {t('pages.dashboard.financialAlerts.title')}
            <Badge variant="destructive" className="ml-xs px-xs h-5 min-w-5 text-xs">
              {financialAlerts.length}
            </Badge>
          </Button>
        )}
      </div>

      {/* 3. Saúde Financeira (toggle, aberto por padrão) com os cards de resumo à direita */}
      <CollapsibleSection
        title={t('pages.dashboard.healthScore.title')}
        icon={<Activity className="h-4 w-4" />}
        open={openSection === 'health'}
        onToggle={() => toggleSection('health')}
      >
        <div className="gap-md flex flex-col lg:flex-row">
          <div className="shrink-0 lg:w-[36rem]">
            <HealthScore />
          </div>
          <div className="gap-md flex flex-1 flex-col lg:self-center">
            <StatCard
              title={t('pages.dashboard.totalBalance')}
              value={formatCurrency(stats?.total_balance || 0)}
              icon={<Wallet className="h-4 w-4" />}
              compact
              centered
              accentColor={(stats?.total_balance || 0) >= 0 ? 'green' : 'red'}
            />
            <StatCard
              title={t('pages.dashboard.monthRevenues')}
              value={formatCurrency(stats?.total_revenues || 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              compact
              centered
              accentColor="green"
              onClick={() => navigate('/transactions')}
            />
            <StatCard
              title={t('pages.dashboard.monthExpenses')}
              value={formatCurrency(stats?.total_expenses || 0)}
              icon={<TrendingDown className="h-4 w-4" />}
              compact
              centered
              accentColor="red"
              onClick={() => navigate('/transactions')}
            />
            <StatCard
              title={t('pages.dashboard.creditLimit')}
              value={`${formatCurrency(stats?.available_credit_limit || 0)} / ${formatCurrency(stats?.total_credit_limit || 0)}`}
              icon={<CreditCard className="h-4 w-4" />}
              compact
              centered
              accentColor="blue"
              onClick={() => navigate('/credit-cards')}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 8. Insight Semanal do Assistente */}
      {weeklyInsightQuery.data && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-sm">
              <div className="gap-sm flex items-center justify-between">
                <div className="gap-sm flex items-center">
                  <div className="bg-primary/10 p-sm rounded-lg">
                    <Sparkles className="text-primary h-4 w-4" />
                  </div>
                  <CardTitle as="h2" className="text-base">
                    {t('pages.dashboard.weeklyInsight.title')}
                  </CardTitle>
                  {!weeklyInsightQuery.data.is_read && (
                    <span className="bg-primary h-2 w-2 rounded-full" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/agents')}
                  className="gap-xs text-primary hover:text-primary text-xs"
                >
                  {t('pages.dashboard.weeklyInsight.openAssistant')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {weeklyInsightQuery.data.message}
              </p>
              <p className="mt-sm text-muted-foreground text-xs">
                {new Date(weeklyInsightQuery.data.created_at).toLocaleDateString(
                  undefined,
                  { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <CollapsibleSection
        title={t('pages.dashboard.sectionAdvancedAnalysis')}
        icon={<Sparkles className="h-4 w-4" />}
        open={openSection === 'advanced'}
        onToggle={() => toggleSection('advanced')}
      >
        <div className="space-y-lg">
          {/* 8. Anomalias de Gastos */}
          <div ref={setAnomaliesSectionEl} />
          {anomalies.length > 0 && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <div className="gap-sm flex items-center">
                    <AlertTriangle className="text-warning h-5 w-5" />
                    <CardTitle as="h2">
                      {t('pages.dashboard.anomalies.title')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-sm">
                    {anomalies.map((anomaly) => (
                      <div
                        key={anomaly.category}
                        className="border-warning/30 bg-warning/5 flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-start gap-3">
                          <TrendingUp className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-medium">
                              {translate('expenseCategories', anomaly.category)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {anomaly.message}
                            </p>
                          </div>
                        </div>
                        <div className="ml-md gap-xs flex flex-col items-end">
                          <p className="font-semibold">
                            {formatCurrency(anomaly.current_amount)}
                          </p>
                          <span className="bg-destructive/10 px-sm text-destructive rounded py-0.5 text-xs font-bold">
                            +
                            {anomaly.average > 0
                              ? (
                                  ((anomaly.current_amount - anomaly.average) /
                                    anomaly.average) *
                                  100
                                ).toFixed(0)
                              : '0'}
                            % {t('pages.dashboard.anomalies.aboveAverage')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 9. Projeção de Fluxo de Caixa | Evolução Diária (2 cols) */}
          <div
            ref={setCashFlowSectionEl}
            className="gap-lg grid grid-cols-1 lg:grid-cols-2"
          >
            {/* Projeção de Fluxo de Caixa */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card className="h-full">
                <CardHeader>
                  <div className="gap-md flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="gap-sm flex items-center">
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
                    <div className="gap-md pt-xs flex flex-wrap text-sm">
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
                        <span className="text-destructive font-semibold">
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
                      valueAxisFormatter={formatCurrency}
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
                      height={280}
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Evolução Diária/Semanal/Mensal/Anual */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card className="h-full">
                <CardHeader>
                  <div className="gap-md flex flex-col md:flex-row md:items-center md:justify-between">
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
                        setEvolutionPeriod(
                          v as 'daily' | 'weekly' | 'monthly' | 'yearly'
                        )
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
                    valueAxisFormatter={formatCurrency}
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
                    height={320}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('pages.dashboard.sectionMonthlyAnalysis')}
        icon={<CalendarDays className="h-4 w-4" />}
        open={openSection === 'monthly'}
        onToggle={() => toggleSection('monthly')}
      >
        <div className="space-y-lg">
          {/* 11. Despesas por Cat | Receitas por Cat | Orçamentos (3 cols) */}
          <div className="gap-md grid grid-cols-1 lg:grid-cols-3">
            {/* Despesas por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t('pages.dashboard.expensesByCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="financial-expenses-category"
                  data={expensesByCategory}
                  dataKey="value"
                  nameKey="name"
                  formatter={formatCurrency}
                  valueAxisFormatter={formatCurrency}
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
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="financial-revenues-category"
                  data={revenuesByCategory}
                  dataKey="value"
                  nameKey="name"
                  formatter={formatCurrency}
                  valueAxisFormatter={formatCurrency}
                  colors={COLORS}
                  emptyMessage={t('pages.dashboard.noRevenues')}
                  lockChartType="pie"
                  height={280}
                />
              </CardContent>
            </Card>

            {/* Orçamentos do mês */}
            {budgetStatus.length > 0 ? (
              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-3">
                    <div className="gap-sm flex items-center">
                      <PiggyBank className="h-4 w-4" />
                      <CardTitle as="h2">{t('pages.dashboard.monthBudgets')}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-center">
                    <PaginatedSlide
                      items={budgetStatus}
                      pageSize={BUDGET_PAGE_SIZE}
                      pinNav={false}
                      className="space-y-md"
                    >
                      {(pageItems) =>
                        pageItems.map((item) => {
                          const pct = Math.min(item.percentage, 100);
                          const barColor =
                            item.status === 'exceeded'
                              ? 'bg-destructive'
                              : item.status === 'warning'
                                ? 'bg-warning'
                                : 'bg-success';
                          return (
                            <div key={item.id} className="space-y-xs">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">
                                  {translate('expenseCategories', item.category)}
                                </span>
                                <div className="gap-sm flex items-center">
                                  <span className="text-muted-foreground">
                                    {formatCurrency(item.actual_spent)} /{' '}
                                    {formatCurrency(item.limit_amount)}
                                  </span>
                                  <span
                                    className={cn(
                                      'px-sm rounded py-0.5 text-xs font-semibold',
                                      item.status === 'exceeded'
                                        ? 'bg-destructive/10 text-destructive'
                                        : item.status === 'warning'
                                          ? 'bg-warning/10 text-warning'
                                          : 'bg-success/10 text-success'
                                    )}
                                  >
                                    {item.percentage.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition',
                                    barColor
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      }
                    </PaginatedSlide>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="gap-sm flex items-center">
                    <PiggyBank className="h-4 w-4" />
                    <CardTitle as="h2">{t('pages.dashboard.monthBudgets')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="py-xl text-muted-foreground text-center text-sm">
                    {t('pages.dashboard.monthBudgetsDesc')}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Modal de Alertas Financeiros */}
      <Dialog open={alertsModalOpen} onOpenChange={setAlertsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle icon={AlertTriangle}>
              {t('pages.dashboard.financialAlerts.title')}
            </DialogTitle>
          </DialogHeader>
          <AlertsPanel alerts={financialAlerts} onDismiss={dismissAlert} />
          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
