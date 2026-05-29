import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { DisableTwoFactor } from '@/components/two-factor/DisableTwoFactor';
import { SetupTwoFactor } from '@/components/two-factor/SetupTwoFactor';
import { Card, CardContent } from '@/components/ui/card';
import { authService } from '@/services/auth-service';

export default function TwoFactorSetup() {
  const { t } = useTranslation();
  const {
    data: statusData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
    staleTime: 30_000,
  });

  const is2FAActive = statusData?.is_active ?? false;

  return (
    <PageContainer>
      <PageHeader title={t('pages.twoFactor.title')} icon={<Shield />} />

      {isLoading ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <span className="text-sm text-muted-foreground">
              {t('pages.twoFactor.loading')}
            </span>
          </CardContent>
        </Card>
      ) : is2FAActive ? (
        <div className="space-y-md">
          <Card className="border-success/30 bg-success/5">
            <CardContent className="flex items-center gap-3 py-md">
              <Shield className="h-5 w-5 text-success" />
              <span className="text-sm font-medium">
                {t('pages.twoFactor.status')}: {t('pages.twoFactor.active')}
              </span>
            </CardContent>
          </Card>
          <DisableTwoFactor onDisabled={() => void refetch()} />
        </div>
      ) : (
        <SetupTwoFactor onActivated={() => void refetch()} />
      )}
    </PageContainer>
  );
}
