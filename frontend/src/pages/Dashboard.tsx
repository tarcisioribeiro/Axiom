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
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { containerVariants, itemVariants } from '@/lib/animations';
import { useChartColors } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { budgetsService } from '@/services/budgets-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { dashboardService } from '@/services/dashboard-service';
import { expensesService } from '@/services/expenses-service';
import { revenuesService } from '@/services/revenues-service';
import type {
  DashboardStats,
  Expense,
  Revenue,
  AccountBalance,
  CreditCard as CreditCardType,
  CreditCardBill,
  CreditCardExpensesByCategory,
  BalanceForecast,
  BudgetStatus,
  CashFlowForecast,
  FinancialAlert,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type CategoryStat = { category: string; name: string; value: number };

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [creditCardBills, setCreditCardBills] = useState<CreditCardBill[]>([]);
  const [creditCardExpensesByCategory, setCreditCardExpensesByCategory] = useState<
    CreditCardExpensesByCategory[]
  >([]);
  const [balanceForecast, setBalanceForecast] = useState<BalanceForecast | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [selectedBill, setSelectedBill] = useState<string>('all');
  const [evolutionPeriod, setEvolutionPeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('daily');
  const [financialAlerts, setFinancialAlerts] = useState<FinancialAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cashFlowForecast, setCashFlowForecast] = useState<CashFlowForecast | null>(
    null
  );
  const [forecastDays, setForecastDays] = useState<30 | 60 | 90>(30);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const forecastMounted = useRef(false);
  const { toast } = useToast();

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
      const now = new Date();
      const [
        statsData,
        expensesData,
        revenuesData,
        accountBalancesData,
        cardsData,
        billsData,
        ccExpensesByCategoryData,
        forecastData,
        budgetStatusData,
        cashFlowData,
        alertsData,
      ] = await Promise.all([
        dashboardService.getStats(),
        expensesService.getAll(),
        revenuesService.getAll(),
        dashboardService.getAccountBalances(),
        creditCardsService.getAll(),
        creditCardBillsService.getAll(),
        dashboardService.getCreditCardExpensesByCategory(),
        dashboardService.getBalanceForecast(),
        budgetsService.getStatus({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        }),
        dashboardService.getCashFlowForecast(30),
        dashboardService.getFinancialAlerts(),
      ]);
      setStats(statsData);
      setExpenses(expensesData);
      setRevenues(revenuesData);
      setAccountBalances(accountBalancesData);
      setCreditCards(cardsData);
      setCreditCardBills(billsData);
      setCreditCardExpensesByCategory(ccExpensesByCategoryData);
      setBalanceForecast(forecastData);
      setBudgetStatus(Array.isArray(budgetStatusData) ? budgetStatusData : []);
      setCashFlowForecast(cashFlowData);
      setFinancialAlerts(Array.isArray(alertsData) ? alertsData : []);
      forecastMounted.current = true;
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load credit card expenses by category with filters
  const loadCreditCardExpensesByCategory = async () => {
    try {
      const params: { card?: number; bill?: number } = {};
      if (selectedCard !== 'all') {
        params.card = parseInt(selectedCard);
      }
      if (selectedBill !== 'all') {
        params.bill = parseInt(selectedBill);
      }
      const data = await dashboardService.getCreditCardExpensesByCategory(params);
      setCreditCardExpensesByCategory(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.dashboard.loadCategoryError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const loadForecast = async (days: 30 | 60 | 90) => {
    setIsForecastLoading(true);
    try {
      const data = await dashboardService.getCashFlowForecast(days);
      setCashFlowForecast(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.dashboard.cashFlowProjection'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsForecastLoading(false);
    }
  };

  // Reload forecast only when the period selector changes (skip initial mount)
  useEffect(() => {
    if (!forecastMounted.current) return;
    void loadForecast(forecastDays);
  }, [forecastDays]);

  // Reload credit card expenses when filters change
  useEffect(() => {
    if (!isLoading) {
      void loadCreditCardExpensesByCategory();
    }
  }, [selectedCard, selectedBill]);

  // Filter bills by selected card
  const filteredBills = useMemo(() => {
    if (selectedCard === 'all') return creditCardBills;
    return creditCardBills.filter((b) => b.credit_card.toString() === selectedCard);
  }, [selectedCard, creditCardBills]);

  // Reset bill filter when card changes
  useEffect(() => {
    if (selectedCard !== 'all') {
      const currentBillValid = filteredBills.some(
        (b) => b.id.toString() === selectedBill
      );
      if (!currentBillValid) {
        setSelectedBill('all');
      }
    }
  }, [selectedCard, filteredBills]);

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
  }, [expenses, revenues, evolutionPeriod]);

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
      <div className="space-y-6 px-4 py-8">
        <PageHeader title={t('pages.dashboard.title')} icon={<LayoutDashboard />} />

        {/* Alertas Financeiros */}
        {financialAlerts.length > 0 && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <AlertsPanel alerts={financialAlerts} />
          </motion.div>
        )}

        {/* Balanço de Contas */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle as="h2">{t('pages.dashboard.accountBalance')}</CardTitle>
              </div>
              <p className="text-sm">{t('pages.dashboard.accountBalanceDesc')}</p>
            </CardHeader>
            <CardContent>
              {accountBalances.length > 0 ? (
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
                          <div>
                            <div>{account.account_name}</div>
                            <div className="text-xs">
                              {translate('institutions', account.institution_name)}
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
                              account.pending_expenses > 0) && (
                              <div className="mt-1 text-xs">
                                {account.pending_revenues > 0 && (
                                  <span className="text-success">
                                    +{formatCurrency(account.pending_revenues)}
                                  </span>
                                )}
                                {account.pending_revenues > 0 &&
                                  account.pending_expenses > 0 &&
                                  ' / '}
                                {account.pending_expenses > 0 && (
                                  <span className="text-destructive">
                                    -{formatCurrency(account.pending_expenses)}
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
              ) : (
                <div className="py-8 text-center">
                  {t('pages.dashboard.noAccounts')}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Previsão de Saldo */}
        {balanceForecast && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  <CardTitle as="h2">{t('pages.dashboard.balanceForecast')}</CardTitle>
                </div>
                <p className="text-sm">{t('pages.dashboard.balanceForecastDesc')}</p>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="mb-1 text-xs text-muted-foreground">
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
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {t('pages.dashboard.expectedChange')}
                    </p>
                    <p
                      className={cn(
                        'flex items-center justify-center gap-1 text-xl font-bold',
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
                  <div className="col-span-1 rounded-lg bg-muted/50 p-4 text-center md:col-span-2">
                    <p className="mb-1 text-xs text-muted-foreground">
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

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Entradas Previstas */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-success">
                      <ArrowUpRight className="h-4 w-4" />
                      {t('pages.dashboard.inflows')}
                    </h3>
                    <div className="space-y-2">
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
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
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
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <ArrowDownRight className="h-4 w-4" />
                      {t('pages.dashboard.outflows')}
                    </h3>
                    <div className="space-y-2">
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
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
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

        {/* Projeção de Fluxo de Caixa */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  <CardTitle as="h2">{t('pages.dashboard.cashFlowProjection')}</CardTitle>
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
                    <SelectItem value="30">{t('pages.dashboard.period30')}</SelectItem>
                    <SelectItem value="60">{t('pages.dashboard.period60')}</SelectItem>
                    <SelectItem value="90">{t('pages.dashboard.period90')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cashFlowForecast && (
                <div className="flex flex-wrap gap-4 pt-1 text-sm">
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

        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                height={350}
              />
            </CardContent>
          </Card>

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
                height={350}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
                  <SelectItem value="daily">{t('pages.dashboard.daily')}</SelectItem>
                  <SelectItem value="weekly">{t('pages.dashboard.weekly')}</SelectItem>
                  <SelectItem value="monthly">
                    {t('pages.dashboard.monthly')}
                  </SelectItem>
                  <SelectItem value="yearly">{t('pages.dashboard.annual')}</SelectItem>
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

        {/* Credit Card Expenses by Category */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('pages.dashboard.cardExpensesByCategory')}
                </CardTitle>
                <p className="mt-1 text-sm">
                  {t('pages.dashboard.cardExpensesByCategoryDesc')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={selectedCard} onValueChange={setSelectedCard}>
                  <SelectTrigger
                    className="w-[180px]"
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
                    className="w-[180px]"
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <ChartContainer
                  chartId="credit-card-expenses-category"
                  data={creditCardExpensesChartData}
                  dataKey="value"
                  nameKey="name"
                  formatter={formatCurrency}
                  colors={COLORS}
                  emptyMessage={t('pages.dashboard.noCardExpenses')}
                  lockChartType="pie"
                  height={350}
                />
              </div>
              <div>
                {creditCardExpensesChartData.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-semibold">
                        {t('pages.dashboard.total')}
                      </span>
                      <span className="text-lg font-bold text-destructive">
                        {formatCurrency(creditCardExpensesTotal)}
                      </span>
                    </div>
                    {creditCardExpensesChartData.map((category, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span>{category.name}</span>
                          <span className="text-xs">({category.count})</span>
                        </div>
                        <span className="font-semibold text-destructive">
                          {formatCurrency(category.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm">{t('pages.dashboard.noCardExpenses')}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Status */}
      {budgetStatus.length > 0 && (
        <div>
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  <CardTitle as="h2">{t('pages.dashboard.monthBudgets')}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('pages.dashboard.monthBudgetsDesc')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgetStatus.map((item) => {
                    const pct = Math.min(item.percentage, 100);
                    const barColor =
                      item.status === 'exceeded'
                        ? 'bg-destructive'
                        : item.status === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-success';
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {translate('expenseCategories', item.category)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {formatCurrency(item.actual_spent)} /{' '}
                              {formatCurrency(item.limit_amount)}
                            </span>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs font-semibold',
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
        </div>
      )}
    </AnimatedPage>
  );
}
