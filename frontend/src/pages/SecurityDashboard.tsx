/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { Shield, Key, CreditCard, Wallet, Archive, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultHealthSection } from '@/components/security/VaultHealthSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translate } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { useChartColors, usePasswordStrengthColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { securityDashboardService } from '@/services/security-dashboard-service';
import { vaultConfigService } from '@/services/security-vault-service';
import { getErrorMessage } from '@/utils/error-utils';

type PasswordStrength = 'weak' | 'medium' | 'strong';

export default function SecurityDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['securityDashboard'],
    queryFn: () => securityDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const COLORS = useChartColors();
  const strengthColors = usePasswordStrengthColors();

  const ITEM_TYPE_LABELS: Record<string, string> = {
    passwords: t('pages.securityDashboard.passwords'),
    cards: t('pages.securityDashboard.storedCards'),
    accounts: t('pages.securityDashboard.storedAccounts'),
    archives: t('pages.securityDashboard.archives'),
  };

  const translatedItemsDistribution = useMemo(
    () =>
      (stats?.items_distribution || []).map((item) => ({
        ...item,
        type_display: ITEM_TYPE_LABELS[item.type] ?? item.type_display,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.items_distribution, t]
  );

  const translatedPasswordsByCategory = useMemo(
    () =>
      (stats?.passwords_by_category || []).map((item) => ({
        ...item,
        category_display: translate('passwordCategories', item.category),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.passwords_by_category, t]
  );

  const translatedStrengthDistribution = useMemo(
    () =>
      (stats?.password_strength_distribution || []).map((item) => ({
        ...item,
        strength_display: translate('passwordStrength', item.strength),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.password_strength_distribution, t]
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await vaultConfigService.exportVaultZip();
      toast({
        title: t('pages.securityDashboard.exportVaultSuccess'),
        description: t('pages.securityDashboard.exportVaultSuccessDesc'),
      });
    } catch (err) {
      toast({
        title: t('pages.securityDashboard.exportVaultError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <VaultGuard>
      <PageContainer>
        <div className="flex items-center justify-between">
          <PageHeader title={t('pages.securityDashboard.title')} icon={<Shield />} />
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() => void handleExport()}
            className="gap-sm"
          >
            <Download className="h-4 w-4" />
            {isExporting
              ? t('common.actions.loading')
              : t('pages.securityDashboard.exportVault')}
          </Button>
        </div>

        {/* Métricas + Saúde do Cofre */}
        <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
          {/* Card único com as 4 métricas */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.securityDashboard.vaultItems')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-info/10 p-sm ring-1 ring-info/20">
                      <Key className="h-4 w-4 text-info" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.passwords')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-info">
                    {stats?.total_passwords || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
                      <CreditCard className="h-4 w-4 text-warning" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.storedCards')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-warning">
                    {stats?.total_stored_cards || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
                      <Wallet className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.storedAccounts')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-success">
                    {stats?.total_stored_accounts || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-accent/10 p-sm ring-1 ring-accent/20">
                      <Archive className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.archives')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-accent">
                    {stats?.total_archives || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saúde do Cofre */}
          <VaultHealthSection />
        </div>

        {/* Gráficos lado a lado */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
          {/* Distribuição de Itens */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.securityDashboard.itemDistribution')}</CardTitle>
              <p className="text-sm">
                {t('pages.securityDashboard.itemDistributionDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-items-distribution"
                data={translatedItemsDistribution}
                dataKey="count"
                nameKey="type_display"
                formatter={(value) =>
                  t('pages.securityDashboard.itemCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.securityDashboard.noItems')}
                lockChartType="pie"
                height={300}
              />
            </CardContent>
          </Card>

          {/* Senhas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.securityDashboard.passwordsByCategory')}</CardTitle>
              <p className="text-sm">
                {t('pages.securityDashboard.passwordsByCategoryDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-passwords-category"
                data={translatedPasswordsByCategory}
                dataKey="count"
                nameKey="category_display"
                formatter={(value) =>
                  t('pages.securityDashboard.passwordCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.securityDashboard.noPasswords')}
                lockChartType="pie"
                height={300}
              />
            </CardContent>
          </Card>

          {/* Força das Senhas */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.securityDashboard.securityAnalysis')}</CardTitle>
              <p className="text-sm">
                {t('pages.securityDashboard.securityAnalysisDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-password-strength"
                data={translatedStrengthDistribution}
                dataKey="count"
                nameKey="strength_display"
                formatter={(value) =>
                  t('pages.securityDashboard.passwordCount', { count: Number(value) })
                }
                colors={COLORS}
                customColors={(entry) =>
                  strengthColors[entry.strength as PasswordStrength] || COLORS[0]
                }
                emptyMessage={t('pages.securityDashboard.noPasswords')}
                lockChartType="pie"
                height={300}
              />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </VaultGuard>
  );
}
