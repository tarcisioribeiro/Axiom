import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authService } from '@/services/auth-service';

import { DisableTwoFactor } from './DisableTwoFactor';
import { SetupTwoFactor } from './SetupTwoFactor';

export function TwoFactorManager({ onDisabled }: { onDisabled?: () => void }) {
  const { t } = useTranslation();
  // Após ativar, mantém o SetupTwoFactor montado: é ele que exibe os códigos de
  // backup, que se perderiam se o status "ativo" trocasse para a tela de desativar.
  const [justActivated, setJustActivated] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <p className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        {t('pages.twoFactor.loading')}
      </p>
    );
  }

  if (data?.is_active && !justActivated) {
    return (
      <div className="gap-md flex flex-1 flex-col">
        <p className="gap-sm flex items-center text-sm font-medium">
          <ShieldCheck className="text-success h-5 w-5" />
          {t('pages.twoFactor.status')}: {t('pages.twoFactor.active')}
        </p>
        <DisableTwoFactor
          onDisabled={() => {
            void refetch();
            onDisabled?.();
          }}
        />
      </div>
    );
  }

  return (
    <SetupTwoFactor
      onActivated={() => {
        setJustActivated(true);
        void refetch();
      }}
    />
  );
}
