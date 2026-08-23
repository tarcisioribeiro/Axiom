import {
  BanknotesIcon as Banknote,
  CheckCircleIcon as CheckCircle2,
  ClockIcon as Clock,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';

interface TransferStatsProps {
  totalVolume: number;
  completedCount: number;
  pendingCount: number;
  totalCount: number;
}

export function TransferStats({
  totalVolume,
  completedCount,
  pendingCount,
  totalCount,
}: TransferStatsProps) {
  const { t } = useTranslation();

  return (
    <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
      <Card className="border-t-info/60 overflow-hidden border-t-2">
        <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
          <p className="text-sm font-medium">
            {t('pages.transfers.stats.totalAmount')}
          </p>
          <div className="bg-info/10 p-sm ring-info/20 rounded-lg ring-1">
            <Banknote className="text-info h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-info text-2xl font-bold">
            {formatCurrency(totalVolume)}
          </div>
          <p className="mt-xs text-muted-foreground text-xs">
            {t('pages.transfers.stats.transfersCount', { count: totalCount })}
          </p>
        </CardContent>
      </Card>

      <Card className="border-t-success/60 overflow-hidden border-t-2">
        <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
          <p className="text-sm font-medium">{t('pages.transfers.stats.completed')}</p>
          <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
            <CheckCircle2 className="text-success h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-success text-2xl font-bold">{completedCount}</div>
          <p className="mt-xs text-muted-foreground text-xs">
            {t('pages.transfers.stats.completedSubtitle')}
          </p>
        </CardContent>
      </Card>

      <Card className="border-t-warning/60 overflow-hidden border-t-2">
        <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
          <p className="text-sm font-medium">{t('pages.transfers.stats.pending')}</p>
          <div className="bg-warning/10 p-sm ring-warning/20 rounded-lg ring-1">
            <Clock className="text-warning h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-warning text-2xl font-bold">{pendingCount}</div>
          <p className="mt-xs text-muted-foreground text-xs">
            {t('pages.transfers.stats.pendingSubtitle')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
