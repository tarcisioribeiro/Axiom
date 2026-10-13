import { TrendingUp } from 'lucide-react';
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
import { TRANSLATIONS } from '@/config/constants';
import { BILL_STATUS_ICONS } from '@/config/icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Receivable } from '@/types';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  received: 'secondary',
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
  receivable: Receivable | null;
  onClose: () => void;
}

export function ReceivableDetailModal({ receivable, onClose }: Props) {
  const { t } = useTranslation();

  if (!receivable) return null;

  const total = parseFloat(receivable.value);
  const received = parseFloat(receivable.received_value);
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const barColor = pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-info';
  const StatusIcon = BILL_STATUS_ICONS[receivable.status];

  return (
    <Dialog open={!!receivable} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center text-lg">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            {receivable.description}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {receivable.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between">
          <p className="text-muted-foreground text-sm">
            {TRANSLATIONS.revenueCategories[
              receivable.category as keyof typeof TRANSLATIONS.revenueCategories
            ] ?? receivable.category}
          </p>
          <Badge
            variant={STATUS_VARIANTS[receivable.status] ?? 'default'}
            className="gap-xs"
          >
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {t(`pages.receivables.status.${receivable.status}`)}
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
              {t('pages.receivables.receivedAmount', {
                value: formatCurrency(received),
              })}
            </span>
            <span>{pct.toFixed(0)}%</span>
          </div>
        </div>

        <div className="gap-md grid grid-cols-2">
          <DetailField
            label={t('pages.receivables.totalValue')}
            value={formatCurrency(receivable.value)}
          />
          <DetailField
            label={t('pages.receivables.remainingBalance')}
            value={formatCurrency(total - received)}
          />
          {receivable.due_date && (
            <DetailField
              label={t('pages.receivables.dueDate')}
              value={formatDate(receivable.due_date, 'dd/MM/yyyy')}
            />
          )}
          {receivable.member_name && (
            <DetailField
              label={t('pages.receivables.debtor')}
              value={receivable.member_name}
            />
          )}
        </div>

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
