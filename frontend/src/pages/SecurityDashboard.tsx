import { Shield, Key, CreditCard, Wallet, Archive } from 'lucide-react';
import { useState, useEffect } from 'react';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useChartColors, usePasswordStrengthColors } from '@/lib/chart-colors';
import {
  securityDashboardService,
  type SecurityDashboardStats,
} from '@/services/security-dashboard-service';
import { getErrorMessage } from '@/utils/error-utils';

type PasswordStrength = 'weak' | 'medium' | 'strong';

export default function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    void loadData();

    // Recarregar dados quando a aba/janela volta ao foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    };

    const handleFocus = () => {
      void loadData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await securityDashboardService.getStats();
      setStats(data);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = useChartColors();
  const strengthColors = usePasswordStrengthColors();

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <VaultGuard>
      <div className="space-y-6 px-4 py-8">
        <PageHeader title="Dashboard de Segurança" icon={<Shield />} />

        {/* Métricas Principais - Grid 2x2 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Senhas</CardTitle>
              <Key className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_passwords || 0}</div>
              <p className="mt-1 text-xs">
                {stats?.total_passwords === 1
                  ? 'senha cadastrada'
                  : 'senhas cadastradas'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cartões Armazenados</CardTitle>
              <CreditCard className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_stored_cards || 0}</div>
              <p className="mt-1 text-xs">
                {stats?.total_stored_cards === 1
                  ? 'cartão armazenado'
                  : 'cartões armazenados'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas Bancárias</CardTitle>
              <Wallet className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.total_stored_accounts || 0}
              </div>
              <p className="mt-1 text-xs">
                {stats?.total_stored_accounts === 1
                  ? 'conta armazenada'
                  : 'contas armazenadas'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Arquivos</CardTitle>
              <Archive className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_archives || 0}</div>
              <p className="mt-1 text-xs">
                {stats?.total_archives === 1
                  ? 'arquivo armazenado'
                  : 'arquivos armazenados'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Distribuição de Itens */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Itens</CardTitle>
              <p className="text-sm">Tipos de itens armazenados</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-items-distribution"
                data={stats?.items_distribution || []}
                dataKey="count"
                nameKey="type_display"
                formatter={(value) => `${value} ${value === 1 ? 'item' : 'itens'}`}
                colors={COLORS}
                emptyMessage="Nenhum item cadastrado"
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>

          {/* Senhas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Senhas por Categoria (Top 5)</CardTitle>
              <p className="text-sm">Distribuição de senhas por categoria</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-passwords-category"
                data={stats?.passwords_by_category || []}
                dataKey="count"
                nameKey="category_display"
                formatter={(value) => `${value} ${value === 1 ? 'senha' : 'senhas'}`}
                colors={COLORS}
                emptyMessage="Nenhuma senha cadastrada"
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>

          {/* Força das Senhas */}
          <Card>
            <CardHeader>
              <CardTitle>Análise de Segurança das Senhas</CardTitle>
              <p className="text-sm">Distribuição por nível de segurança</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-password-strength"
                data={stats?.password_strength_distribution || []}
                dataKey="count"
                nameKey="strength_display"
                formatter={(value) => `${value} ${value === 1 ? 'senha' : 'senhas'}`}
                colors={COLORS}
                customColors={(entry) =>
                  strengthColors[entry.strength as PasswordStrength] || COLORS[0]
                }
                emptyMessage="Nenhuma senha cadastrada"
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </VaultGuard>
  );
}
