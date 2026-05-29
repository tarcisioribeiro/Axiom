import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  const {
    data: setupData,
    isLoading: isLoadingSetup,
    error: setupError,
  } = useQuery({
    queryKey: ['2fa', 'setup'],
    queryFn: () => authService.getTwoFactorSetup(),
    staleTime: Infinity,
    retry: false,
  });

  const activateMutation = useMutation({
    mutationFn: (c: string) => authService.activateTwoFactor(c),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      toast({ title: t('pages.twoFactor.enableSuccess') });
      onActivated();
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.twoFactor.invalidCode'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  if (isLoadingSetup) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <span className="text-sm text-muted-foreground">
            {t('pages.twoFactor.loading')}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (setupError || !setupData) {
    return (
      <Card>
        <CardContent className="py-xl text-center text-sm text-destructive">
          {t('pages.twoFactor.invalidCode')}
        </CardContent>
      </Card>
    );
  }

  if (backupCodes.length > 0) {
    return <BackupCodesDisplay codes={backupCodes} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.twoFactor.setupTitle')}</CardTitle>
        <CardDescription>{t('pages.twoFactor.step1Desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-lg">
        <div className="flex flex-col items-center gap-md">
          <img
            src={setupData.qr_code}
            alt="QR Code 2FA"
            className="h-48 w-48 rounded-md border bg-white p-sm"
          />
          <div className="w-full max-w-xs space-y-xs">
            <p className="text-xs text-muted-foreground">
              {t('pages.twoFactor.step1')}:
            </p>
            <code className="block break-all rounded bg-muted px-3 py-sm text-xs">
              {setupData.manual_entry_key}
            </code>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            activateMutation.mutate(code);
          }}
          className="space-y-3"
        >
          <div className="space-y-xs">
            <Label htmlFor="totp-code">{t('pages.twoFactor.confirmCode')}</Label>
            <Input
              id="totp-code"
              type="text"
              inputMode="numeric"
              placeholder={t('pages.twoFactor.confirmCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
              className="max-w-xs"
            />
          </div>
          <Button
            type="submit"
            disabled={activateMutation.isPending || code.length < 6}
          >
            {activateMutation.isPending
              ? t('pages.twoFactor.verifying')
              : t('pages.twoFactor.enableBtn')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
