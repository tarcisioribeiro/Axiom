import { ShieldCheck } from 'lucide-react';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultHealthSection } from '@/components/security/VaultHealthSection';

export default function VaultHealthReport() {
  return (
    <PageContainer>
      <PageHeader title="Saúde do Cofre" icon={<ShieldCheck />} />
      <VaultGuard>
        <VaultHealthSection />
      </VaultGuard>
    </PageContainer>
  );
}
