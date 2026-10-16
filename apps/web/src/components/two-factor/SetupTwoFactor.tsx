import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

import { BackupCodesDisplay } from './BackupCodesDisplay';

export function SetupTwoFactor({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { toast } = useToast();
  const { t } = useTranslation();

  const activateMutation = useMutation({
    mutationFn: (c: string) => authService.activateTwoFactor(c),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      toast({ title: t('pages.twoFactor.enableSuccess') });
      onActivated();
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.twoFactor.setupError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    },
  });

  const {
    data: setupData,
    isLoading: isLoadingSetup,
    error: setupError,
  } = useQuery({
    queryKey: ['2fa', 'setup'],
    queryFn: () => authService.getTwoFactorSetup(),
    staleTime: Infinity,
    // Sem cache entre montagens: reabrir após desativar exige um QR Code novo.
    gcTime: 0,
    retry: false,
    // O api-client invalida todas as queries após um POST; refazer o setup com o
    // 2FA recém-ativado devolve 400 ("2FA já está ativado").
    enabled: !activateMutation.isPending && !activateMutation.isSuccess,
  });

  // Antes de qualquer estado do setup: os códigos só são exibidos uma vez.
  if (backupCodes.length > 0) {
    return <BackupCodesDisplay codes={backupCodes} />;
  }

  if (isLoadingSetup) {
    return (
      <p className="text-muted-foreground flex h-48 items-center justify-center text-sm">
        {t('pages.twoFactor.loading')}
      </p>
    );
  }

  if (setupError || !setupData) {
    return (
      <p className="py-xl text-destructive text-center text-sm">
        {t('pages.twoFactor.invalidCode')}
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        activateMutation.mutate(code);
      }}
      className="gap-md mx-auto flex w-full max-w-xs flex-col"
    >
      <img
        src={setupData.qr_code}
        alt="QR Code 2FA"
        className="p-sm h-48 w-48 self-center rounded-md border bg-white"
      />
      <code className="bg-muted py-sm block rounded px-3 text-center text-xs break-all">
        {setupData.manual_entry_key}
      </code>
      <div className="space-y-xs">
        <Label className="gap-xs flex items-center" htmlFor="totp-code">
          <ShieldCheck className="text-muted-foreground h-3.5 w-3.5" />
          {t('pages.twoFactor.confirmCode')}
        </Label>
        <Input
          id="totp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t('pages.twoFactor.confirmCodePlaceholder')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          required
        />
      </div>
      <Button
        type="submit"
        loading={activateMutation.isPending}
        disabled={code.length < 6}
      >
        {!activateMutation.isPending && <ShieldCheck />}
        {activateMutation.isPending
          ? t('pages.twoFactor.verifying')
          : t('pages.twoFactor.enableBtn')}
      </Button>
    </form>
  );
}
