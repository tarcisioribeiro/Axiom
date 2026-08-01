/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown,
  Snowflake,
  Flame,
  CalendarDays,
  DollarSign,
  Target,
  Trophy,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { loansService } from '@/services/loans-service';
import { payablesService } from '@/services/payables-service';
import type { CreditCardBill } from '@/types';

type Strategy = 'snowball' | 'avalanche';

interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  type: 'loan' | 'bill' | 'payable';
  dueDate?: string;
}

interface DebtPlan {
  debt: Debt;
  payoffDate: Date;
  totalPaid: number;
  totalInterest: number;
  monthlyPayment: number;
  priority: number;
}

function computePayoffPlan(
  debts: Debt[],
  monthlyExtra: number,
  strategy: Strategy
): DebtPlan[] {
  if (debts.length === 0) return [];

  const sorted = [...debts].sort((a, b) => {
    if (strategy === 'snowball') return a.balance - b.balance;
    return b.interestRate - a.interestRate;
  });

  const today = new Date();
  const state = sorted.map((d) => ({
    debt: d,
    remaining: d.balance,
    totalPaid: 0,
    totalInterest: 0,
    payoffDate: null as Date | null,
    priority: 0,
  }));

  let extraPool = monthlyExtra;

  let month = 0;
  const MAX_MONTHS = 600;

  while (state.some((s) => s.remaining > 0) && month < MAX_MONTHS) {
    month++;
    const date = new Date(today);
    date.setMonth(date.getMonth() + month);

    let currentExtra = extraPool;
    for (let i = 0; i < state.length; i++) {
      const s = state[i];
      if (s.remaining <= 0) continue;

      const monthlyRate = s.debt.interestRate / 100 / 12;
      const interest = s.remaining * monthlyRate;
      s.totalInterest += interest;
      s.remaining += interest;

      let payment = s.debt.minimumPayment;
      if (i === state.findIndex((x) => x.remaining > 0)) {
        payment += currentExtra;
        currentExtra = 0;
      }

      payment = Math.min(payment, s.remaining);
      s.remaining -= payment;
      s.totalPaid += payment;

      if (s.remaining <= 0.01) {
        s.remaining = 0;
        if (!s.payoffDate) {
          s.payoffDate = date;
          s.priority = state.filter((x) => x.payoffDate !== null).length;
          extraPool += s.debt.minimumPayment;
        }
      }
    }
  }

  return state.map((s, idx) => ({
    debt: s.debt,
    payoffDate: s.payoffDate ?? new Date(today.setMonth(today.getMonth() + MAX_MONTHS)),
    totalPaid: s.totalPaid,
    totalInterest: s.totalInterest,
    monthlyPayment:
      s.debt.minimumPayment +
      (idx === state.findIndex((x) => x.payoffDate === null || x.remaining === 0)
        ? monthlyExtra
        : 0),
    priority: s.priority || idx + 1,
  }));
}

function getPriorityBorderColor(priority: number): string {
  const colors = [
    'border-l-destructive',
    'border-l-warning',
    'border-l-accent',
    'border-l-muted-foreground',
  ];
  return colors[Math.min(priority - 1, colors.length - 1)];
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function DebtPayoffPlanner({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<Strategy>('snowball');
  const [monthlyExtra, setMonthlyExtra] = useState(0);

  const loansQuery = useQuery({
    queryKey: ['loans', 'active'],
    queryFn: () => loansService.getAll({ payed: false }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const billsQuery = useQuery({
    queryKey: ['creditCardBills', 'open'],
    queryFn: () => creditCardBillsService.getAll({ status: 'open' }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const payablesQuery = useQuery({
    queryKey: ['payables', 'active'],
    queryFn: () => payablesService.getAll({ status: 'active' }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading =
    loansQuery.isLoading || billsQuery.isLoading || payablesQuery.isLoading;

  const debts = useMemo((): Debt[] => {
    const result: Debt[] = [];

    for (const loan of loansQuery.data ?? []) {
      if (loan.loan_type !== 'borrowed') continue;
      const balance = parseFloat(loan.value) - parseFloat(loan.payed_value || '0');
      if (balance <= 0) continue;
      result.push({
        id: `loan-${loan.id}`,
        name: loan.description,
        balance,
        interestRate: parseFloat(loan.interest_rate ?? '0') || 0,
        minimumPayment: balance / Math.max(loan.installments, 1),
        type: 'loan',
        dueDate: loan.due_date,
      });
    }

    const billsByCard = new Map<number, CreditCardBill[]>();
    for (const bill of billsQuery.data ?? []) {
      const balance =
        parseFloat(bill.total_amount) - parseFloat(bill.paid_amount ?? '0');
      if (balance <= 0) continue;
      const group = billsByCard.get(bill.credit_card) ?? [];
      group.push(bill);
      billsByCard.set(bill.credit_card, group);
    }
    for (const [cardId, bills] of billsByCard) {
      if (!bills || bills.length === 0) continue;
      const totalBalance = bills.reduce(
        (sum, b) => sum + parseFloat(b.total_amount) - parseFloat(b.paid_amount ?? '0'),
        0
      );
      const totalMinimum = bills.reduce(
        (sum, b) => sum + parseFloat(b.minimum_payment ?? '0'),
        0
      );
      const cardName = bills[0].credit_card_name ?? t('pages.debtPayoff.creditCard');
      const dueDates = bills
        .map((b) => b.due_date)
        .filter((d): d is string => !!d)
        .sort();
      result.push({
        id: `card-${cardId}`,
        name: cardName,
        balance: totalBalance,
        interestRate: 0,
        minimumPayment: totalMinimum || totalBalance,
        type: 'bill',
        dueDate: dueDates[0],
      });
    }

    for (const payable of payablesQuery.data ?? []) {
      if (payable.status !== 'active' && payable.status !== 'overdue') continue;
      const remaining =
        parseFloat(payable.remaining_value ?? payable.value) -
        parseFloat(payable.paid_value || '0');
      if (remaining <= 0) continue;
      result.push({
        id: `payable-${payable.id}`,
        name: payable.description,
        balance: remaining,
        interestRate: 0,
        minimumPayment: remaining / Math.max(payable.installments ?? 1, 1),
        type: 'payable',
        dueDate: payable.due_date,
      });
    }

    return result;
  }, [loansQuery.data, billsQuery.data, payablesQuery.data, t]);

  const snowballPlan = useMemo(
    () => computePayoffPlan(debts, monthlyExtra, 'snowball'),
    [debts, monthlyExtra]
  );

  const avalanchePlan = useMemo(
    () => computePayoffPlan(debts, monthlyExtra, 'avalanche'),
    [debts, monthlyExtra]
  );

  const activePlan = strategy === 'snowball' ? snowballPlan : avalanchePlan;

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinimum = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const snowballInterest = snowballPlan.reduce((s, p) => s + p.totalInterest, 0);
  const avalancheInterest = avalanchePlan.reduce((s, p) => s + p.totalInterest, 0);
  const interestSaved = snowballInterest - avalancheInterest;
  const lastPayoff =
    activePlan.length > 0
      ? new Date(
          Math.max(
            ...activePlan.map((p) => (p.payoffDate ? p.payoffDate.getTime() : 0))
          )
        )
      : null;

  const typeColors: Record<Debt['type'], string> = {
    loan: 'bg-primary/10 text-primary',
    bill: 'bg-warning/10 text-warning',
    payable: 'bg-destructive/10 text-destructive',
  };

  const typeLabels: Record<Debt['type'], string> = {
    loan: t('pages.debtPayoff.types.loan'),
    bill: t('pages.debtPayoff.types.bill'),
    payable: t('pages.debtPayoff.types.payable'),
  };

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader
        title={t('pages.debtPayoff.title')}
        description={t('pages.debtPayoff.description')}
        icon={<TrendingDown className="text-destructive h-6 w-6" />}
      />

      {isLoading ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center">
          {t('common.actions.loading')}
        </div>
      ) : debts.length === 0 ? (
        <div className="gap-md flex h-64 flex-col items-center justify-center text-center">
          <Trophy className="text-success h-16 w-16 opacity-60" />
          <div>
            <p className="text-success text-lg font-semibold">
              {t('pages.debtPayoff.noDebts')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.debtPayoff.noDebtsDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-lg">
          {/* Summary stats */}
          <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t('pages.debtPayoff.totalDebt')}
              value={formatCurrency(totalDebt)}
              icon={<TrendingDown className="h-4 w-4" />}
              variant="danger"
            />
            <StatCard
              title={t('pages.debtPayoff.totalDebts')}
              value={String(debts.length)}
              icon={<Target className="h-4 w-4" />}
            />
            <StatCard
              title={t('pages.debtPayoff.minimumMonthly')}
              value={formatCurrency(totalMinimum)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            {lastPayoff && (
              <StatCard
                title={t('pages.debtPayoff.estimatedPayoff')}
                value={formatDate(lastPayoff.toISOString())}
                icon={<CalendarDays className="h-4 w-4" />}
                variant="success"
              />
            )}
          </div>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('pages.debtPayoff.controls')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-lg">
              <div className="gap-lg grid sm:grid-cols-2">
                {/* Strategy selector */}
                <div className="space-y-sm">
                  <p className="text-sm font-medium">
                    {t('pages.debtPayoff.strategy')}
                  </p>
                  <div className="gap-sm grid grid-cols-2">
                    <button
                      onClick={() => setStrategy('snowball')}
                      className={cn(
                        'gap-xs p-md flex flex-col items-center rounded-lg border transition-colors',
                        strategy === 'snowball'
                          ? 'border-info bg-info/5 text-info'
                          : 'border-border hover:border-info/30'
                      )}
                    >
                      <Snowflake
                        className={cn(
                          'h-6 w-6',
                          strategy === 'snowball'
                            ? 'text-info'
                            : 'text-muted-foreground'
                        )}
                      />
                      <p className="text-sm font-medium">
                        {t('pages.debtPayoff.snowball')}
                      </p>
                      <p className="text-muted-foreground text-center text-xs">
                        {t('pages.debtPayoff.snowballDesc')}
                      </p>
                    </button>
                    <button
                      onClick={() => setStrategy('avalanche')}
                      className={cn(
                        'gap-xs p-md flex flex-col items-center rounded-lg border transition-colors',
                        strategy === 'avalanche'
                          ? 'border-warning bg-warning/5 text-warning'
                          : 'border-border hover:border-warning/30'
                      )}
                    >
                      <Flame
                        className={cn(
                          'h-6 w-6',
                          strategy === 'avalanche'
                            ? 'text-warning'
                            : 'text-muted-foreground'
                        )}
                      />
                      <p className="text-sm font-medium">
                        {t('pages.debtPayoff.avalanche')}
                      </p>
                      <p className="text-muted-foreground text-center text-xs">
                        {t('pages.debtPayoff.avalancheDesc')}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Monthly extra */}
                <div className="space-y-sm">
                  <p className="text-sm font-medium">
                    {t('pages.debtPayoff.extraMonthly')}
                  </p>
                  <CurrencyInput
                    value={monthlyExtra || ''}
                    onChange={(e) => setMonthlyExtra(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('pages.debtPayoff.extraMonthlyHint')}
                  </p>
                </div>
              </div>

              {/* Strategy comparison */}
              {interestSaved > 0 && (
                <div className="gap-sm border-success/30 bg-success/5 p-md flex items-start rounded-lg border">
                  <Info className="text-success mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-success text-sm">
                    {t('pages.debtPayoff.interestSavedWithAvalanche', {
                      amount: formatCurrency(interestSaved),
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payoff plan */}
          <Card>
            <CardHeader>
              <CardTitle className="gap-sm flex items-center text-base">
                {strategy === 'snowball' ? (
                  <Snowflake className="text-primary h-4 w-4" />
                ) : (
                  <Flame className="text-primary h-4 w-4" />
                )}
                {t('pages.debtPayoff.plan', {
                  strategy:
                    strategy === 'snowball'
                      ? t('pages.debtPayoff.snowball')
                      : t('pages.debtPayoff.avalanche'),
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-sm">
                <AnimatePresence mode="sync">
                  {activePlan.map((plan, idx) => {
                    const debtBalancePct =
                      totalDebt > 0 ? (plan.debt.balance / totalDebt) * 100 : 0;

                    return (
                      <motion.div
                        key={plan.debt.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          'bg-card p-md rounded-lg border border-l-4',
                          getPriorityBorderColor(plan.priority)
                        )}
                      >
                        <div className="gap-sm flex items-start justify-between">
                          <div className="gap-sm flex items-start">
                            <div
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-offset-1',
                                plan.priority === 1
                                  ? 'bg-destructive/10 text-destructive ring-destructive/40'
                                  : plan.priority === 2
                                    ? 'bg-warning/10 text-warning ring-warning/40'
                                    : plan.priority === 3
                                      ? 'bg-accent/10 text-accent ring-accent/40'
                                      : 'bg-muted text-muted-foreground ring-muted-foreground/20'
                              )}
                            >
                              {plan.priority}
                            </div>
                            <div className="min-w-0">
                              <div className="gap-xs flex flex-wrap items-center">
                                <p className="truncate text-sm font-semibold">
                                  {plan.debt.name}
                                </p>
                                <span
                                  className={cn(
                                    'px-xs rounded-full py-0.5 text-xs font-medium',
                                    typeColors[plan.debt.type]
                                  )}
                                >
                                  {typeLabels[plan.debt.type]}
                                </span>
                              </div>
                              <div className="mt-xs gap-sm text-muted-foreground flex flex-wrap text-xs">
                                {plan.debt.interestRate > 0 && (
                                  <span>{plan.debt.interestRate}% a.a.</span>
                                )}
                                {plan.debt.dueDate && (
                                  <span className="gap-xs flex items-center">
                                    <CalendarDays className="h-3 w-3" />
                                    {formatDate(plan.debt.dueDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-destructive text-sm font-bold">
                              {formatCurrency(plan.debt.balance)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {formatCurrency(plan.monthlyPayment)}/
                              {t('pages.debtPayoff.month')}
                            </p>
                          </div>
                        </div>

                        <div className="mt-sm bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-destructive/60 h-full rounded-full transition-all"
                            style={{ width: `${debtBalancePct}%` }}
                          />
                        </div>

                        <div className="mt-sm text-muted-foreground flex items-center justify-between text-xs">
                          <span className="gap-xs flex items-center">
                            <ArrowRight className="h-3 w-3" />
                            {t('pages.debtPayoff.payoffBy')}{' '}
                            <strong className="text-foreground">
                              {plan.payoffDate.toLocaleDateString('pt-BR', {
                                month: 'short',
                                year: 'numeric',
                              })}
                            </strong>
                          </span>
                          {plan.totalInterest > 0 && (
                            <span>
                              {t('pages.debtPayoff.interest')}{' '}
                              {formatCurrency(plan.totalInterest)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Comparison table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('pages.debtPayoff.comparison')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="gap-md grid sm:grid-cols-2">
                <div className="border-primary/20 bg-primary/5 p-md rounded-lg border">
                  <div className="mb-sm gap-sm flex items-center">
                    <Snowflake className="text-primary h-4 w-4" />
                    <p className="font-medium">{t('pages.debtPayoff.snowball')}</p>
                  </div>
                  <div className="space-y-xs text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.debtPayoff.totalInterest')}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(snowballInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.debtPayoff.payoffDate')}
                      </span>
                      <span className="font-semibold">
                        {snowballPlan.length > 0 &&
                        snowballPlan[snowballPlan.length - 1]?.payoffDate
                          ? snowballPlan[
                              snowballPlan.length - 1
                            ].payoffDate.toLocaleDateString('pt-BR', {
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-sm text-xs">
                    {t('pages.debtPayoff.snowballBenefit')}
                  </Badge>
                </div>
                <div className="border-warning/20 bg-warning/5 p-md rounded-lg border">
                  <div className="mb-sm gap-sm flex items-center">
                    <Flame className="text-warning h-4 w-4" />
                    <p className="font-medium">{t('pages.debtPayoff.avalanche')}</p>
                  </div>
                  <div className="space-y-xs text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.debtPayoff.totalInterest')}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(avalancheInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.debtPayoff.payoffDate')}
                      </span>
                      <span className="font-semibold">
                        {avalanchePlan.length > 0 &&
                        avalanchePlan[avalanchePlan.length - 1]?.payoffDate
                          ? avalanchePlan[
                              avalanchePlan.length - 1
                            ].payoffDate.toLocaleDateString('pt-BR', {
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={interestSaved > 0 ? 'default' : 'secondary'}
                    className="mt-sm text-xs"
                  >
                    {interestSaved > 0
                      ? t('pages.debtPayoff.savesWith', {
                          amount: formatCurrency(interestSaved),
                        })
                      : t('pages.debtPayoff.avalancheBenefit')}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Wrapper>
  );
}
