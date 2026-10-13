import { Receipt } from 'lucide-react';
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
import { translate } from '@/config/constants';
import { BILL_STATUS_ICONS } from '@/config/icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Payable } from '@/types';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  paid: 'secondary',
  overdue: 'destructive',
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
  payable: Payable | null;
  onClose: () => void;
}

export function PayableDetailModal({ payable, onClose }: Props) {
  const { t } = useTranslation();

  if (!payable) return null;

  const total = parseFloat(payable.value);
  const paid = parseFloat(payable.paid_value);
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const barColor =
    pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
  const StatusIcon = BILL_STATUS_ICONS[payable.status];

  return (
    <Dialog open={!!payable} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center text-lg">
            <Receipt className="h-5 w-5" aria-hidden="true" />
            {payable.description}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {payable.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between">
          <p className="text-muted-foreground text-sm">
            {translate('expenseCategories', payable.category)}
          </p>
          <Badge
            variant={STATUS_VARIANTS[payable.status] ?? 'default'}
            className="gap-xs"
          >
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {translate('payableStatus', payable.status)}
          </Badge>
        </div>

        <div className="space-y-xs">
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full transition-[width]', barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {t('pages.payables.paidAmount', { value: formatCurrency(paid) })}
            </span>
            <span>{pct.toFixed(0)}%</span>
          </div>
        </div>

        <div className="gap-md grid grid-cols-2">
          <DetailField
            label={t('pages.payables.totalValue')}
            value={formatCurrency(payable.value)}
          />
          <DetailField
            label={t('pages.payables.remainingBalance')}
            value={formatCurrency(total - paid)}
          />
          {payable.due_date && (
            <DetailField
              label={t('pages.payables.dueDate')}
              value={formatDate(payable.due_date, 'dd/MM/yyyy')}
            />
          )}
          {payable.member_name && (
            <DetailField
              label={t('pages.payables.responsible')}
              value={payable.member_name}
            />
          )}
        </div>

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
