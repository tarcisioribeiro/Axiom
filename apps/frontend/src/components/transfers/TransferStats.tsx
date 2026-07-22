import { Banknote, CheckCircle2, Clock } from 'lucide-react';
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
    <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
      <Card className="overflow-hidden border-t-2 border-t-info/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
          <p className="text-sm font-medium">
            {t('pages.transfers.stats.totalAmount')}
          </p>
          <div className="rounded-lg bg-info/10 p-sm ring-1 ring-info/20">
            <Banknote className="h-4 w-4 text-info" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-info">
            {formatCurrency(totalVolume)}
          </div>
          <p className="mt-xs text-xs text-muted-foreground">
            {t('pages.transfers.stats.transfersCount', { count: totalCount })}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-t-2 border-t-success/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
          <p className="text-sm font-medium">{t('pages.transfers.stats.completed')}</p>
          <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">{completedCount}</div>
          <p className="mt-xs text-xs text-muted-foreground">
            {t('pages.transfers.stats.completedSubtitle')}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-t-2 border-t-warning/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
          <p className="text-sm font-medium">{t('pages.transfers.stats.pending')}</p>
          <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
            <Clock className="h-4 w-4 text-warning" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">{pendingCount}</div>
          <p className="mt-xs text-xs text-muted-foreground">
            {t('pages.transfers.stats.pendingSubtitle')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
