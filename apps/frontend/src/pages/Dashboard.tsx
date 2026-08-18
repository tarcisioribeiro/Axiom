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
import { AnimatePresence, motion } from 'framer-motion';
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
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatementExportModal } from '@/components/common/StatementExportModal';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { HealthScore } from '@/components/dashboard/HealthScore';
import { InstallmentSimulator } from '@/components/financial/InstallmentSimulator';
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
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { dashboardService, type IRReport } from '@/services/dashboard-service';
import { expensesService } from '@/services/expenses-service';
import { notificationsService } from '@/services/notifications-service';
import { revenuesService } from '@/services/revenues-service';
import { useAuthStore } from '@/stores/auth-store';

type CategoryStat = { category: string; name: string; value: number };

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
  const [installmentSimOpen, setInstallmentSimOpen] = useState(false);
  const { toast } = useToast();

  // Collapsible section state — persisted to localStorage
  const [monthlyAnalysisOpen, setMonthlyAnalysisOpen] = useState(
    () => localStorage.getItem('dashboard-monthly-analysis') !== 'false'
  );
  const [advancedAnalysisOpen, setAdvancedAnalysisOpen] = useState(
    () => localStorage.getItem('dashboard-advanced-analysis') === 'true'
  );

  useEffect(() => {
    localStorage.setItem(
      'dashboard-monthly-analysis',
      monthlyAnalysisOpen ? 'true' : 'false'
    );
  }, [monthlyAnalysisOpen]);

  useEffect(() => {
    localStorage.setItem(
      'dashboard-advanced-analysis',
      advancedAnalysisOpen ? 'true' : 'false'
    );
  }, [advancedAnalysisOpen]);

  const now = useMemo(() => new Date(), []);

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
  const stats = summaryQuery.data?.stats ?? null;
  const expenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const revenues = useMemo(() => revenuesQuery.data ?? [], [revenuesQuery.data]);
  const accountBalances = useMemo(
    () => summaryQuery.data?.account_balances ?? [],
    [summaryQuery.data]
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
    () =>
      Array.isArray(summaryQuery.data?.budget_status)
        ? summaryQuery.data.budget_status
        : [],
    [summaryQuery.data]
  );
  const cashFlowForecast = cashFlowForecastQuery.data ?? null;
  const financialAlerts = useMemo(
    () =>
      Array.isArray(summaryQuery.data?.financial_alerts)
        ? summaryQuery.data.financial_alerts
        : [],
    [summaryQuery.data]
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
        description: t('pages.dashboard.financialAlerts.proactiveDesc'),
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

  const monthOverMonth = useMemo(() => {
    const currentMonthStr = format(now, 'yyyy-MM');
    const prevMonthStr = format(subMonths(now, 1), 'yyyy-MM');

    const sum = <T extends { date: string; value: string }>(
      arr: T[],
      monthStr: string,
      filterFn: (e: T) => boolean
    ) =>
      arr
        .filter((e) => e.date.startsWith(monthStr) && filterFn(e))
        .reduce((s, e) => s + parseFloat(e.value), 0);

    const currExp = sum(
      expenses,
      currentMonthStr,
      (e) => e.payed && !e.related_transfer && !e.is_transfer_generated
    );
    const prevExp = sum(
      expenses,
      prevMonthStr,
      (e) => e.payed && !e.related_transfer && !e.is_transfer_generated
    );
    const currRev = sum(
      revenues,
      currentMonthStr,
      (r) =>
        (r as { received?: boolean }).received === true &&
        !r.related_transfer &&
        !r.is_transfer_generated
    );
    const prevRev = sum(
      revenues,
      prevMonthStr,
      (r) =>
        (r as { received?: boolean }).received === true &&
        !r.related_transfer &&
        !r.is_transfer_generated
    );

    const delta = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

    return {
      expenses: { current: currExp, prev: prevExp, delta: delta(currExp, prevExp) },
      revenues: { current: currRev, prev: prevRev, delta: delta(currRev, prevRev) },
      balance: {
        current: currRev - currExp,
        prev: prevRev - prevExp,
        delta: delta(currRev - currExp, prevRev - prevExp),
      },
    };
  }, [expenses, revenues, now]);

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
      <div className="gap-sm flex flex-wrap">
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
        <div className="gap-xs flex items-center">
          <Select value={String(irYear)} onValueChange={(v) => setIrYear(parseInt(v))}>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInstallmentSimOpen(true)}
          className="gap-xs"
        >
          <Calculator className="h-4 w-4" />
          {t('pages.dashboard.installmentSimulator')}
        </Button>
        {financialAlerts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAlertsModalOpen(true)}
            className="gap-xs"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('pages.dashboard.financialAlerts.title')}
            <Badge variant="destructive" className="ml-xs px-xs h-5 min-w-5 text-xs">
              {financialAlerts.length}
            </Badge>
          </Button>
        )}
        <InstallmentSimulator
          open={installmentSimOpen}
          onOpenChange={setInstallmentSimOpen}
        />
      </div>

      {/* 4. Relatório IR (quando visível) */}
      {showIrReport && irReport && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="gap-sm flex items-center">
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
              <div className="gap-md grid md:grid-cols-2">
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
            'px-md py-sm flex items-center gap-3 rounded-lg text-sm font-medium',
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

      {/* 6. StatCards — saldo total em destaque, demais em 3 cols */}
      <motion.div
        className="space-y-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Saldo total — informação primária em destaque */}
        <motion.div variants={itemVariants}>
          <StatCard
            title={t('pages.dashboard.totalBalance')}
            value={formatCurrency(stats?.total_balance || 0)}
            icon={<Wallet className="h-5 w-5" />}
            accentColor={(stats?.total_balance || 0) >= 0 ? 'green' : 'red'}
            prominent
            description={t('pages.dashboard.accountBalanceDesc')}
          />
        </motion.div>

        {/* Separador visual entre primário e secundários */}
        <div className="flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('pages.dashboard.monthCompositionShort')}
          </span>
          <div className="bg-border h-px flex-1" />
        </div>

        {/* Receitas, Despesas e Cartão — informações secundárias */}
        <div className="gap-md grid grid-cols-1 md:grid-cols-3">
          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.monthRevenues')}
              value={formatCurrency(stats?.total_revenues || 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              accentColor="green"
              onClick={() => navigate('/transactions')}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.monthExpenses')}
              value={formatCurrency(stats?.total_expenses || 0)}
              icon={<TrendingDown className="h-4 w-4" />}
              accentColor="red"
              onClick={() => navigate('/transactions')}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title={t('pages.dashboard.creditLimit')}
              value={`${formatCurrency(stats?.available_credit_limit || 0)} / ${formatCurrency(stats?.total_credit_limit || 0)}`}
              icon={<CreditCard className="h-4 w-4" />}
              accentColor="blue"
              onClick={() => navigate('/credit-cards')}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* 7. Score de Saúde Financeira */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <HealthScore />
      </motion.div>

      {/* 8. Insight Semanal do Assistente */}
      {weeklyInsightQuery.data && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="border-primary/20 bg-primary/5">
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

      {/* ── Nível 3: Análise Avançada (colapsável, lazy) ────────────────── */}
      <button
        type="button"
        onClick={() => setAdvancedAnalysisOpen((v) => !v)}
        className="py-sm flex w-full items-center gap-3 text-left"
        aria-expanded={advancedAnalysisOpen}
      >
        <div className="bg-border h-px flex-1" />
        <span className="gap-xs text-muted-foreground flex items-center text-xs font-medium tracking-wider uppercase">
          {t('pages.dashboard.sectionAdvancedAnalysis')}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              advancedAnalysisOpen && 'rotate-180'
            )}
          />
        </span>
        <div className="bg-border h-px flex-1" />
      </button>

      <AnimatePresence initial={false}>
        {advancedAnalysisOpen && (
          <motion.div
            key="advanced-analysis"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
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
                      <p className="text-sm">
                        {t('pages.dashboard.anomalies.subtitle')}
                      </p>
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

              {/* 9. Balanço de Contas | Previsão de Saldo (2 cols) */}
              <div className="gap-lg grid grid-cols-1 lg:grid-cols-2">
                {/* Balanço de Contas */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="gap-sm flex items-center">
                        <Building2 className="h-5 w-5" />
                        <CardTitle as="h2">
                          {t('pages.dashboard.accountBalance')}
                        </CardTitle>
                      </div>
                      <p className="text-sm">
                        {t('pages.dashboard.accountBalanceDesc')}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {accountBalances.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>
                                  {t('pages.dashboard.columns.account')}
                                </TableHead>
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
                                    <div className="gap-sm flex items-center">
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
                                              title={t(
                                                'pages.dashboard.pendingRevenues'
                                              )}
                                            >
                                              +
                                              {formatCurrency(account.pending_revenues)}
                                            </span>
                                          )}
                                          {account.pending_transfers_in > 0 && (
                                            <span
                                              className="text-success"
                                              title={t(
                                                'pages.dashboard.pendingTransfersIn'
                                              )}
                                            >
                                              ↓+
                                              {formatCurrency(
                                                account.pending_transfers_in
                                              )}
                                            </span>
                                          )}
                                          {account.pending_expenses > 0 && (
                                            <span
                                              className="text-destructive"
                                              title={t(
                                                'pages.dashboard.pendingExpenses'
                                              )}
                                            >
                                              -
                                              {formatCurrency(account.pending_expenses)}
                                            </span>
                                          )}
                                          {account.pending_transfers_out > 0 && (
                                            <span
                                              className="text-destructive"
                                              title={t(
                                                'pages.dashboard.pendingTransfersOut'
                                              )}
                                            >
                                              ↑-
                                              {formatCurrency(
                                                account.pending_transfers_out
                                              )}
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
                  <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Card className="h-full">
                      <CardHeader className="pb-3">
                        <div className="gap-sm flex items-center">
                          <Calculator className="h-5 w-5" />
                          <CardTitle as="h2">
                            {t('pages.dashboard.balanceForecast')}
                          </CardTitle>
                        </div>
                        <p className="text-sm">
                          {t('pages.dashboard.balanceForecastDesc')}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-lg gap-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                          <div className="bg-muted/50 p-md rounded-lg text-center">
                            <p className="mb-xs text-muted-foreground text-xs">
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
                          <div className="bg-muted/50 p-md rounded-lg text-center">
                            <p className="mb-xs text-muted-foreground text-xs">
                              {t('pages.dashboard.expectedChange')}
                            </p>
                            <p
                              className={cn(
                                'gap-xs flex items-center justify-center text-xl font-bold',
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
                              {formatCurrency(
                                Math.abs(balanceForecast.summary.net_change)
                              )}
                            </p>
                          </div>
                          <div className="bg-muted/50 p-md col-span-1 rounded-lg text-center md:col-span-2">
                            <p className="mb-xs text-muted-foreground text-xs">
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

                        <div className="gap-lg grid grid-cols-1 md:grid-cols-2">
                          {/* Entradas Previstas */}
                          <div className="space-y-3">
                            <h3 className="gap-sm text-success flex items-center text-sm font-semibold">
                              <ArrowUpRight className="h-4 w-4" />
                              {t('pages.dashboard.inflows')}
                            </h3>
                            <div className="space-y-sm">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t('pages.dashboard.pendingRevenues')}
                                </span>
                                <span className="text-success font-medium">
                                  +{formatCurrency(balanceForecast.pending_revenues)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t('pages.dashboard.loansReceivable')}
                                </span>
                                <span className="text-success font-medium">
                                  +{formatCurrency(balanceForecast.loans_to_receive)}
                                </span>
                              </div>
                              <div className="pt-sm flex items-center justify-between border-t text-sm">
                                <span className="font-semibold">
                                  {t('pages.dashboard.totalInflows')}
                                </span>
                                <span className="text-success font-bold">
                                  +
                                  {formatCurrency(balanceForecast.summary.total_income)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Saídas Previstas */}
                          <div className="space-y-3">
                            <h3 className="gap-sm text-destructive flex items-center text-sm font-semibold">
                              <ArrowDownRight className="h-4 w-4" />
                              {t('pages.dashboard.outflows')}
                            </h3>
                            <div className="space-y-sm">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t('pages.dashboard.pendingExpenses')}
                                </span>
                                <span className="text-destructive font-medium">
                                  -{formatCurrency(balanceForecast.pending_expenses)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t('pages.dashboard.creditCardBills')}
                                </span>
                                <span className="text-destructive font-medium">
                                  -{formatCurrency(balanceForecast.pending_card_bills)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t('pages.dashboard.loansToPay')}
                                </span>
                                <span className="text-destructive font-medium">
                                  -{formatCurrency(balanceForecast.loans_to_pay)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t('pages.dashboard.valuesToPay')}
                                </span>
                                <span className="text-destructive font-medium">
                                  -{formatCurrency(balanceForecast.pending_payables)}
                                </span>
                              </div>
                              <div className="pt-sm flex items-center justify-between border-t text-sm">
                                <span className="font-semibold">
                                  {t('pages.dashboard.totalOutflows')}
                                </span>
                                <span className="text-destructive font-bold">
                                  -
                                  {formatCurrency(
                                    balanceForecast.summary.total_outcome
                                  )}
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
                          onValueChange={(v) =>
                            setForecastDays(Number(v) as 30 | 60 | 90)
                          }
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nível 2: Análise Mensal (colapsável) ─────────────────────────── */}
      <button
        type="button"
        onClick={() => setMonthlyAnalysisOpen((v) => !v)}
        className="py-sm flex w-full items-center gap-3 text-left"
        aria-expanded={monthlyAnalysisOpen}
      >
        <div className="bg-border h-px flex-1" />
        <span className="gap-xs text-muted-foreground flex items-center text-xs font-medium tracking-wider uppercase">
          {t('pages.dashboard.sectionMonthlyAnalysis')}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              monthlyAnalysisOpen && 'rotate-180'
            )}
          />
        </span>
        <div className="bg-border h-px flex-1" />
      </button>

      <AnimatePresence initial={false}>
        {monthlyAnalysisOpen && (
          <motion.div
            key="monthly-analysis"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-lg">
              {/* 9b. Comparativo Mês a Mês */}
              <div className="py-sm flex items-center gap-3">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('pages.dashboard.monthOverMonth')}
                </span>
                <div className="bg-border h-px flex-1" />
              </div>

              <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
                {(
                  [
                    {
                      label: t('pages.dashboard.expenses'),
                      data: monthOverMonth.expenses,
                      color: 'text-destructive',
                      positiveIsBad: true,
                    },
                    {
                      label: t('pages.dashboard.revenues'),
                      data: monthOverMonth.revenues,
                      color: 'text-success',
                      positiveIsBad: false,
                    },
                    {
                      label: t('pages.dashboard.balance'),
                      data: monthOverMonth.balance,
                      color:
                        monthOverMonth.balance.current >= 0
                          ? 'text-success'
                          : 'text-destructive',
                      positiveIsBad: false,
                    },
                  ] as const
                ).map(({ label, data, color, positiveIsBad }) => {
                  const isUp = data.delta >= 0;
                  const deltaColor = positiveIsBad
                    ? isUp
                      ? 'text-destructive'
                      : 'text-success'
                    : isUp
                      ? 'text-success'
                      : 'text-destructive';

                  return (
                    <Card key={label} className="overflow-hidden">
                      <CardContent className="pt-md">
                        <p className="mb-xs text-muted-foreground text-sm font-medium">
                          {label}
                        </p>
                        <p className={cn('text-2xl font-bold', color)}>
                          {formatCurrency(data.current)}
                        </p>
                        <div className="mt-sm gap-xs flex items-center text-xs">
                          {isUp ? (
                            <ArrowUpRight className={cn('h-3.5 w-3.5', deltaColor)} />
                          ) : (
                            <ArrowDownRight className={cn('h-3.5 w-3.5', deltaColor)} />
                          )}
                          <span className={cn('font-medium', deltaColor)}>
                            {Math.abs(data.delta).toFixed(1)}%
                          </span>
                          <span className="text-muted-foreground">
                            {t('pages.dashboard.vsPrevMonth')}{' '}
                            {formatCurrency(data.prev)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* 10. Separador: Composição do mês */}
              <div className="py-sm flex items-center gap-3">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('pages.dashboard.monthComposition')}
                </span>
                <div className="bg-border h-px flex-1" />
              </div>

              {/* 11. Despesas por Cat | Receitas por Cat | Cartão por Cat | Orçamentos (4 cols) */}
              <div className="gap-md grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                {/* Despesas por Categoria */}
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">
                      {t('pages.dashboard.expensesByCategory')}
                    </CardTitle>
                    <p className="text-sm">
                      {t('pages.dashboard.expensesByCategoryDesc')}
                    </p>
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
                    <CardTitle as="h2">
                      {t('pages.dashboard.revenuesByCategory')}
                    </CardTitle>
                    <p className="text-sm">
                      {t('pages.dashboard.revenuesByCategoryDesc')}
                    </p>
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
                    <CardTitle as="h2" className="gap-sm flex items-center">
                      <CreditCard className="h-4 w-4" />
                      {t('pages.dashboard.cardExpensesByCategory')}
                    </CardTitle>
                    <p className="text-sm">
                      {t('pages.dashboard.cardExpensesByCategoryDesc')}
                    </p>
                    <div className="gap-sm pt-sm flex flex-wrap">
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
                          <SelectItem value="all">
                            {t('pages.dashboard.allCards')}
                          </SelectItem>
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
                          <SelectItem value="all">
                            {t('pages.dashboard.allBills')}
                          </SelectItem>
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
                      <div className="space-y-sm mt-3">
                        <div className="pb-xs flex items-center justify-between border-b text-sm">
                          <span className="font-semibold">
                            {t('pages.dashboard.total')}
                          </span>
                          <span className="text-destructive font-bold">
                            {formatCurrency(creditCardExpensesTotal)}
                          </span>
                        </div>
                        {creditCardExpensesChartData.map((category, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="gap-sm flex items-center">
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor: COLORS[index % COLORS.length],
                                }}
                              />
                              <span>{category.name}</span>
                              <span className="text-muted-foreground">
                                ({category.count})
                              </span>
                            </div>
                            <span className="text-destructive font-semibold">
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
                  <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Card className="h-full">
                      <CardHeader className="pb-3">
                        <div className="gap-sm flex items-center">
                          <PiggyBank className="h-4 w-4" />
                          <CardTitle as="h2">
                            {t('pages.dashboard.monthBudgets')}
                          </CardTitle>
                        </div>
                        <p className="text-muted-foreground text-sm">
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
                      <div className="gap-sm flex items-center">
                        <PiggyBank className="h-4 w-4" />
                        <CardTitle as="h2">
                          {t('pages.dashboard.monthBudgets')}
                        </CardTitle>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Alertas Financeiros */}
      <Dialog open={alertsModalOpen} onOpenChange={setAlertsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('pages.dashboard.financialAlerts.title')}</DialogTitle>
          </DialogHeader>
          <AlertsPanel alerts={financialAlerts} />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
