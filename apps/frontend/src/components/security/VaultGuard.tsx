/* eslint-disable max-lines */
import {
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  Key,
  Keyboard,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlainButton } from '@/components/ui/plain-button';
import { API_CONFIG } from '@/config/api-config';
import { useToast } from '@/hooks/use-toast';
import { useVaultKeyboardShortcuts } from '@/hooks/use-vault-keyboard-shortcuts';
import { useVaultStatus } from '@/hooks/use-vault-status';
import {
  getPasswordScore,
  useStrengthScorer,
  type StrengthScorer,
} from '@/lib/password-strength';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { vaultConfigService } from '@/services/security-vault-service';
import { getErrorMessage } from '@/utils/error-utils';

// ============================================================================
// Caps Lock Warning
// ============================================================================

function CapsLockWarning() {
  const { t } = useTranslation();
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    const update = (e: KeyboardEvent) => setCapsLockOn(e.getModifierState('CapsLock'));
    document.addEventListener('keydown', update);
    document.addEventListener('keyup', update);
    return () => {
      document.removeEventListener('keydown', update);
      document.removeEventListener('keyup', update);
    };
  }, []);

  // Espaço sempre reservado para o aviso não alterar a altura do card
  return (
    <p
      role="status"
      aria-hidden={!capsLockOn}
      className={cn(
        'text-warning gap-xs flex h-5 items-center text-sm',
        !capsLockOn && 'invisible'
      )}
    >
      <AlertTriangle className="h-4 w-4" />
      {t('auth.login.capsLockOn')}
    </p>
  );
}

// ============================================================================
// Password Strength Indicator
// ============================================================================

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
  scorer: StrengthScorer | null,
  t: (key: string) => string
): {
  score: number;
  label: string;
  color: string;
} {
  const score = getPasswordScore(password, scorer);
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

function PasswordStrengthIndicator({
  strength: { score, label, color },
}: {
  strength: ReturnType<typeof getStrength>;
}) {
  if (!score) return null;

  return (
    <div className="space-y-xs">
      <div className="gap-xs flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
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
      });
      setIsRenewOpen(false);
      setMasterPassword('');
      if (onRenew) await onRenew();
    } catch (error: unknown) {
      toast({
        title: t('pages.vaultGuard.expiry.renewError', {
          reason: getErrorMessage(error),
        }),
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
          <DialogHeader className="sm:text-center">
            <div className="mb-md bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <Lock className="text-muted-foreground h-8 w-8" />
            </div>
            <DialogTitle icon={Lock} className="text-2xl">
              {t('pages.vaultGuard.expiry.renewTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('pages.vaultGuard.expiry.renewDesc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleRenew(e)} className="space-y-md">
            <div className="space-y-xs">
              <Label className="gap-xs flex items-center" htmlFor="renew-password">
                <Lock className="text-muted-foreground h-3.5 w-3.5" />
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
                <PlainButton
                  aria-label={t(
                    showPassword ? 'auth.login.hidePassword' : 'auth.login.showPassword'
                  )}
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
                </PlainButton>
              </div>
              <CapsLockWarning />
            </div>
            <div className="gap-sm flex">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsRenewOpen(false)}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
                {t('common.actions.cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || !masterPassword}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

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
// VaultSetupDialog
// ============================================================================

interface VaultDialogProps {
  onSuccess: () => Promise<void>;
  /** Fechar sem concluir: sai da tela do cofre. */
  onCancel: () => void;
}

function VaultSetupDialog({ onSuccess, onCancel }: VaultDialogProps) {
  const { t } = useTranslation();
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const { toast } = useToast();

  const strengthScorer = useStrengthScorer();
  const strength = getStrength(masterPassword, strengthScorer, t);
  const mismatch = !!confirmPassword && masterPassword !== confirmPassword;

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword !== confirmPassword) {
      toast({
        title: t('pages.vaultGuard.setup.passwordsMismatch'),
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
        title: t('pages.vaultGuard.setup.successDesc'),
      });
      await onSuccess();
    } catch (err) {
      toast({
        title: t('pages.vaultGuard.setup.errorTitle', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle icon={Shield}>{t('pages.vaultGuard.setup.title')}</DialogTitle>
          <DialogDescription>{t('pages.vaultGuard.setup.desc')}</DialogDescription>
        </DialogHeader>
        <form id="vault-setup-form" onSubmit={handleSetup} className="space-y-md">
          <div className="bg-warning/10 p-sm text-warning rounded-lg text-xs">
            <div className="gap-sm flex items-start">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t('pages.vaultGuard.setup.irreversibleWarning')}</span>
            </div>
            <label className="mt-sm gap-sm flex cursor-pointer items-start">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v === true)}
                className="border-warning data-[state=checked]:bg-warning data-[state=checked]:text-warning-foreground mt-0.5"
              />
              <span className="gap-xs flex items-start select-none">
                <ShieldAlert className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('pages.vaultGuard.setup.irreversibleAck')}
              </span>
            </label>
          </div>

          <div className="space-y-xs">
            <Label className="gap-xs flex items-center" htmlFor="master-password">
              <Lock className="text-muted-foreground h-3.5 w-3.5" />
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
              <PlainButton
                aria-label={t(
                  showPassword ? 'auth.login.hidePassword' : 'auth.login.showPassword'
                )}
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </PlainButton>
            </div>
            {masterPassword && <PasswordStrengthIndicator strength={strength} />}
          </div>

          <div className="space-y-xs">
            <Label className="gap-xs flex items-center" htmlFor="confirm-password">
              <Lock className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaultGuard.setup.confirmLabel')}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('pages.vaultGuard.setup.confirmPlaceholder')}
              aria-invalid={mismatch}
              required
              minLength={8}
            />
            <CapsLockWarning />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            <X aria-hidden="true" />
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="vault-setup-form"
            disabled={!acknowledged}
            loading={isSubmitting}
          >
            {!isSubmitting && <ShieldCheck aria-hidden="true" />}
            {isSubmitting
              ? t('pages.vaultGuard.setup.configuring')
              : t('pages.vaultGuard.setup.setupBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// VaultUnlockDialog
// ============================================================================

const MAX_ATTEMPTS = 5;

function VaultUnlockDialog({ onSuccess, onCancel }: VaultDialogProps) {
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
        title: t('pages.vaultGuard.locked.failTitle', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle icon={Lock}>{t('pages.vaultGuard.locked.title')}</DialogTitle>
            <DialogDescription>{t('pages.vaultGuard.locked.desc')}</DialogDescription>
          </DialogHeader>
          <form id="vault-unlock-form" onSubmit={handleUnlock} className="space-y-md">
            <div className="space-y-xs">
              <Label className="gap-xs flex items-center" htmlFor="unlock-password">
                <Lock className="text-muted-foreground h-3.5 w-3.5" />
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
                <PlainButton
                  aria-label={t(
                    showPassword ? 'auth.login.hidePassword' : 'auth.login.showPassword'
                  )}
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </PlainButton>
              </div>
              <CapsLockWarning />
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

            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="gap-xs text-muted-foreground hover:text-primary flex w-full items-center justify-center text-xs transition-colors"
            >
              <Key className="h-3 w-3" />
              {t('pages.vaultGuard.locked.useRecoveryKey')}
            </button>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X aria-hidden="true" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              form="vault-unlock-form"
              disabled={isLocked}
              loading={isSubmitting}
            >
              {!isSubmitting && <LockOpen aria-hidden="true" />}
              {isSubmitting
                ? t('pages.vaultGuard.locked.unlocking')
                : t('pages.vaultGuard.locked.unlockBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VaultRecoveryKeyDialog
        open={showRecovery}
        onClose={() => setShowRecovery(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}

function VaultRecoveryKeyDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKey.trim()) return;
    setLoading(true);
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.SECURITY_VAULT_RECOVERY_UNLOCK, {
        recovery_key: recoveryKey.trim(),
      });
      toast({ title: t('pages.vaultGuard.recoveryKey.unlockSuccess') });
      await onSuccess();
      onClose();
    } catch (err) {
      toast({
        title: t('pages.vaultGuard.recoveryKey.unlockError', {
          reason: getErrorMessage(err),
        }),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle icon={Key}>
            {t('pages.vaultGuard.recoveryKey.useTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.vaultGuard.recoveryKey.useDesc')}
          </DialogDescription>
        </DialogHeader>
        <form id="vault-recovery-form" onSubmit={handleUnlock} className="space-y-xs">
          <Label className="gap-xs flex items-center" htmlFor="recovery-key">
            <Key className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.vaultGuard.recoveryKey.label')}
          </Label>
          <Input
            id="recovery-key"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
            className="text-sm"
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            <X aria-hidden="true" />
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="vault-recovery-form"
            disabled={!recoveryKey.trim()}
            loading={loading}
          >
            {!loading && <LockOpen aria-hidden="true" />}
            {loading
              ? t('common.actions.loading')
              : t('pages.vaultGuard.recoveryKey.unlockBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            <kbd className="bg-muted px-xs rounded py-0.5 text-xs">Ctrl+L</kbd>
          </div>
          <div className="px-sm py-xs flex items-center justify-between rounded-md border">
            <span className="text-muted-foreground text-sm">
              {t('pages.vaultGuard.shortcuts.showShortcuts')}
            </span>
            <kbd className="bg-muted px-xs rounded py-0.5 text-xs">?</kbd>
          </div>
        </div>
        <DialogCloseFooter />
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
 * - Não configurado → modal de configuração de senha mestre
 * - Configurado, bloqueado → modal de desbloqueio
 * - Desbloqueado → renderiza children + atalhos de teclado
 *
 * Cancelar um dos modais volta à página anterior (ou ao Dashboard, se não houver).
 */
export function VaultGuard({ children }: VaultGuardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, isLoading, refresh } = useVaultStatus();
  const { showShortcuts, setShowShortcuts } = useVaultKeyboardShortcuts(refresh);

  const leave = () => {
    // idx do React Router: 0 = primeira página da sessão (acesso direto pela URL)
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    void (idx > 0 ? navigate(-1) : navigate('/'));
  };

  if (isLoading) {
    return <LoadingState message={t('pages.vaultGuard.verifying')} />;
  }

  if (!status?.is_configured) {
    return <VaultSetupDialog onSuccess={refresh} onCancel={leave} />;
  }

  if (!status.is_unlocked) {
    return <VaultUnlockDialog onSuccess={refresh} onCancel={leave} />;
  }

  return (
    <>
      {children}
      <VaultKeyboardShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}
