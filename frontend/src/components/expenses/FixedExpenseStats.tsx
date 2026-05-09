import { TrendingDown, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/common/StatCard';
import { formatCurrency } from '@/lib/formatters';
import { logger } from '@/lib/logger';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type { FixedExpenseStats as StatsType } from '@/types';

export const FixedExpenseStats = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<StatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await fixedExpensesService.getStats();
      setStats(data);
    } catch (error) {
      logger.error('Erro ao carregar estatísticas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return <div>{t('pages.fixedExpenses.stats.loading')}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('pages.fixedExpenses.stats.activeTemplates')}
        value={stats.active_templates}
        icon={<Calendar className="h-5 w-5" />}
        variant="default"
      />
      <StatCard
        title={t('pages.fixedExpenses.stats.monthTotal')}
        value={formatCurrency(stats.current_month.total_value)}
        icon={<DollarSign className="h-5 w-5" />}
        variant="danger"
      />
      <StatCard
        title={t('pages.fixedExpenses.stats.paidPending')}
        value={`${stats.current_month.paid_count} / ${stats.current_month.pending_count}`}
        icon={<TrendingDown className="h-5 w-5" />}
        variant={stats.current_month.pending_count > 0 ? 'warning' : 'success'}
      />
      <StatCard
        title={t('pages.fixedExpenses.stats.vsLastMonth')}
        value={formatCurrency(Math.abs(stats.comparison.difference))}
        icon={
          stats.comparison.difference >= 0 ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )
        }
        variant={stats.comparison.difference >= 0 ? 'danger' : 'success'}
      />
    </div>
  );
};
