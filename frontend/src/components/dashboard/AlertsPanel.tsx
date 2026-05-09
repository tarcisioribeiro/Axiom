import {
  AlertTriangle,
  AlertCircle,
  Wallet,
  CreditCard,
  Receipt,
  HandCoins,
  PiggyBank,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FinancialAlert } from '@/types';

interface AlertsPanelProps {
  alerts: FinancialAlert[];
}

const typeIconMap: Record<string, React.ElementType> = {
  budget_limit: PiggyBank,
  credit_card_bill_due: CreditCard,
  low_balance: Wallet,
  payable_due: Receipt,
  loan_due: HandCoins,
};

const severityConfig = {
  danger: {
    icon: AlertCircle,
    cardClass: 'border-destructive/50 bg-destructive/5',
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    cardClass: 'border-warning/50 bg-warning/5',
    iconClass: 'text-warning',
    badgeClass: 'bg-warning/10 text-warning',
  },
  info: {
    icon: AlertCircle,
    cardClass: 'border-primary/50 bg-primary/5',
    iconClass: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary',
  },
} as const;

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter((alert, index) => {
    const key = `${alert.type}-${index}`;
    return !dismissed.has(key);
  });

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle>{t('pages.dashboard.financialAlerts.title')}</CardTitle>
          <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
            {visibleAlerts.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {visibleAlerts.map((alert, index) => {
            const key = `${alert.type}-${index}`;
            const config = severityConfig[alert.severity] ?? severityConfig.info;
            const TypeIcon = typeIconMap[alert.type] ?? AlertCircle;
            const typeLabel = t(`pages.dashboard.financialAlerts.types.${alert.type}`, {
              defaultValue: alert.type,
            });

            return (
              <li
                key={key}
                className={cn(
                  'flex items-start gap-3 rounded-md border p-3',
                  config.cardClass
                )}
              >
                <div className={cn('mt-0.5 shrink-0', config.iconClass)}>
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        config.badgeClass
                      )}
                    >
                      {typeLabel}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">{alert.message}</p>
                  {alert.link && (
                    <Link
                      to={alert.link}
                      className={cn(
                        'mt-1 inline-block text-xs underline underline-offset-2',
                        config.iconClass
                      )}
                    >
                      {t('pages.dashboard.financialAlerts.viewDetails')} →
                    </Link>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                  title={t('pages.dashboard.financialAlerts.dismiss')}
                  onClick={() => handleDismiss(key)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
