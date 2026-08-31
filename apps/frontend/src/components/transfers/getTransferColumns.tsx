import type { TFunction } from 'i18next';
import { ArrowRight } from 'lucide-react';

import type { Column } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { translate } from '@/config/constants';
import { STATUS_VARIANTS, getTransferStatus } from '@/hooks/use-transfers-data';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Transfer } from '@/types';

export function getTransferColumns(t: TFunction): Column<Transfer>[] {
  return [
    {
      key: 'description',
      label: t('pages.transfers.columns.description'),
      render: (transfer) => <div className="font-medium">{transfer.description}</div>,
    },
    {
      key: 'value',
      label: t('pages.transfers.columns.amount'),
      align: 'right',
      render: (transfer) => (
        <span className="font-semibold">{formatCurrency(transfer.value)}</span>
      ),
    },
    {
      key: 'category',
      label: t('pages.transfers.columns.type'),
      render: (transfer) => (
        <Badge variant="outline">{translate('transferTypes', transfer.category)}</Badge>
      ),
    },
    {
      key: 'accounts',
      label: t('pages.transfers.columns.route'),
      render: (transfer) => (
        <div className="gap-xs flex items-center text-sm">
          <span className="bg-muted px-xs text-muted-foreground rounded py-0.5 text-xs font-medium">
            {transfer.origin_account_name ?? '—'}
          </span>
          <ArrowRight className="text-info h-3 w-3 shrink-0" />
          <span className="bg-info/10 px-xs text-info rounded py-0.5 text-xs font-medium">
            {transfer.destiny_account_name ?? '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('pages.transfers.columns.status'),
      render: (transfer) => {
        const s = getTransferStatus(transfer);
        return (
          <Badge variant={STATUS_VARIANTS[s] ?? 'outline'}>
            {t(`common.status.${s}`, { defaultValue: s })}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      label: t('pages.transfers.columns.date'),
      render: (transfer) => (
        <span className="text-sm">
          {formatDate(transfer.date)} às {transfer.horary}
        </span>
      ),
    },
  ];
}
