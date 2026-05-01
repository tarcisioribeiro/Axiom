import { useQuery } from '@tanstack/react-query';
import { Shield, Key, CreditCard, Wallet, Archive, Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultHealthSection } from '@/components/security/VaultHealthSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

        {/* Métricas Principais - Grid 2x2 */}
        <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden border-t-2 border-t-info/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.securityDashboard.passwords')}
              </CardTitle>
              <div className="rounded-lg bg-info/10 p-sm ring-1 ring-info/20">
                <Key className="h-4 w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">
                {stats?.total_passwords || 0}
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.securityDashboard.passwordsCount', {
                  count: stats?.total_passwords || 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-warning/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.securityDashboard.storedCards')}
              </CardTitle>
              <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
                <CreditCard className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats?.total_stored_cards || 0}
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.securityDashboard.storedCardsCount', {
                  count: stats?.total_stored_cards || 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-success/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.securityDashboard.storedAccounts')}
              </CardTitle>
              <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
                <Wallet className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats?.total_stored_accounts || 0}
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.securityDashboard.storedAccountsCount', {
                  count: stats?.total_stored_accounts || 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-accent/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.securityDashboard.archives')}
              </CardTitle>
              <div className="rounded-lg bg-accent/10 p-sm ring-1 ring-accent/20">
                <Archive className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {stats?.total_archives || 0}
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.securityDashboard.archivesCount', {
                  count: stats?.total_archives || 0,
                })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Vault Health Report */}
        <VaultHealthSection />

        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
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
                data={stats?.items_distribution || []}
                dataKey="count"
                nameKey="type_display"
                formatter={(value) =>
                  t('pages.securityDashboard.itemCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.securityDashboard.noItems')}
                lockChartType="pie"
                height={350}
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
                data={stats?.passwords_by_category || []}
                dataKey="count"
                nameKey="category_display"
                formatter={(value) =>
                  t('pages.securityDashboard.passwordCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.securityDashboard.noPasswords')}
                lockChartType="pie"
                height={350}
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
                data={stats?.password_strength_distribution || []}
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
                height={350}
              />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </VaultGuard>
  );
}
