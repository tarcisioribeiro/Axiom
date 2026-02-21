import { useNavigate } from 'react-router-dom';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard, VaultMigrateScreen } from '@/components/security/VaultGuard';

/**
 * Página de migração da chave de criptografia.
 *
 * Acessível quando o cofre está desbloqueado. Permite re-criptografar dados
 * que estão em uma ENCRYPTION_KEY antiga (de outro ambiente) para a vault_key
 * atual derivada da senha mestre do usuário.
 *
 * Rota: /security/migrate-encryption
 */
export default function VaultMigratePage() {
  const navigate = useNavigate();

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title="Migrar Chave de Criptografia" />
        <VaultMigrateScreen onBack={() => navigate('/security/dashboard')} />
      </PageContainer>
    </VaultGuard>
  );
}
