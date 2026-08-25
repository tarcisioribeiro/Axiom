/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { loanInstallmentsService } from '@/services/loan-installments-service';
import type { Loan } from '@/types';

interface LoanProgressDialogProps {
  loan: Loan | null;
  onClose: () => void;
}

interface SummaryCardProps {
  label: string;
  value: string;
  accent?: 'success' | 'destructive' | 'default';
}

function SummaryCard({ label, value, accent = 'default' }: SummaryCardProps) {
  return (
    <div className="bg-card p-sm rounded-lg border text-center">
      <p className="text-muted-foreground mb-0.5 text-xs">{label}</p>
      <p
        className={cn(
          'text-sm font-semibold',
          accent === 'success' && 'text-success',
          accent === 'destructive' && 'text-destructive'
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function LoanProgressDialog({ loan, onClose }: LoanProgressDialogProps) {
  const { t } = useTranslation();

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['loanInstallments', loan?.id],
    queryFn: () => loanInstallmentsService.getByLoan(loan!.id),
    enabled: !!loan,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const stats = useMemo(() => {
    if (!loan) return null;

    const total = parseFloat(loan.value);
    const paid = parseFloat(loan.payed_value);
    const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

    const paidInstallments = installments.filter((i) => i.payed).length;
    const remainingInstallments = installments.filter((i) => !i.payed).length;
    const nextInstallment = installments
      .filter((i) => !i.payed)
      .sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      )[0];

    const lastPaidInstallment = installments
      .filter((i) => i.payed)
      .sort(
        (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
      )[0];

    return {
      total,
      paid,
      pct,
      paidInstallments,
      remainingInstallments,
      nextInstallment,
      lastPaidDate: lastPaidInstallment?.due_date,
    };
  }, [loan, installments]);

  const chartData = useMemo(() => {
    if (!loan || installments.length === 0) return [];

    const total = parseFloat(loan.value);
    let balance = total;
    const points: { date: string; balance: number; type: 'paid' | 'upcoming' }[] = [
      { date: formatDate(loan.date, 'dd/MM/yy'), balance: total, type: 'paid' },
    ];

    const sorted = [...installments].sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );

    for (const inst of sorted) {
      balance -= parseFloat(inst.value);
      points.push({
        date: formatDate(inst.due_date, 'dd/MM/yy'),
        balance: Math.max(0, balance),
        type: inst.payed ? 'paid' : 'upcoming',
      });
    }

    return points;
  }, [loan, installments]);

  return (
    <Dialog open={!!loan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="custom-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.loans.progress.title')}</DialogTitle>
          <DialogDescription>{loan?.description}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-xl text-muted-foreground text-center text-sm">
            {t('common.actions.loading')}
          </div>
        ) : !stats ? null : (
          <div className="space-y-md">
            {/* Progress bar */}
            <div className="space-y-xs">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>{t('pages.loans.payoff')}</span>
                <span className="text-foreground font-semibold">
                  {Math.round(stats.pct)}%
                </span>
              </div>
              <div className="bg-muted h-3 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full w-full origin-left rounded-full transition-transform',
                    stats.pct >= 100
                      ? 'bg-success'
                      : loan?.status === 'defaulted'
                        ? 'bg-destructive'
                        : 'bg-primary'
                  )}
                  style={{ transform: `scaleX(${stats.pct / 100})` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-success">{formatCurrency(stats.paid)}</span>
                <span className="text-destructive">
                  {formatCurrency(stats.total - stats.paid)}
                </span>
              </div>
            </div>

            {/* Summary cards */}
            <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
              <SummaryCard
                label={t('pages.loans.progress.paidInstallments')}
                value={`${stats.paidInstallments}/${loan?.installments ?? 0}`}
                accent="success"
              />
              <SummaryCard
                label={t('pages.loans.progress.remainingInstallments')}
                value={String(stats.remainingInstallments)}
                accent={stats.remainingInstallments > 0 ? 'default' : 'success'}
              />
              <SummaryCard
                label={t('pages.loans.progress.nextDueDate')}
                value={
                  stats.nextInstallment
                    ? formatDate(stats.nextInstallment.due_date, 'dd/MM/yyyy')
                    : '—'
                }
              />
              <SummaryCard
                label={t('pages.loans.progress.outstandingBalance')}
                value={formatCurrency(stats.total - stats.paid)}
                accent={stats.total - stats.paid > 0 ? 'destructive' : 'success'}
              />
            </div>

            {/* Balance chart */}
            {chartData.length > 1 && (
              <div className="space-y-xs">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {t('pages.loans.progress.balanceOverTime')}
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat('pt-BR', {
                            notation: 'compact',
                            style: 'currency',
                            currency: 'BRL',
                          }).format(v as number)
                        }
                        width={60}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(value as number),
                          t('pages.loans.progress.outstandingBalance'),
                        ]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#balanceGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {installments.length === 0 && (
              <p className="py-sm text-muted-foreground text-center text-sm">
                {t('pages.loans.progress.noInstallments')}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
