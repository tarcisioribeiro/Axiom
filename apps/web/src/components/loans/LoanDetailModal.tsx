import { HandCoins } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getLoanStatusLabel, translate } from '@/config/constants';
import { LOAN_STATUS_ICONS } from '@/config/icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Loan } from '@/types';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  paid: 'secondary',
  defaulted: 'destructive',
  cancelled: 'outline',
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

interface Props {
  loan: Loan | null;
  currentUserMemberId: number | null;
  onClose: () => void;
}

export function LoanDetailModal({ loan, currentUserMemberId, onClose }: Props) {
  const { t } = useTranslation();

  if (!loan) return null;

  const total = parseFloat(loan.value);
  const paid = parseFloat(loan.payed_value);
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const isCreditor = loan.creditor === currentUserMemberId;
  const StatusIcon = LOAN_STATUS_ICONS[loan.status];

  return (
    <Dialog open={!!loan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center text-lg">
            <HandCoins className="h-5 w-5" aria-hidden="true" />
            {loan.description}
          </DialogTitle>
          <DialogDescription className="sr-only">{loan.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between">
          <p className="text-muted-foreground text-sm">
            {translate('expenseCategories', loan.category)}
          </p>
          <Badge variant={STATUS_VARIANTS[loan.status] ?? 'default'} className="gap-xs">
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {getLoanStatusLabel(loan.status, isCreditor)}
          </Badge>
        </div>

        <div className="space-y-xs">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{t('pages.loans.payoff')}</span>
            <span className="font-medium">{Math.round(pct)}%</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full transition',
                pct >= 100
                  ? 'bg-success'
                  : loan.status === 'defaulted'
                    ? 'bg-destructive'
                    : 'bg-primary'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-success">
              {t(isCreditor ? 'pages.loans.receivedAmount' : 'pages.loans.paidAmount', {
                value: formatCurrency(loan.payed_value),
              })}
            </span>
            <span className="text-destructive">
              {t(
                isCreditor
                  ? 'pages.loans.toReceiveAmount'
                  : 'pages.loans.remainingAmount',
                { value: formatCurrency(total - paid) }
              )}
            </span>
          </div>
        </div>

        <div className="gap-md grid grid-cols-2">
          <DetailField
            label={t('pages.loans.totalValue')}
            value={formatCurrency(loan.value)}
          />
          <DetailField
            label={t('pages.loans.installmentsLabel')}
            value={`${loan.installments}x`}
          />
          <DetailField
            label={t('pages.loans.beneficiary')}
            value={loan.benefited_name ?? '—'}
          />
          <DetailField
            label={t('pages.loans.creditor')}
            value={loan.creditor_name ?? '—'}
          />
          {loan.due_date && (
            <DetailField
              label={t('pages.loans.dueDate')}
              value={formatDate(loan.due_date, 'dd/MM/yyyy')}
            />
          )}
        </div>

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
