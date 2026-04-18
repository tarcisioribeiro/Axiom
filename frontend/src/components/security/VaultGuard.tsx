import { Lock, Shield, Eye, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

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

function getStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: '', color: '' };

  const criteria = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(password),
  ];
  const met = criteria.filter(Boolean).length;
  const long = password.length >= 12;

  if (password.length < 8) return { score: 1, label: 'Muito fraca', color: 'bg-red-500' };
  if (met < 2) return { score: 2, label: 'Fraca', color: 'bg-orange-500' };
  if (met === 2 || !long) return { score: 3, label: 'Razoável', color: 'bg-yellow-500' };
  if (met === 3) return { score: 4, label: 'Boa', color: 'bg-blue-500' };
  return { score: 5, label: 'Forte', color: 'bg-green-500' };
}

function PasswordStrengthIndicator({ password }: PasswordStrengthProps) {
  const { score, label, color } = getStrength(password);

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
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
      <p className={cn('text-xs', score >= 4 ? 'text-green-600' : score >= 3 ? 'text-yellow-600' : 'text-red-600')}>
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
    return Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );
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
  const secondsLeft = useVaultCountdown(expiresAt);

  if (secondsLeft === null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const hours = Math.floor(minutes / 60);
  const isWarning = minutes <= 10;

  const label =
    hours > 0
      ? `Cofre expira em ${hours}h ${minutes % 60}min`
      : minutes > 0
        ? `Cofre expira em ${minutes} min`
        : 'Cofre expira em breve';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
        isWarning
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {isWarning ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
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
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const strength = getStrength(masterPassword);
  const isWeakPassword = masterPassword.length > 0 && strength.score < 3;

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas mestres não coincidem.',
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
        title: 'Cofre configurado!',
        description: 'Todos os seus dados foram protegidos com sua senha mestre.',
      });
      await onSuccess();
    } catch (err) {
      toast({
        title: 'Erro ao configurar cofre',
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
          <CardTitle className="text-2xl">Proteja seu Cofre</CardTitle>
          <CardDescription>
            Configure uma senha mestre para adicionar uma camada extra de segurança.
            Seus dados serão re-criptografados com essa senha. Ela nunca é armazenada —
            guarde-a em local seguro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="master-password">Senha Mestre</Label>
              <div className="relative">
                <Input
                  id="master-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
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
                  Use ao menos 3 de: maiúsculas, minúsculas, números, caracteres especiais.
                </p>
              )}
            </div>

            <div className="space-y-xs">
              <Label htmlFor="confirm-password">Confirmar Senha Mestre</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha mestre"
                required
                minLength={8}
              />
              {confirmPassword && masterPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Configurando...' : 'Configurar Senha Mestre'}
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
        title: 'Cofre não desbloqueado',
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
          <CardTitle className="text-2xl">Cofre Bloqueado</CardTitle>
          <CardDescription>
            Digite sua senha mestre para desbloquear o cofre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="unlock-password">Senha Mestre</Label>
              <div className="relative">
                <Input
                  id="unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Digite sua senha mestre"
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
              {isSubmitting ? 'Desbloqueando...' : 'Desbloquear Cofre'}
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
  const { status, isLoading, refresh } = useVaultStatus();

  if (isLoading) {
    return <LoadingState message="Verificando cofre..." />;
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
