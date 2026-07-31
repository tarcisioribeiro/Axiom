/* eslint-disable max-lines */
import {
  Lock,
  Shield,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  Key,
  RefreshCw,
  Keyboard,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_CONFIG } from '@/config/api-config';
import { useToast } from '@/hooks/use-toast';
import { useVaultKeyboardShortcuts } from '@/hooks/use-vault-keyboard-shortcuts';
import { useVaultStatus } from '@/hooks/use-vault-status';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
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
      <div className="gap-xs flex">
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

interface VaultExpiryBadgeProps {
  expiresAt: string | null;
  onRenew?: () => Promise<void>;
}

export function VaultExpiryBadge({ expiresAt, onRenew }: VaultExpiryBadgeProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const secondsLeft = useVaultCountdown(expiresAt);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    try {
      setIsSubmitting(true);
      await vaultConfigService.unlock({ master_password: masterPassword });
      toast({
        title: t('pages.vaultGuard.expiry.renewSuccess'),
        description: t('pages.vaultGuard.expiry.renewSuccessDesc'),
      });
      setIsRenewOpen(false);
      setMasterPassword('');
      if (onRenew) await onRenew();
    } catch (error: unknown) {
      toast({
        title: t('pages.vaultGuard.expiry.renewError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'gap-sm px-sm py-xs flex items-center rounded-md text-xs',
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
        {isWarning && onRenew && (
          <button
            type="button"
            onClick={() => setIsRenewOpen(true)}
            className="ml-xs flex items-center gap-0.5 font-medium underline underline-offset-2 hover:opacity-80"
            aria-label={t('pages.vaultGuard.expiry.renewBtn')}
          >
            <RefreshCw className="h-2.5 w-2.5" />
            {t('pages.vaultGuard.expiry.renewBtn')}
          </button>
        )}
      </div>

      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pages.vaultGuard.expiry.renewTitle')}</DialogTitle>
            <DialogDescription>
              {t('pages.vaultGuard.expiry.renewDesc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleRenew(e)} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="renew-password">
                {t('pages.vaultGuard.locked.passwordLabel')}
              </Label>
              <div className="relative">
                <Input
                  id="renew-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder={t('pages.vaultGuard.locked.passwordPlaceholder')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="gap-sm flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenewOpen(false)}
                disabled={isSubmitting}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || !masterPassword}>
                {isSubmitting ? (
                  <RefreshCw className="mr-xs h-4 w-4 animate-spin" />
                ) : null}
                {t('pages.vaultGuard.expiry.renewConfirm')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
  const [acknowledged, setAcknowledged] = useState(false);
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
          <div className="mb-md bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <Shield className="text-primary h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">
            {t('pages.vaultGuard.setup.title')}
          </CardTitle>
          <CardDescription>{t('pages.vaultGuard.setup.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-md">
            <div className="bg-warning/10 p-sm text-warning rounded-lg text-xs">
              <div className="gap-sm flex items-start">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('pages.vaultGuard.setup.irreversibleWarning')}</span>
              </div>
              <label className="mt-sm gap-sm flex cursor-pointer items-start">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="accent-warning mt-0.5 h-3.5 w-3.5"
                />
                <span className="select-none">
                  {t('pages.vaultGuard.setup.irreversibleAck')}
                </span>
              </label>
            </div>

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
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
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
                <p className="text-muted-foreground text-xs">
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
                <p className="text-destructive text-xs">
                  {t('pages.vaultGuard.setup.passwordsMismatchShort')}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !acknowledged}
            >
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

const MAX_ATTEMPTS = 5;

function VaultUnlockScreen({ onSuccess }: VaultUnlockScreenProps) {
  const { t } = useTranslation();
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { toast } = useToast();

  const remaining = MAX_ATTEMPTS - failedAttempts;
  const isLocked = remaining <= 0;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setIsSubmitting(true);
    try {
      await vaultConfigService.unlock({ master_password: masterPassword });
      await onSuccess();
    } catch (err) {
      setMasterPassword('');
      const errData = err as { response?: { data?: { attempts_remaining?: number } } };
      const serverRemaining = errData?.response?.data?.attempts_remaining;
      if (serverRemaining !== undefined) {
        setFailedAttempts(MAX_ATTEMPTS - serverRemaining);
      } else {
        setFailedAttempts((prev) => prev + 1);
      }
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
          <div className="mb-md bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <Lock className="text-muted-foreground h-8 w-8" />
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
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
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

            {failedAttempts > 0 && !isLocked && (
              <div className="gap-sm bg-warning/10 px-sm py-xs text-warning flex items-center rounded-lg text-xs">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {t('pages.vaultGuard.locked.attemptsRemaining', { count: remaining })}
              </div>
            )}
            {isLocked && (
              <div className="gap-sm bg-destructive/10 px-sm py-xs text-destructive flex items-center rounded-lg text-xs">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {t('pages.vaultGuard.locked.tooManyAttempts')}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isLocked}
            >
              {isSubmitting
                ? t('pages.vaultGuard.locked.unlocking')
                : t('pages.vaultGuard.locked.unlockBtn')}
            </Button>

            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="gap-xs text-muted-foreground hover:text-primary flex w-full items-center justify-center text-xs transition-colors"
            >
              <Key className="h-3 w-3" />
              {t('pages.vaultGuard.locked.useRecoveryKey')}
            </button>
          </form>
        </CardContent>
      </Card>

      {showRecovery && (
        <VaultRecoveryKeyModalInline
          onClose={() => setShowRecovery(false)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}

function VaultRecoveryKeyModalInline({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (!recoveryKey.trim()) return;
    setLoading(true);
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.SECURITY_VAULT_RECOVERY_UNLOCK, {
        recovery_key: recoveryKey.trim(),
      });
      toast({ title: t('pages.security.recoveryKey.unlockSuccess') });
      await onSuccess();
      onClose();
    } catch (err) {
      toast({
        title: t('pages.security.recoveryKey.unlockError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="mx-md w-full max-w-sm">
        <CardHeader>
          <CardTitle className="gap-sm flex items-center text-base">
            <Key className="h-4 w-4" />
            {t('pages.security.recoveryKey.useTitle')}
          </CardTitle>
          <CardDescription>{t('pages.security.recoveryKey.useDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-md">
          <Input
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
            className="font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleUnlock();
            }}
          />
          <div className="gap-sm flex">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={loading || !recoveryKey.trim()}
              onClick={() => void handleUnlock()}
            >
              {loading
                ? t('common.actions.loading')
                : t('pages.security.recoveryKey.unlockBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VaultKeyboardShortcutsPanel
// ============================================================================

interface VaultKeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

function VaultKeyboardShortcutsPanel({
  open,
  onClose,
}: VaultKeyboardShortcutsPanelProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <Keyboard className="h-4 w-4" />
            {t('pages.vaultGuard.shortcuts.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('pages.vaultGuard.shortcuts.title')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-sm">
          <div className="px-sm py-xs flex items-center justify-between rounded-md border">
            <span className="text-muted-foreground text-sm">
              {t('pages.vaultGuard.shortcuts.lockVault')}
            </span>
            <kbd className="bg-muted px-xs rounded py-0.5 font-mono text-xs">
              Ctrl+L
            </kbd>
          </div>
          <div className="px-sm py-xs flex items-center justify-between rounded-md border">
            <span className="text-muted-foreground text-sm">
              {t('pages.vaultGuard.shortcuts.showShortcuts')}
            </span>
            <kbd className="bg-muted px-xs rounded py-0.5 font-mono text-xs">?</kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
 * - Desbloqueado → renderiza children + badge de expiração + atalhos de teclado
 */
export function VaultGuard({ children }: VaultGuardProps) {
  const { t } = useTranslation();
  const { status, isLoading, refresh } = useVaultStatus();
  const { showShortcuts, setShowShortcuts } = useVaultKeyboardShortcuts(refresh);

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
      <div className="mb-sm gap-sm flex items-center justify-end">
        {status.expires_at && <VaultExpiryBadge expiresAt={status.expires_at} />}
        <Button
          variant="ghost"
          size="sm"
          className="gap-xs px-sm text-muted-foreground h-7 text-xs"
          onClick={() => setShowShortcuts(true)}
          title={t('pages.vaultGuard.shortcuts.button')}
        >
          <Keyboard className="h-3.5 w-3.5" />
          {t('pages.vaultGuard.shortcuts.button')}
        </Button>
      </div>
      {children}
      <VaultKeyboardShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}
