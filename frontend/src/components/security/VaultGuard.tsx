/* eslint-disable max-lines */
import { Lock, Shield, Eye, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
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
import { useVaultStatus } from '@/hooks/use-vault-status';
import { cn } from '@/lib/utils';
import { vaultConfigService } from '@/services/security-vault-service';
import { getErrorMessage } from '@/utils/error-utils';

// ============================================================================
// Password Strength Indicator
// ============================================================================

interface PasswordStrengthProps {
  password: string;
}

function getStrengthScore(password: string): number {
  if (!password) return 0;
  const criteria = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(password),
  ];
  const met = criteria.filter(Boolean).length;
  const long = password.length >= 12;
  if (password.length < 8) return 1;
  if (met < 2) return 2;
  if (met === 2 || !long) return 3;
  if (met === 3) return 4;
  return 5;
}

function getStrengthLabel(score: number, t: (key: string) => string): string {
  switch (score) {
    case 1:
      return t('pages.vaultGuard.setup.strength.veryWeak');
    case 2:
      return t('pages.vaultGuard.setup.strength.weak');
    case 3:
      return t('pages.vaultGuard.setup.strength.fair');
    case 4:
      return t('pages.vaultGuard.setup.strength.good');
    case 5:
      return t('pages.vaultGuard.setup.strength.strong');
    default:
      return '';
  }
}

function getStrength(
  password: string,
  t: (key: string) => string
): {
  score: number;
  label: string;
  color: string;
} {
  const score = getStrengthScore(password);
  if (!password) return { score: 0, label: '', color: '' };
  const colors = [
    '',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500',
  ];
  return { score, label: getStrengthLabel(score, t), color: colors[score] ?? '' };
}

function PasswordStrengthIndicator({ password }: PasswordStrengthProps) {
  const { t } = useTranslation();
  const { score, label, color } = getStrength(password, t);

  if (!password) return null;

  return (
    <div className="space-y-xs">
      <div className="flex gap-xs">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all',
              i <= score ? color : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          'text-xs',
          score >= 4
            ? 'text-green-600'
            : score >= 3
              ? 'text-yellow-600'
              : 'text-red-600'
        )}
      >
        {label}
      </p>
    </div>
  );
}

// ============================================================================
// Vault Expiry Countdown
// ============================================================================

function useVaultCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!expiresAt) return null;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) {
      // defer state reset to avoid synchronous setState in effect
      const id = setTimeout(() => setSecondsLeft(null), 0);
      return () => clearTimeout(id);
    }

    const update = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
    };

    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return secondsLeft;
}

function VaultExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const { t } = useTranslation();
  const secondsLeft = useVaultCountdown(expiresAt);

  if (secondsLeft === null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const hours = Math.floor(minutes / 60);
  const isWarning = minutes <= 10;

  const label =
    hours > 0
      ? t('pages.vaultGuard.expiry.hours', { hours, minutes: minutes % 60 })
      : minutes > 0
        ? t('pages.vaultGuard.expiry.minutes', { minutes })
        : t('pages.vaultGuard.expiry.soon');

  return (
    <div
      className={cn(
        'flex items-center gap-sm rounded-md px-sm py-xs text-xs',
        isWarning
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {isWarning ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </div>
  );
}

// ============================================================================
// VaultSetupScreen
// ============================================================================

interface VaultSetupScreenProps {
  onSuccess: () => Promise<void>;
}

function VaultSetupScreen({ onSuccess }: VaultSetupScreenProps) {
  const { t } = useTranslation();
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const strength = getStrength(masterPassword, t);
  const isWeakPassword = masterPassword.length > 0 && strength.score < 3;

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword !== confirmPassword) {
      toast({
        title: t('common.messages.invalidData'),
        description: t('pages.vaultGuard.setup.passwordsMismatch'),
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await vaultConfigService.setup({
        master_password: masterPassword,
        confirm_master_password: confirmPassword,
      });
      toast({
        title: t('pages.vaultGuard.setup.successTitle'),
        description: t('pages.vaultGuard.setup.successDesc'),
      });
      await onSuccess();
    } catch (err) {
      toast({
        title: t('pages.vaultGuard.setup.errorTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {t('pages.vaultGuard.setup.title')}
          </CardTitle>
          <CardDescription>{t('pages.vaultGuard.setup.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="master-password">
                {t('pages.vaultGuard.setup.passwordLabel')}
              </Label>
              <div className="relative">
                <Input
                  id="master-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder={t('pages.vaultGuard.setup.passwordPlaceholder')}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {masterPassword && (
                <PasswordStrengthIndicator password={masterPassword} />
              )}
              {isWeakPassword && (
                <p className="text-xs text-muted-foreground">
                  {t('pages.vaultGuard.setup.passwordHint')}
                </p>
              )}
            </div>

            <div className="space-y-xs">
              <Label htmlFor="confirm-password">
                {t('pages.vaultGuard.setup.confirmLabel')}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('pages.vaultGuard.setup.confirmPlaceholder')}
                required
                minLength={8}
              />
              {confirmPassword && masterPassword !== confirmPassword && (
                <p className="text-xs text-destructive">
                  {t('pages.vaultGuard.setup.passwordsMismatchShort')}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? t('pages.vaultGuard.setup.configuring')
                : t('pages.vaultGuard.setup.setupBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VaultUnlockScreen
// ============================================================================

interface VaultUnlockScreenProps {
  onSuccess: () => Promise<void>;
}

function VaultUnlockScreen({ onSuccess }: VaultUnlockScreenProps) {
  const { t } = useTranslation();
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await vaultConfigService.unlock({ master_password: masterPassword });
      await onSuccess();
    } catch (err) {
      toast({
        title: t('pages.vaultGuard.locked.failTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">
            {t('pages.vaultGuard.locked.title')}
          </CardTitle>
          <CardDescription>{t('pages.vaultGuard.locked.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="unlock-password">
                {t('pages.vaultGuard.locked.passwordLabel')}
              </Label>
              <div className="relative">
                <Input
                  id="unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder={t('pages.vaultGuard.locked.passwordPlaceholder')}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? t('pages.vaultGuard.locked.unlocking')
                : t('pages.vaultGuard.locked.unlockBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VaultGuard
// ============================================================================

interface VaultGuardProps {
  children: React.ReactNode;
}

/**
 * Guarda de acesso ao cofre de segurança.
 *
 * - Não configurado → mostra tela de configuração de senha mestre
 * - Configurado, bloqueado → mostra tela de desbloqueio
 * - Desbloqueado → renderiza children + badge de expiração
 */
export function VaultGuard({ children }: VaultGuardProps) {
  const { t } = useTranslation();
  const { status, isLoading, refresh } = useVaultStatus();

  if (isLoading) {
    return <LoadingState message={t('pages.vaultGuard.verifying')} />;
  }

  if (!status?.is_configured) {
    return <VaultSetupScreen onSuccess={refresh} />;
  }

  if (!status.is_unlocked) {
    return <VaultUnlockScreen onSuccess={refresh} />;
  }

  return (
    <>
      {status.expires_at && (
        <div className="mb-sm flex justify-end">
          <VaultExpiryBadge expiresAt={status.expires_at} />
        </div>
      )}
      {children}
    </>
  );
}
