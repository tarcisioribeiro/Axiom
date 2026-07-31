import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/common/StatCard';
import { formatCurrency } from '@/lib/formatters';
import { logger } from '@/lib/logger';
import { fixedExpensesService } from '@/services/fixed-expenses-service';

export const FixedExpenseStats = () => {
  const { t } = useTranslation();

  const { data: stats = null, isLoading } = useQuery({
    queryKey: ['fixed-expense-stats'],
    queryFn: async () => {
      try {
        return await fixedExpensesService.getStats();
      } catch (error) {
        logger.error('Erro ao carregar estatísticas:', error);
        return null;
      }
    },
  });

  if (isLoading || !stats) {
    return <div>{t('pages.fixedExpenses.stats.loading')}</div>;
  }

  return (
    <div className="gap-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
