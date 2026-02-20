import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { containerVariants, itemVariants } from '@/lib/animations';
import { StatCard } from '@/components/common/StatCard';
import { dashboardService } from '@/services/dashboard-service';
import { expensesService } from '@/services/expenses-service';
import { revenuesService } from '@/services/revenues-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { useToast } from '@/hooks/use-toast';
import { translate, TRANSLATIONS } from '@/config/constants';
import { getErrorMessage } from '@/utils/error-utils';
import { formatCurrency } from '@/lib/formatters';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import type {
  DashboardStats,
  Expense,
  Revenue,
  AccountBalance,
  CreditCard as CreditCardType,
  CreditCardBill,
  CreditCardExpensesByCategory,
  BalanceForecast,
} from '@/types';
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
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useChartColors } from '@/lib/chart-colors';
import { ChartContainer } from '@/components/charts';
import { cn } from '@/lib/utils';

type CategoryStat = { category: string; name: string; value: number };

export default function Dashboard() {
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
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [selectedBill, setSelectedBill] = useState<string>('all');
  const [evolutionPeriod, setEvolutionPeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('daily');
  const [isLoading, setIsLoading] = useState(true);
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
      const [
        statsData,
        expensesData,
        revenuesData,
        accountBalancesData,
        cardsData,
        billsData,
        ccExpensesByCategoryData,
        forecastData,
      ] = await Promise.all([
        dashboardService.getStats(),
        expensesService.getAll(),
        revenuesService.getAll(),
        dashboardService.getAccountBalances(),
        creditCardsService.getAll(),
        creditCardBillsService.getAll(),
        dashboardService.getCreditCardExpensesByCategory(),
        dashboardService.getBalanceForecast(),
      ]);
      setStats(statsData);
      setExpenses(expensesData);
      setRevenues(revenuesData);
      setAccountBalances(accountBalancesData);
      setCreditCards(cardsData);
      setCreditCardBills(billsData);
      setCreditCardExpensesByCategory(ccExpensesByCategoryData);
      setBalanceForecast(forecastData);
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
        title: 'Erro ao carregar despesas por categoria',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

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
          month: format(day, 'dd/MM', { locale: ptBR }),
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
          month: format(weekStart, 'dd/MM', { locale: ptBR }),
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
          month: format(year, 'yyyy', { locale: ptBR }),
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
            month: format(month, 'MMM/yy', { locale: ptBR }),
            despesas: monthExpenses,
            receitas: monthRevenues,
            saldo: monthRevenues - monthExpenses,
          };
        }
      );
    }
  }, [expenses, revenues, evolutionPeriod]);

  const COLORS = useChartColors();

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <AnimatedPage>
      <div className="space-y-6 px-4 py-8">
        <PageHeader
          title="Dashboard de Controle Financeiro"
          icon={<LayoutDashboard />}
        />

        {/* Balanço de Contas */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>Balanço de Contas</CardTitle>
              </div>
              <p className="text-sm">Saldo atual e projeção futura por conta</p>
            </CardHeader>
            <CardContent>
              {accountBalances.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Saldo Atual</TableHead>
                      <TableHead className="text-right">Saldo Futuro</TableHead>
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
                <div className="py-8 text-center">Nenhuma conta cadastrada</div>
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
                  <CardTitle>Previsão de Saldo</CardTitle>
                </div>
                <p className="text-sm">
                  Projeção considerando todas as pendências financeiras
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="mb-1 text-xs text-muted-foreground">Saldo Atual</p>
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
                      Variação Prevista
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
                    <p className="mb-1 text-xs text-muted-foreground">Saldo Previsto</p>
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
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-success">
                      <ArrowUpRight className="h-4 w-4" />
                      Entradas Previstas
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Receitas Pendentes
                        </span>
                        <span className="font-medium text-success">
                          +{formatCurrency(balanceForecast.pending_revenues)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Empréstimos a Receber
                        </span>
                        <span className="font-medium text-success">
                          +{formatCurrency(balanceForecast.loans_to_receive)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
                        <span className="font-semibold">Total Entradas</span>
                        <span className="font-bold text-success">
                          +{formatCurrency(balanceForecast.summary.total_income)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Saídas Previstas */}
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <ArrowDownRight className="h-4 w-4" />
                      Saídas Previstas
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Despesas Pendentes
                        </span>
                        <span className="font-medium text-destructive">
                          -{formatCurrency(balanceForecast.pending_expenses)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Faturas de Cartão</span>
                        <span className="font-medium text-destructive">
                          -{formatCurrency(balanceForecast.pending_card_bills)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Empréstimos a Pagar
                        </span>
                        <span className="font-medium text-destructive">
                          -{formatCurrency(balanceForecast.loans_to_pay)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Valores a Pagar</span>
                        <span className="font-medium text-destructive">
                          -{formatCurrency(balanceForecast.pending_payables)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
                        <span className="font-semibold">Total Saídas</span>
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

        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <StatCard
              title="Saldo Total"
              value={formatCurrency(stats?.total_balance || 0)}
              icon={<Wallet className="h-4 w-4" />}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title="Despesas do Mês"
              value={formatCurrency(stats?.total_expenses || 0)}
              icon={<TrendingDown className="h-4 w-4" />}
              variant="danger"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title="Receitas do Mês"
              value={formatCurrency(stats?.total_revenues || 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="success"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title="Limite de Crédito"
              value={`${formatCurrency(stats?.available_credit_limit || 0)} / ${formatCurrency(stats?.total_credit_limit || 0)}`}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria (Top 5)</CardTitle>
              <p className="text-sm">Distribuição das maiores categorias de gastos</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="financial-expenses-category"
                data={expensesByCategory}
                dataKey="value"
                nameKey="name"
                formatter={formatCurrency}
                colors={COLORS}
                emptyMessage="Nenhuma despesa cadastrada"
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receitas por Categoria (Top 5)</CardTitle>
              <p className="text-sm">Distribuição das fontes de receita</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="financial-revenues-category"
                data={revenuesByCategory}
                dataKey="value"
                nameKey="name"
                formatter={formatCurrency}
                colors={COLORS}
                emptyMessage="Nenhuma receita cadastrada"
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>
                Evolução{' '}
                {evolutionPeriod === 'daily'
                  ? 'Diária (Últimos 30 Dias)'
                  : evolutionPeriod === 'weekly'
                    ? 'Semanal (Últimas 8 Semanas)'
                    : evolutionPeriod === 'yearly'
                      ? 'Anual (Últimos 5 Anos)'
                      : 'Mensal (Últimos 6 Meses)'}
              </CardTitle>
              <Select
                value={evolutionPeriod}
                onValueChange={(v) =>
                  setEvolutionPeriod(v as 'daily' | 'weekly' | 'monthly' | 'yearly')
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
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
              emptyMessage="Nenhum dado disponível"
              lockChartType="line"
              lines={[
                { dataKey: 'despesas', stroke: COLORS[5], name: 'Despesas' },
                { dataKey: 'receitas', stroke: COLORS[3], name: 'Receitas' },
                { dataKey: 'saldo', stroke: COLORS[0], name: 'Saldo' },
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
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Despesas de Cartão por Categoria
                </CardTitle>
                <p className="mt-1 text-sm">
                  Distribuição das despesas de cartão de crédito
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={selectedCard} onValueChange={setSelectedCard}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os Cartões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Cartões</SelectItem>
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
                  <SelectTrigger className="w-[180px]">
                    <SelectValue
                      placeholder={
                        filteredBills.length === 0 ? 'Sem faturas' : 'Todas as Faturas'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Faturas</SelectItem>
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
                  emptyMessage="Nenhuma despesa de cartão encontrada"
                  lockChartType="pie"
                  height={350}
                />
              </div>
              <div>
                {creditCardExpensesChartData.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-semibold">Total</span>
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
                    <p className="text-sm">Nenhuma despesa de cartão encontrada</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
