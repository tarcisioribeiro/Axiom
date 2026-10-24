/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  TrendingDown,
  Snowflake,
  Flame,
  CalendarDays,
  DollarSign,
  Target,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services/dashboard-service';
import type { DebtPayoffPlanDebt } from '@/types';

type Strategy = 'snowball' | 'avalanche';

const URGENCY_BADGE_CLASS: Record<DebtPayoffPlanDebt['urgency'], string> = {
  overdue: 'bg-destructive/10 text-destructive',
  critical: 'bg-destructive/10 text-destructive',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

interface DebtPayoffPlannerProps {
  embedded?: boolean;
  /** Quando informado, o cabeçalho é renderizado nesse elemento (acima das abas do pai). */
  headerTarget?: HTMLElement | null;
}

export default function DebtPayoffPlanner({
  embedded = false,
  headerTarget,
}: DebtPayoffPlannerProps) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<Strategy>('snowball');
  const [extraMonthly, setExtraMonthly] = useState(0);
  const [debouncedExtraMonthly, setDebouncedExtraMonthly] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedExtraMonthly(extraMonthly), 400);
    return () => clearTimeout(timer);
  }, [extraMonthly]);

  const planQuery = useQuery({
    queryKey: ['dashboard', 'debtPayoffPlan', debouncedExtraMonthly],
    queryFn: () => dashboardService.getDebtPayoffPlan(debouncedExtraMonthly),
    staleTime: STALE_TIMES.DEBT_PAYOFF_PLAN,
    placeholderData: (previousData) => previousData,
  });

  const isLoading = planQuery.isLoading;
  const plan = planQuery.data;

  const snowballPlan = plan?.snowball;
  const avalanchePlan = plan?.avalanche;
  const activePlan = strategy === 'snowball' ? snowballPlan : avalanchePlan;
  const activeDebts = useMemo(() => activePlan?.debts ?? [], [activePlan?.debts]);

  const totalDebt = activeDebts.reduce((s, d) => s + d.balance, 0);
  const totalMinimum = activeDebts.reduce((s, d) => s + d.minimum_payment, 0);
  const snowballInterest = snowballPlan?.total_interest ?? 0;
  const avalancheInterest = avalanchePlan?.total_interest ?? 0;
  const interestSaved = snowballInterest - avalancheInterest;
  const projectedSurplus = plan?.surplus_at_due_dates ?? null;
  const projectedSurplusMonth = plan?.surplus_at_due_dates_month;
  const projectedSurplusLabel = projectedSurplusMonth
    ? new Date(
        projectedSurplusMonth.year,
        projectedSurplusMonth.month - 1
      ).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    : undefined;

  const typeColors: Record<DebtPayoffPlanDebt['type'], string> = {
    loan: 'bg-primary/10 text-primary',
    payable: 'bg-destructive/10 text-destructive',
  };

  const typeLabels: Record<DebtPayoffPlanDebt['type'], string> = {
    loan: t('pages.debtPayoff.types.loan'),
    payable: t('pages.debtPayoff.types.payable'),
  };

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  const header = (
    <PageHeader
      title={t('pages.debtPayoff.title')}
      icon={<TrendingDown className="text-destructive h-6 w-6" />}
    />
  );

  return (
    <Wrapper>
      {headerTarget ? createPortal(header, headerTarget) : header}

      {isLoading ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center">
          {t('common.actions.loading')}
        </div>
      ) : activeDebts.length === 0 ? (
        <EmptyState title={t('pages.debtPayoff.noDebts')} icon={<Trophy />} />
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
              value={String(activeDebts.length)}
              icon={<Target className="h-4 w-4" />}
            />
            <StatCard
              title={t('pages.debtPayoff.minimumMonthly')}
              value={formatCurrency(totalMinimum)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            {projectedSurplus !== null && (
              <StatCard
                title={t('pages.debtPayoff.projectedSurplus')}
                value={formatCurrency(projectedSurplus)}
                description={
                  projectedSurplusLabel
                    ? t('pages.debtPayoff.projectedSurplusUntil', {
                        date: projectedSurplusLabel,
                      })
                    : undefined
                }
                icon={<CalendarDays className="h-4 w-4" />}
                variant={projectedSurplus >= 0 ? 'success' : 'danger'}
              />
            )}
          </div>

          {/* Configurar + Comparativo numa coluna estreita; o plano (paginado) na larga. */}
          <div className="gap-lg grid items-start lg:grid-cols-3">
            <div className="space-y-md">
              {/* Controls */}
              <Card>
                <CardHeader className="pb-sm">
                  <CardTitle className="text-base">
                    {t('pages.debtPayoff.controls')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-lg">
                  <div className="gap-md grid">
                    {/* Strategy selector */}
                    <div className="space-y-sm">
                      <p className="text-sm font-medium">
                        {t('pages.debtPayoff.strategy')}
                      </p>
                      <div className="gap-sm grid grid-cols-2">
                        <button
                          onClick={() => setStrategy('snowball')}
                          className={cn(
                            'gap-sm px-md py-sm flex items-center justify-center rounded-lg border transition-colors',
                            strategy === 'snowball'
                              ? 'border-info bg-info/5 text-info'
                              : 'border-border hover:border-info/30'
                          )}
                        >
                          <Snowflake
                            className={cn(
                              'h-4 w-4',
                              strategy === 'snowball'
                                ? 'text-info'
                                : 'text-muted-foreground'
                            )}
                          />
                          <p className="text-sm font-medium">
                            {t('pages.debtPayoff.snowball')}
                          </p>
                        </button>
                        <button
                          onClick={() => setStrategy('avalanche')}
                          className={cn(
                            'gap-sm px-md py-sm flex items-center justify-center rounded-lg border transition-colors',
                            strategy === 'avalanche'
                              ? 'border-warning bg-warning/5 text-warning'
                              : 'border-border hover:border-warning/30'
                          )}
                        >
                          <Flame
                            className={cn(
                              'h-4 w-4',
                              strategy === 'avalanche'
                                ? 'text-warning'
                                : 'text-muted-foreground'
                            )}
                          />
                          <p className="text-sm font-medium">
                            {t('pages.debtPayoff.avalanche')}
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Extra beyond real surplus */}
                    <div className="space-y-sm">
                      <p className="text-sm font-medium">
                        {t('pages.debtPayoff.extraMonthly')}
                      </p>
                      <CurrencyInput
                        value={extraMonthly || ''}
                        onChange={(e) =>
                          setExtraMonthly(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comparison table */}
              <Card>
                <CardHeader className="pb-sm">
                  <CardTitle className="text-base">
                    {t('pages.debtPayoff.comparison')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="gap-md grid grid-cols-2">
                    <div className="border-primary/20 bg-primary/5 p-sm rounded-lg border">
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
                            {snowballPlan?.last_payoff_date
                              ? new Date(
                                  snowballPlan.last_payoff_date
                                ).toLocaleDateString('pt-BR', {
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="border-warning/20 bg-warning/5 p-sm rounded-lg border">
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
                            {avalanchePlan?.last_payoff_date
                              ? new Date(
                                  avalanchePlan.last_payoff_date
                                ).toLocaleDateString('pt-BR', {
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </span>
                        </div>
                      </div>
                      {interestSaved > 0 && (
                        <Badge className="mt-sm text-xs">
                          {t('pages.debtPayoff.savesWith', {
                            amount: formatCurrency(interestSaved),
                          })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Payoff plan */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-sm">
                <CardTitle className="gap-sm flex items-center text-base">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={strategy}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="gap-sm flex items-center"
                    >
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
                    </motion.span>
                  </AnimatePresence>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaginatedSlide
                  key={strategy}
                  items={activeDebts}
                  pageSize={3}
                  pinNav={false}
                  className="space-y-sm"
                >
                  {(pageItems) =>
                    pageItems.map((debt) => {
                      const debtBalancePct =
                        totalDebt > 0 ? (debt.balance / totalDebt) * 100 : 0;

                      return (
                        <div
                          key={debt.id}
                          className="bg-card px-md py-sm rounded-lg border"
                        >
                          <div className="gap-sm flex items-start justify-between">
                            <div className="gap-sm flex items-start">
                              <div
                                className={cn(
                                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-offset-1',
                                  debt.priority === 1
                                    ? 'bg-destructive/10 text-destructive ring-destructive/40'
                                    : debt.priority === 2
                                      ? 'bg-warning/10 text-warning ring-warning/40'
                                      : debt.priority === 3
                                        ? 'bg-accent/10 text-accent ring-accent/40'
                                        : 'bg-muted text-muted-foreground ring-muted-foreground/20'
                                )}
                              >
                                {debt.priority}
                              </div>
                              <div className="min-w-0">
                                <div className="gap-xs flex flex-wrap items-center">
                                  <p className="truncate text-sm font-semibold">
                                    {debt.name}
                                  </p>
                                  <span
                                    className={cn(
                                      'px-xs rounded-full py-0.5 text-xs font-medium',
                                      typeColors[debt.type]
                                    )}
                                  >
                                    {typeLabels[debt.type]}
                                  </span>
                                  <span
                                    className={cn(
                                      'px-xs rounded-full py-0.5 text-xs font-medium',
                                      URGENCY_BADGE_CLASS[debt.urgency]
                                    )}
                                  >
                                    {t(`pages.debtPayoff.urgency.${debt.urgency}`)}
                                  </span>
                                </div>
                                <div className="mt-xs gap-sm text-muted-foreground flex flex-wrap text-xs">
                                  {debt.interest_rate > 0 && (
                                    <span>{debt.interest_rate}% a.a.</span>
                                  )}
                                  {debt.due_date && (
                                    <span className="gap-xs flex items-center">
                                      <CalendarDays className="h-3 w-3" />
                                      {formatDate(debt.due_date)}
                                    </span>
                                  )}
                                  {debt.payment_plan_exists ? (
                                    <Link
                                      to={debt.type === 'loan' ? '/loans' : '/bills'}
                                      className="text-primary hover:underline"
                                    >
                                      {t('pages.debtPayoff.installmentProgress', {
                                        current: Math.min(
                                          debt.installments_paid + 1,
                                          debt.installments_total
                                        ),
                                        total: debt.installments_total,
                                      })}
                                    </Link>
                                  ) : (
                                    <Link
                                      to={debt.type === 'loan' ? '/loans' : '/bills'}
                                      className="text-primary hover:underline"
                                    >
                                      {t('pages.debtPayoff.createPaymentPlan')}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-destructive text-sm font-bold">
                                {formatCurrency(debt.balance)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {formatCurrency(debt.monthly_payment)}/
                                {t('pages.debtPayoff.month')}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {t('pages.debtPayoff.payoffBy')}{' '}
                                <strong className="text-foreground">
                                  {debt.payoff_date
                                    ? new Date(debt.payoff_date).toLocaleDateString(
                                        'pt-BR',
                                        { month: 'short', year: 'numeric' }
                                      )
                                    : t('pages.debtPayoff.payoffNotReached')}
                                </strong>
                                {debt.total_interest > 0 &&
                                  ` · ${t('pages.debtPayoff.interest')} ${formatCurrency(debt.total_interest)}`}
                              </p>
                            </div>
                          </div>

                          <div className="mt-sm bg-muted h-1.5 w-full overflow-hidden rounded-full">
                            <div
                              className="bg-destructive/60 h-full w-full origin-left rounded-full transition-transform"
                              style={{ transform: `scaleX(${debtBalancePct / 100})` }}
                            />
                          </div>

                          {debt.date_recalculated &&
                            debt.original_target_date &&
                            debt.feasible_date && (
                              <div className="mt-sm gap-xs border-warning/30 bg-warning/5 p-sm flex items-start rounded-md border">
                                <AlertTriangle className="text-warning mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <p className="text-warning text-xs">
                                  {t('pages.debtPayoff.dateRecalculated', {
                                    original: formatDate(debt.original_target_date),
                                    feasible: formatDate(debt.feasible_date),
                                  })}
                                </p>
                              </div>
                            )}
                        </div>
                      );
                    })
                  }
                </PaginatedSlide>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </Wrapper>
  );
}
