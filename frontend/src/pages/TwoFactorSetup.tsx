import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, ShieldOff, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
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

// ─── Disable 2FA Card ─────────────────────────────────────────────────────────

function DisableTwoFactor({ onDisabled }: { onDisabled: () => void }) {
  const [password, setPassword] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: (pw: string) => authService.disableTwoFactor(pw),
    onSuccess: () => {
      toast({ title: t('pages.twoFactor.disableSuccess') });
      onDisabled();
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.twoFactor.invalidCode'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-sm text-destructive">
          <ShieldOff className="h-5 w-5" />
          {t('pages.twoFactor.disableBtn')}
        </CardTitle>
        <CardDescription>{t('pages.twoFactor.step2Desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(password);
          }}
          className="flex gap-3"
        >
          <Input
            type="password"
            placeholder={t('userProfile.security.currentPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="max-w-xs"
          />
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending
              ? t('pages.twoFactor.verifying')
              : t('pages.twoFactor.disableBtn')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Backup Codes Display ─────────────────────────────────────────────────────

function BackupCodesDisplay({ codes }: { codes: string[] }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="text-base">{t('pages.twoFactor.backupCodes')}</CardTitle>
        <CardDescription>{t('pages.twoFactor.backupDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative rounded-md border bg-muted p-md font-mono text-sm">
          {visible ? (
            <div className="grid grid-cols-2 gap-sm">
              {codes.map((code, i) => (
                <span key={i} className="tracking-widest">
                  {code}
                </span>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-sm">
              {codes.map((_, i) => (
                <span key={i} className="tracking-widest text-muted-foreground">
                  ••••••••••
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-sm">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => !v)}>
            {visible ? (
              <>
                <EyeOff className="mr-sm h-4 w-4" /> {t('common.actions.hide')}
              </>
            ) : (
              <>
                <Eye className="mr-sm h-4 w-4" /> {t('common.actions.reveal')}
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-sm h-4 w-4 text-success" />{' '}
                {t('common.messages.copied')}
              </>
            ) : (
              <>
                <Copy className="mr-sm h-4 w-4" /> {t('pages.twoFactor.copyBackup')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Setup 2FA Flow ────────────────────────────────────────────────────────────

function SetupTwoFactor({ onActivated }: { onActivated: () => void }) {
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
        {/* QR Code */}
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

        {/* Code confirmation */}
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

// ─── Page ──────────────────────────────────────────────────────────────────────

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
