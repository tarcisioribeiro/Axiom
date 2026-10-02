import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { TwoFactorManager } from '@/components/two-factor/TwoFactorManager';
import { Card, CardContent } from '@/components/ui/card';

export default function TwoFactorSetup() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader title={t('pages.twoFactor.title')} icon={<Shield />} />
      <Card>
        <CardContent className="pt-lg">
          <TwoFactorManager />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
