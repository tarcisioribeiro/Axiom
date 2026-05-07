import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultHealthSection } from '@/components/security/VaultHealthSection';

export default function VaultHealthReport() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t('pages.vaultHealth.title')} icon={<ShieldCheck />} />
      <VaultGuard>
        <VaultHealthSection />
      </VaultGuard>
    </PageContainer>
  );
}
